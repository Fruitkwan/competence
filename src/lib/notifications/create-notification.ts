import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getFirebaseAdminMessaging } from "@/lib/firebase/admin";
import type { Database } from "@/lib/supabase/types";

type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];

export async function createNotification(input: NotificationInsert) {
  const supabase = createAdminClient() ?? (await createClient());

  const { data, error } = await supabase
    .from("notifications")
    .insert(input)
    .select("id, user_id, type, title, body, link, metadata, created_at")
    .single();

  if (error) return { error: error.message };

  await sendFirebasePushToUser(input.user_id, {
    title: input.title,
    body: input.body ?? undefined,
    link: input.link ?? undefined,
    notificationId: data.id,
    type: input.type,
  });

  return { success: true, data };
}

async function sendFirebasePushToUser(
  userId: string,
  notification: {
    title: string;
    body?: string;
    link?: string;
    notificationId: string;
    type: string;
  }
) {
  const supabase = createAdminClient();
  const messaging = getFirebaseAdminMessaging();
  if (!supabase || !messaging) return;

  const { data: tokenRows } = await supabase
    .from("firebase_messaging_tokens")
    .select("token")
    .eq("user_id", userId)
    .eq("active", true);

  const tokens = [...new Set((tokenRows ?? []).map((row) => row.token).filter(Boolean))];
  if (!tokens.length) return;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: {
      link: notification.link ?? "",
      notification_id: notification.notificationId,
      type: notification.type,
    },
    webpush: {
      fcmOptions: notification.link ? { link: notification.link } : undefined,
    },
  });

  const invalidTokens = response.responses
    .map((result, index) => ({ result, token: tokens[index] }))
    .filter(({ result }) => {
      const code = result.error?.code;
      return (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      );
    })
    .map(({ token }) => token);

  if (invalidTokens.length) {
    await supabase
      .from("firebase_messaging_tokens")
      .update({ active: false, updated_at: new Date().toISOString() })
      .in("token", invalidTokens);
  }
}
