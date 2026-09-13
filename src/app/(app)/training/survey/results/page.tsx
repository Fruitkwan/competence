import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import {
  TrainingSurveyResultsClient,
  type TrainingSurveyResultRow,
} from "@/components/training/training-survey-results-client";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  role: "admin" | "manager" | "employee" | "executive";
  employee_id: string | null;
  cluster: string | null;
};

export default async function TrainingSurveyResultsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/training/survey/results");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id, cluster")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (profile?.role === "employee") redirect("/training/survey");
  if (profile?.role !== "admin" && profile?.role !== "manager") redirect("/dashboard");

  const canUpdateStatus = profile?.role === "admin" || profile?.role === "manager";

  const [{ data: rows }, { data: managerEmployee }] = await Promise.all([
    supabase
    .from("training_survey_responses")
    .select(
      "id, user_id, employee_id, full_name, job_title, department, role_level, email, manager_name, learn_departments, learn_topics, urgency, preferred_format, learning_hours, teach_departments, teach_topics, confidence, teaching_hours, recommended_trainers, comments, status, created_at"
    )
      .order("created_at", { ascending: false }),
    profile?.role === "manager" && profile.employee_id
      ? supabase.from("employees").select("department").eq("employee_id", profile.employee_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const managerDepartment = profile?.role === "manager"
    ? managerEmployee?.department ?? profile.cluster
    : null;
  const scopedRows = managerDepartment
    ? (rows ?? []).filter((row) => row.department === managerDepartment)
    : rows ?? [];

  return (
    <>
      <PageHeader
        title="Training Survey Results"
        description="Review training needs, trainer capacity, and response status."
      />
      <TrainingSurveyResultsClient
        rows={scopedRows as TrainingSurveyResultRow[]}
        canUpdateStatus={canUpdateStatus}
      />
    </>
  );
}
