import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing SUPABASE config");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

async function checkUsers() {
  const { data: profiles, error } = await admin.from("profiles").select("*");
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("PROFILES:");
    console.log(profiles);
  }
}

checkUsers();
