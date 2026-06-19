import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PerformanceAppraisalFormWizard } from "@/components/performance-appraisal/performance-appraisal-form";
import { emptyPerformanceAppraisal } from "@/lib/supabase/performance-appraisal-types";

type EmployeeRow = {
  employee_id: string;
  full_name: string;
  job_title: string;
  department: string | null;
  manager_name: string | null;
  email: string | null;
};

export default async function NewPerformanceAppraisalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id, email")
    .eq("id", user?.id ?? "")
    .single();

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, job_title, department, manager_name, email")
    .order("employee_id");

  const currentEmployee = user
    ? await getCurrentEmployee(supabase, profile?.employee_id ?? null, user.id, profile?.email ?? user.email ?? null)
    : null;
  const isEmployee = profile?.role === "employee";
  const managerEmployee = currentEmployee?.manager_name
    ? (employees ?? []).find((employee) => employee.full_name === currentEmployee.manager_name) ?? null
    : null;
  const empList = isEmployee && currentEmployee
    ? [currentEmployee, managerEmployee].filter((employee): employee is EmployeeRow => Boolean(employee))
    : employees ?? [];
  const managerId = currentEmployee?.manager_name
    ? managerEmployee?.employee_id ?? ""
    : "";
  const initial = currentEmployee
    ? {
        ...emptyPerformanceAppraisal(),
        employee_id: currentEmployee.employee_id,
        manager_id: managerId,
        department: currentEmployee.department ?? "",
        document_ref: `Employee file: ${currentEmployee.employee_id}`,
      }
    : undefined;
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
      {isEmployee && !currentEmployee ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Your user is not linked to an employee record yet.
          </CardContent>
        </Card>
      ) : (
        <PerformanceAppraisalFormWizard
          employees={empList}
          initial={initial}
          currentUserRole={profile?.role || "employee"}
          currentUserId={user?.id || ""}
          roleBenchmarks={roleBenchmarks}
        />
      )}
    </>
  );
}

async function getCurrentEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employeeId: string | null,
  userId: string,
  email: string | null
) {
  const select = "employee_id, full_name, job_title, department, manager_name, email";

  if (employeeId) {
    const { data } = await supabase
      .from("employees")
      .select(select)
      .eq("employee_id", employeeId)
      .maybeSingle<EmployeeRow>();
    if (data) return data;
  }

  const { data: byUserId } = await supabase
    .from("employees")
    .select(select)
    .eq("user_id", userId)
    .maybeSingle<EmployeeRow>();
  if (byUserId) return byUserId;

  if (email) {
    const { data } = await supabase
      .from("employees")
      .select(select)
      .ilike("email", email)
      .maybeSingle<EmployeeRow>();
    if (data) return data;
  }

  return null;
}
