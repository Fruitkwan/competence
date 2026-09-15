import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { AssessmentForm } from "@/components/assessments/assessment-form";
import { formatDate } from "@/lib/format";

const RATER_LABEL: Record<string, string> = {
  line_manager: "Line manager",
  cross_dept: "Cross-departmental rater",
  peer: "Peer",
  self: "Self",
};

export default async function RateAssessmentPage(props: PageProps<"/assessments/rate/[raterId]">) {
  const { raterId } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rater } = await supabase
    .from("assessment_raters")
    .select("id, assignment_id, rater_type, status, started_at")
    .eq("id", raterId)
    .eq("rater_user_id", user.id)
    .maybeSingle();
  if (!rater) notFound();
  if (rater.status === "submitted" || rater.rater_type === "self") redirect("/assessments");

  const { data: assignment } = await supabase
    .from("assessment_assignments")
    .select("id, template_id, employee_id, due_date, wave, status")
    .eq("id", rater.assignment_id)
    .single();
  if (!assignment || assignment.status === "closed") redirect("/assessments");

  const [{ data: template }, { data: items }, { data: employee }, { data: responses }] = await Promise.all([
    supabase.from("assessment_templates").select("kind, name, role_family, privacy_notice").eq("id", assignment.template_id).single(),
    supabase.from("assessment_items").select("*").eq("template_id", assignment.template_id).order("sort_order"),
    supabase.from("employees").select("full_name, job_title").eq("employee_id", assignment.employee_id).maybeSingle(),
    supabase.from("assessment_responses").select("item_id, rating, not_observed, scenario_answer, evidence").eq("rater_id", rater.id),
  ]);
  if (!template || !items) notFound();

  const subject = employee?.full_name ?? assignment.employee_id;
  // Capture the server clock for this request, as on the self-assessment page.
  // eslint-disable-next-line react-hooks/purity
  const serverNow = Date.now();

  return (
    <>
      <PageHeader
        title={`Rate ${subject}`}
        description={`${template.role_family ?? template.name} · ${RATER_LABEL[rater.rater_type]}${employee?.job_title ? ` · ${employee.job_title}` : ""}${assignment.due_date ? ` · due ${formatDate(assignment.due_date)}` : ""}`}
      />
      <AssessmentForm
        title={template.name}
        intro={template.privacy_notice}
        items={items}
        existing={responses ?? []}
        mode={{ kind: "rater", raterId: rater.id, subjectName: subject, timed: rater.rater_type === "peer", startedAt: rater.started_at, serverNow }}
      />
    </>
  );
}
