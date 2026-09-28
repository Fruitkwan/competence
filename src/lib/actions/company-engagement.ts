"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CompanyPostKind } from "@/lib/company-engagement";

type CompanyPostInput = {
  id?: string;
  kind: CompanyPostKind;
  title: string;
  summary: string;
  details: string;
  recipientName: string;
  startsOn: string;
  endsOn: string;
  ctaLabel: string;
  ctaUrl: string;
  published: boolean;
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in again.", userId: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: "HR admin access required.", userId: null };
  return { error: null, userId: user.id };
}

function optional(value: string, max: number) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function validLink(value: string) {
  if (!value) return true;
  if (value.startsWith("/")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function saveCompanyPost(input: CompanyPostInput) {
  const { error: authError, userId } = await requireAdmin();
  if (authError || !userId) return { error: authError };
  if (!(["health_challenge", "promotion", "prize"] as string[]).includes(input.kind)) return { error: "Choose a valid post type." };
  if (!input.title.trim()) return { error: "Title is required." };
  if (!input.summary.trim()) return { error: "Summary is required." };
  if (input.startsOn && input.endsOn && input.endsOn < input.startsOn) return { error: "End date must be on or after the start date." };
  if (!validLink(input.ctaUrl.trim())) return { error: "The link must start with / or https://" };

  const admin = createAdminClient();
  if (!admin) return { error: "Company post management is not configured." };
  const values = {
    kind: input.kind,
    title: input.title.trim().slice(0, 120),
    summary: input.summary.trim().slice(0, 500),
    details: optional(input.details, 3000),
    recipient_name: optional(input.recipientName, 160),
    starts_on: input.startsOn || null,
    ends_on: input.endsOn || null,
    cta_label: optional(input.ctaLabel, 60),
    cta_url: optional(input.ctaUrl, 500),
    published: input.published,
    updated_at: new Date().toISOString(),
  };
  const query = input.id
    ? admin.from("company_engagement_posts").update(values).eq("id", input.id)
    : admin.from("company_engagement_posts").insert({ ...values, created_by: userId });
  const { data, error } = await query.select("id").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "The company post was not saved." };
  revalidatePath("/admin/engagement");
  revalidatePath("/dashboard");
  return { error: null };
}

export async function setCompanyPostPublished(id: string, published: boolean) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const admin = createAdminClient();
  if (!admin) return { error: "Company post management is not configured." };
  const { data, error } = await admin
    .from("company_engagement_posts")
    .update({ published, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "The company post was not updated." };
  revalidatePath("/admin/engagement");
  revalidatePath("/dashboard");
  return { error: null };
}
