import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AppraisalForm } from "../appraisal-form";

export default async function EditAppraisalPage(
  props: PageProps<"/appraisals/[id]">
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: appraisal }, { data: employees }, { data: levels }] = await Promise.all([
    supabase.from("appraisals").select("*").eq("id", id).single(),
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title")
      .order("employee_id"),
    supabase.from("competency_levels").select("label").order("numeric_value"),
  ]);

  if (!appraisal) notFound();

  return (
    <>
      <PageHeader
        title="Edit appraisal"
        description={`${appraisal.employee_id} · ${appraisal.appraisal_date}`}
      />
      <AppraisalForm
        mode="edit"
        employees={employees ?? []}
        levels={(levels ?? []).map((l) => l.label)}
        appraisal={appraisal}
      />
    </>
  );
}
