// supabase/functions/push-fanout/index.ts
//
// Triggered by a Supabase Database Webhook on INSERT into `public.notifications`.
// Looks up the recipient's device_tokens and pushes a notification via FCM HTTP v1.
//
// Required Edge Function secrets:
//   SUPABASE_URL                 (already set by Supabase runtime)
//   SUPABASE_SERVICE_ROLE_KEY    (already set by Supabase runtime)
//   FCM_PROJECT_ID               Firebase project id
//   FCM_SERVICE_ACCOUNT          JSON of the FCM service account key
//
// Webhook payload shape (per Supabase docs):
//   { type: "INSERT", table: "notifications", record: { ...row }, schema: "public" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  read?: boolean;
  metadata?: Record<string, unknown>;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRow;
  schema: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const FCM_PROJECT_ID = Deno.env.get("FCM_PROJECT_ID")!;
const FCM_SERVICE_ACCOUNT = JSON.parse(
  Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "{}",
);

// Cached OAuth access token for FCM.
let cachedToken: { token: string; exp: number } | null = null;

async function getFcmAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;

  const { client_email, private_key } = FCM_SERVICE_ACCOUNT;
  if (!client_email || !private_key) {
    throw new Error("FCM_SERVICE_ACCOUNT is missing client_email / private_key");
  }

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=+$/, "");
  const claim = {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const claimEncoded = btoa(JSON.stringify(claim)).replace(/=+$/, "");
  const unsigned = `${header}.${claimEncoded}`;

  const pkcs8 = pemToPkcs8(private_key);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const sigEncoded = base64UrlEncode(new Uint8Array(sig));
  const jwt = `${unsigned}.${sigEncoded}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenResp.ok) {
    throw new Error(`FCM token exchange failed: ${tokenResp.status} ${await tokenResp.text()}`);
  }
  const tokenJson = await tokenResp.json();
  cachedToken = {
    token: tokenJson.access_token as string,
    exp: now + (tokenJson.expires_in as number),
  };
  return cachedToken.token;
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sendToToken(token: string, n: NotificationRow): Promise<void> {
  const accessToken = await getFcmAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`;
  const body = {
    message: {
      token,
      notification: { title: n.title, body: n.body ?? undefined },
      data: {
        notification_id: n.id,
        type: n.type,
        link: n.link ?? "",
      },
      android: { priority: "HIGH" as const },
      apns: { headers: { "apns-priority": "10" } },
    },
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    console.error(`FCM send failed for ${token}: ${resp.status} ${text}`);
    // Clean up tokens that are no longer registered.
    if (resp.status === 404 || resp.status === 400) {
      await supabase.from("device_tokens").delete().eq("token", token);
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (payload.type !== "INSERT" || payload.table !== "notifications") {
    return new Response("Ignored", { status: 200 });
  }
  const n = payload.record;
  const { data: tokens, error } = await supabase
    .from("device_tokens")
    .select("token")
    .eq("user_id", n.user_id);
  if (error) {
    console.error(error);
    return new Response("DB error", { status: 500 });
  }
  if (!tokens || tokens.length === 0) {
    return new Response("No devices", { status: 200 });
  }
  await Promise.all(tokens.map((t) => sendToToken(t.token as string, n)));
  return new Response("ok", { status: 200 });
});
