import { redirect } from "next/navigation";
import { OrganizationChart } from "@/components/organization-chart/organization-chart";
import { PageHeader } from "@/components/page-header";
import { buildOrganizationChart, type OrgEmployee } from "@/lib/organization-chart";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/assessments/results";
import { loadOrgAssessments } from "@/lib/organization-chart-assessments";

export default async function OrganizationChartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/org-chart");

  const [{ data: profile }, { data: employees }] = await Promise.all([
    supabase.from("profiles").select("employee_id").eq("id", user.id).maybeSingle(),
    supabase.from("employees").select("employee_id, full_name, job_title, department, country_code, manager_name").eq("active", true).order("full_name"),
  ]);
  const chart = buildOrganizationChart((employees ?? []) as OrgEmployee[]);
  const viewer = await getViewer(supabase);
  if (!viewer) redirect("/login");
  const assessments = await loadOrgAssessments(supabase, viewer);
  for (const node of chart.nodes) {
    if (viewer.role !== "employee" || node.employee_id === viewer.employeeId) {
      node.assessments = assessments.get(node.employee_id) ?? [];
    }
  }

  return (
    <>
      <PageHeader title="Organization Chart" description="Explore reporting lines, teams, departments, and the current management structure." />
      <OrganizationChart {...chart} currentEmployeeId={profile?.employee_id ?? null} />
    </>
  );
}
