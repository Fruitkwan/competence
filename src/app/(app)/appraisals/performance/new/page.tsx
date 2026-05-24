import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PerformanceAppraisalFormWizard } from "@/components/performance-appraisal/performance-appraisal-form";

const DEMO_EMPLOYEES = [
  { employee_id: "DG-001", full_name: "Fatima Al-Rashidi", job_title: "Senior Financial Analyst" },
  { employee_id: "DG-002", full_name: "Ahmed Al-Balushi", job_title: "Operations Manager" },
  { employee_id: "DG-003", full_name: "Sara Khalfan", job_title: "HR Business Partner" },
  { employee_id: "DG-004", full_name: "Mohammed Al-Habsi", job_title: "Software Engineer" },
  { employee_id: "DG-005", full_name: "Layla Al-Hinai", job_title: "Marketing Lead" },
];

export default async function NewPerformanceAppraisalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, job_title")
    .order("employee_id");

  const empList = employees?.length ? employees : DEMO_EMPLOYEES;
  const roleTitles = [...new Set(empList.map((employee) => employee.job_title).filter(Boolean))];
  const [{ data: profiles }, { data: roleCompetencies }, { data: roleKpis }] = roleTitles.length
    ? await Promise.all([
        supabase
          .from("job_profiles")
          .select("title, department")
          .in("title", roleTitles),
        supabase
          .from("role_competencies")
          .select("role_title, competency_id, sort_order")
          .in("role_title", roleTitles)
          .eq("applicable", true)
          .order("sort_order"),
        supabase
          .from("role_kpi_templates")
          .select("role_title, title, measure, target, sort_order")
          .in("role_title", roleTitles)
          .eq("active", true)
          .order("sort_order"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const competencyIds = roleCompetencies?.map((item) => item.competency_id) ?? [];
  const { data: competencies } = competencyIds.length
    ? await supabase
        .from("competencies")
        .select("id, name, description, behavioral_indicators")
        .in("id", competencyIds)
    : { data: [] };

  const competencyById = new Map((competencies ?? []).map((item) => [item.id, item]));
  const roleBenchmarks = (profiles ?? []).map((role) => ({
    role_title: role.title,
    department: role.department,
    competencies: (roleCompetencies ?? [])
      .filter((item) => item.role_title === role.title)
      .map((item) => competencyById.get(item.competency_id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    kpis: (roleKpis ?? [])
      .filter((item) => item.role_title === role.title)
      .map((item) => ({
        title: item.title,
        measure: item.measure,
        target: item.target,
      })),
  }));

  return (
    <>
      <PageHeader
        title="New Performance Appraisal"
        description="Complete the Dhofar Global two-way performance appraisal (N1 & N2)."
      />
      <PerformanceAppraisalFormWizard 
        employees={empList} 
        currentUserRole={profile?.role || "employee"}
        currentUserId={user?.id || ""}
        roleBenchmarks={roleBenchmarks}
      />
    </>
  );
}
