import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AppraisalForm } from "../appraisal-form";

export default async function NewAppraisalPage(
  props: PageProps<"/appraisals/new">
) {
  const search = await props.searchParams;
  const employeeId = Array.isArray(search?.employee)
    ? search.employee[0]
    : search?.employee ?? null;

  const supabase = await createClient();
  const [{ data: employees }, { data: levels }] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title")
      .order("employee_id"),
    supabase.from("competency_levels").select("label").order("numeric_value"),
  ]);

  return (
    <>
      <PageHeader
        title="New appraisal"
        description="Record a competency appraisal — the gap, priority, and recommended course are computed automatically."
      />
      <AppraisalForm
        mode="create"
        employees={employees ?? []}
        levels={(levels ?? []).map((l) => l.label)}
        defaultEmployeeId={employeeId ?? undefined}
      />
    </>
  );
}
