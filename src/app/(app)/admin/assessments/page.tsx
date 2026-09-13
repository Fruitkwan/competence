import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { TemplateLibrary, type TemplateRow } from "@/components/assessments/template-library";

export default async function AssessmentTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: templates, error } = await supabase
    .from("assessment_templates")
    .select("id, kind, name, role_family, department, job_titles, version, status, source_file_name, published_at, created_at")
    .order("kind")
    .order("status")
    .order("created_at", { ascending: false });

  const ids = (templates ?? []).map((t) => t.id);
  const { data: items } = ids.length
    ? await supabase.from("assessment_items").select("id, template_id").in("template_id", ids)
    : { data: [] };
  const itemIds = (items ?? []).map((i) => i.id);
  const { data: keys } = itemIds.length
    ? await supabase.from("assessment_item_keys").select("item_id").in("item_id", itemIds).not("answer_key", "is", null)
    : { data: [] };
  const keyed = new Set((keys ?? []).map((k) => k.item_id));

  const rows: TemplateRow[] = (templates ?? []).map((t) => {
    const tplItems = (items ?? []).filter((i) => i.template_id === t.id);
    return {
      ...t,
      item_count: tplItems.length,
      keyed_count: tplItems.filter((i) => keyed.has(i.id)).length,
    };
  });

  return (
    <>
      <PageHeader
        title="Assessment Library"
        description="Upload the DG Skill and Behaviour instruments, load the scoring annexe, and publish what employees can be assigned."
      />
      <TemplateLibrary templates={rows} loadError={error?.code === "42P01" ? "Assessment tables are missing. Run scripts/migration-assessments.sql in Supabase." : error?.message ?? null} />
    </>
  );
}
