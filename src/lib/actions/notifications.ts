"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function getUnreadCount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  return count ?? 0;
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return { error: error.message };

  revalidatePath("/notifications");
  return { success: true };
}

export async function getRecentNotifications(limit = 10) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

export async function registerFirebaseMessagingToken(token: string, userAgent?: string) {
  const trimmedToken = token.trim();
  if (!trimmedToken) return { error: "Missing Firebase messaging token." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("firebase_messaging_tokens")
    .upsert(
      {
        user_id: user.id,
        token: trimmedToken,
        user_agent: userAgent ?? null,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

  if (error) {
    return {
      error:
        error.code === "42P01"
          ? "Firebase token table is missing. Run scripts/migration-firebase-notifications.sql in Supabase."
          : error.message,
    };
  }

  return { success: true };
}
