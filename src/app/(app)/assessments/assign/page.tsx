import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AssignAssessmentForm, type AssignmentRow } from "@/components/assessments/assign-assessment-form";

export default async function AssignAssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/dashboard");

  const [empRes, tplRes, profRes, asgRes] = await Promise.all([
    supabase.from("employees").select("employee_id, full_name, job_title, manager_name, department").eq("active", true).order("full_name"),
    supabase
      .from("assessment_templates")
      .select("id, kind, name, role_family, department, job_titles")
      .eq("status", "published")
      .order("kind")
      .order("role_family"),
    supabase.from("profiles").select("id, full_name, email, job_title, role, employee_id").eq("is_active", true).order("full_name"),
    supabase
      .from("assessment_assignments")
      .select("id, template_id, employee_id, employee_user_id, wave, due_date, status, results_released, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const assignments = asgRes.data ?? [];
  const ids = assignments.map((a) => a.id);
  const { data: raters } = ids.length
    ? await supabase.from("assessment_raters").select("assignment_id, rater_user_id, rater_type, status").in("assignment_id", ids)
    : { data: [] };

  const templates = tplRes.data ?? [];
  const employees = empRes.data ?? [];
  const empByIds = new Map(employees.map((e) => [e.employee_id, e]));
  const tplById = new Map(templates.map((t) => [t.id, t]));

  const rows: AssignmentRow[] = assignments.map((a) => {
    const rs = (raters ?? []).filter((r) => r.assignment_id === a.id);
    const tpl = tplById.get(a.template_id);
    return {
      id: a.id,
      employee_id: a.employee_id,
      employee_name: empByIds.get(a.employee_id)?.full_name ?? a.employee_id,
      template_name: tpl?.role_family ?? tpl?.name ?? "Assessment",
      kind: tpl?.kind ?? "skill",
      wave: a.wave,
      due_date: a.due_date,
      status: a.status,
      results_released: a.results_released,
      has_account: a.employee_user_id != null,
      self_done: rs.some((r) => r.rater_type === "self" && r.status === "submitted"),
      raters_total: rs.filter((r) => r.rater_type !== "self").length,
      raters_done: rs.filter((r) => r.rater_type !== "self" && r.status === "submitted").length,
      raters: rs
        .filter((r) => r.rater_type !== "self")
        .map((r) => ({ user_id: r.rater_user_id, type: r.rater_type, status: r.status })),
      manager_user_id:
        profRes.data?.find((p) => p.full_name === empByIds.get(a.employee_id)?.manager_name)?.id ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Assign Assessments"
        description="Pick an employee, choose the instruments for their role, and nominate raters. Everyone involved is notified."
      />
      <AssignAssessmentForm
        employees={employees.map((e) => ({ ...e, department: e.department ?? null }))}
        templates={templates}
        users={(profRes.data ?? []).map((p) => ({
          id: p.id,
          label: p.full_name ?? p.email,
          meta: [p.job_title, p.role].filter(Boolean).join(" · "),
          employee_id: p.employee_id,
        }))}
        assignments={rows}
        canDelete={profile.role === "admin"}
        canBulkAssign={profile.role === "admin"}
      />
    </>
  );
}
