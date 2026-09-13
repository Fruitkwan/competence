import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TemplateDetail } from "@/components/assessments/template-detail";

export default async function AssessmentTemplateDetailPage(props: PageProps<"/admin/assessments/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const { data: template } = await supabase.from("assessment_templates").select("*").eq("id", id).maybeSingle();
  if (!template) notFound();

  const [{ data: items }, { data: jobTitles }] = await Promise.all([
    supabase.from("assessment_items").select("*").eq("template_id", id).order("sort_order"),
    supabase.from("employees").select("job_title").eq("active", true),
  ]);
  const itemIds = (items ?? []).map((i) => i.id);
  const { data: keys } = itemIds.length
    ? await supabase.from("assessment_item_keys").select("*").in("item_id", itemIds)
    : { data: [] };

  const knownTitles = [...new Set((jobTitles ?? []).map((j) => j.job_title).filter(Boolean))].sort();

  return (
    <>
      <PageHeader
        title={template.role_family ?? template.name}
        description={`${template.kind === "skill" ? "Skill assessment" : "Behaviour, Desire and Attitude assessment"}${template.version ? ` · v${template.version}` : ""}${template.department ? ` · ${template.department}` : ""}`}
        actions={
          <>
            <Badge variant="outline" className="capitalize">{template.status}</Badge>
            <Link href="/admin/assessments" className={buttonVariants({ variant: "outline" })}>
              Back to library
            </Link>
          </>
        }
      />
      <TemplateDetail
        template={template}
        items={items ?? []}
        keys={keys ?? []}
        knownJobTitles={knownTitles}
      />
    </>
  );
}
