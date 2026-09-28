import { redirect } from "next/navigation";
import { OrganizationChart } from "@/components/organization-chart/organization-chart";
import { PageHeader } from "@/components/page-header";
import { buildOrganizationChart, type OrgEmployee } from "@/lib/organization-chart";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/assessments/results";
import { loadOrgAssessments } from "@/lib/organization-chart-assessments";
import { signedProfileImageUrls } from "@/lib/profile-images";

export default async function OrganizationChartPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/org-chart");

  const [{ data: profile }, { data: employees }, { data: employeeProfiles }] = await Promise.all([
    supabase.from("profiles").select("employee_id").eq("id", user.id).maybeSingle(),
    supabase.from("employees").select("employee_id, full_name, job_title, department, country_code, manager_name").eq("active", true).order("full_name"),
    supabase.from("profiles").select("employee_id, full_name, avatar_path").not("employee_id", "is", null),
  ]);
  const chart = buildOrganizationChart((employees ?? []) as OrgEmployee[]);
  const avatarUrls = await signedProfileImageUrls(supabase, (employeeProfiles ?? []).map((item) => item.avatar_path));
  const profileByEmployeeId = new Map((employeeProfiles ?? []).map((item) => [item.employee_id, item]));
  for (const node of chart.nodes) {
    const employeeProfile = profileByEmployeeId.get(node.employee_id);
    node.avatar_url = employeeProfile?.avatar_path ? avatarUrls.get(employeeProfile.avatar_path) ?? null : null;
    if (employeeProfile?.full_name?.trim()) node.full_name = employeeProfile.full_name.trim();
  }
  const viewer = await getViewer(supabase);
  if (!viewer) redirect("/login");
  const showAssessments = viewer.role !== "employee";
  if (showAssessments) {
    const assessments = await loadOrgAssessments(supabase, viewer);
    for (const node of chart.nodes) {
      node.assessments = assessments.get(node.employee_id) ?? [];
    }
  }

  return (
    <>
      <PageHeader title="Organization Chart" description="Explore reporting lines, teams, departments, and the current management structure." />
      <OrganizationChart {...chart} currentEmployeeId={profile?.employee_id ?? null} showAssessments={showAssessments} />
    </>
  );
}
