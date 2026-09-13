import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AssessmentForm, type ExistingResponse } from "@/components/assessments/assessment-form";
import { formatDate } from "@/lib/format";

export default async function TakeAssessmentPage(props: PageProps<"/assessments/[id]/take">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("employee_id").eq("id", user.id).single();

  const { data: assignment } = await supabase
    .from("assessment_assignments")
    .select("id, template_id, employee_id, employee_user_id, status, due_date, wave, aspiration")
    .eq("id", id)
    .maybeSingle();
  if (!assignment) notFound();

  const isMine = assignment.employee_user_id === user.id || (profile?.employee_id != null && assignment.employee_id === profile.employee_id);
  if (!isMine) redirect("/assessments");
  if (assignment.status === "submitted" || assignment.status === "closed") redirect("/assessments");

  const [{ data: template }, { data: items }, { data: rater }] = await Promise.all([
    supabase.from("assessment_templates").select("kind, name, role_family, privacy_notice, aspiration_questions").eq("id", assignment.template_id).single(),
    supabase.from("assessment_items").select("*").eq("template_id", assignment.template_id).order("sort_order"),
    supabase
      .from("assessment_raters")
      .select("id")
      .eq("assignment_id", assignment.id)
      .eq("rater_user_id", user.id)
      .eq("rater_type", "self")
      .maybeSingle(),
  ]);
  if (!template || !items) notFound();

  const { data: responses } = rater
    ? await supabase.from("assessment_responses").select("item_id, rating, not_observed, scenario_answer, evidence").eq("rater_id", rater.id)
    : { data: [] as ExistingResponse[] };

  return (
    <>
      <PageHeader
        title={template.role_family ?? template.name}
        description={`${template.kind === "skill" ? "Skill assessment" : "Behaviour, Desire and Attitude assessment"} · self-rating${assignment.wave ? ` · ${assignment.wave}` : ""}${assignment.due_date ? ` · due ${formatDate(assignment.due_date)}` : ""}`}
      />
      <AssessmentForm
        title={template.name}
        intro={template.privacy_notice}
        items={items}
        existing={responses ?? []}
        mode={{
          kind: "self",
          assignmentId: assignment.id,
          aspirationQuestions: template.aspiration_questions as string[],
          aspiration: (assignment.aspiration as Record<string, string> | null) ?? {},
        }}
      />
    </>
  );
}
