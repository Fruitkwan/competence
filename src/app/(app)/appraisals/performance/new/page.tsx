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
    .eq("id", user?.id)
    .single();

  const { data: employees } = await supabase
    .from("employees")
    .select("employee_id, full_name, job_title")
    .order("employee_id");

  const empList = employees?.length ? employees : DEMO_EMPLOYEES;

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
      />
    </>
  );
}
