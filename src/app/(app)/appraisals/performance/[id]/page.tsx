import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PerformanceAppraisalFormWizard } from "@/components/performance-appraisal/performance-appraisal-form";
import type { PerformanceAppraisalForm } from "@/lib/supabase/performance-appraisal-types";

export default async function EditPerformanceAppraisalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id, full_name")
    .eq("id", user.id)
    .single();

  const { data: appraisal } = await supabase
    .from("performance_appraisals")
    .select("*")
    .eq("id", id)
    .single();

  if (!appraisal) return notFound();

  if (profile?.role === "employee" && appraisal.employee_id !== profile.employee_id) {
    return notFound();
  }

  if (profile?.role === "manager" || profile?.role === "executive") {
    const { data: employee } = await supabase
      .from("employees")
      .select("manager_name")
      .eq("employee_id", appraisal.employee_id)
      .maybeSingle();
    const isAssignedManager =
      appraisal.manager_id === profile.employee_id ||
      Boolean(employee?.manager_name && employee.manager_name === profile.full_name);
    if (!isAssignedManager) return notFound();
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, job_title")
    .order("employee_id");

  return (
    <>
      <PageHeader
        title="Performance Appraisal"
        description="Review or update this performance appraisal."
      />
      <PerformanceAppraisalFormWizard
        employees={employees || []}
        initial={appraisal as unknown as PerformanceAppraisalForm}
        currentUserRole={profile?.role || "employee"}
        currentUserId={user.id}
      />
    </>
  );
}
