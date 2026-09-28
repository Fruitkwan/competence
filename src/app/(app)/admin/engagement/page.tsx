import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { EngagementManager } from "@/components/company/engagement-manager";
import type { CompanyPost } from "@/lib/company-engagement";
import { createClient } from "@/lib/supabase/server";

export default async function CompanyEngagementAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/engagement");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: posts } = await supabase
    .from("company_engagement_posts")
    .select("id, kind, title, summary, details, recipient_name, starts_on, ends_on, cta_label, cta_url, published, created_at, updated_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader title="Company Highlights" description="Publish health challenges, promotions, prizes, and recognition to employee dashboards." />
      <EngagementManager posts={(posts ?? []) as CompanyPost[]} />
    </>
  );
}
