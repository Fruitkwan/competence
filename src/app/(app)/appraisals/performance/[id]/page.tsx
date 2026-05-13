import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PerformanceAppraisalFormWizard } from "@/components/performance-appraisal/performance-appraisal-form";

export default async function EditPerformanceAppraisalPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: appraisal } = await (supabase as any)
    .from("performance_appraisals")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!appraisal) return notFound();

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
        initial={appraisal as any}
        currentUserRole={profile?.role || "employee"}
        currentUserId={user.id}
      />
    </>
  );
}
