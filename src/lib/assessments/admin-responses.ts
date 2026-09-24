import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Viewer } from "@/lib/assessments/results";

type RaterType = "self" | "line_manager" | "cross_dept" | "peer";
type RaterStatus = "pending" | "submitted";
type Letter = "A" | "B" | "C" | "D";

export type AdminAnswer = {
  raterId: string;
  raterName: string;
  raterType: RaterType;
  status: RaterStatus;
  rating: number | null;
  notObserved: boolean;
  scenarioAnswer: Letter | null;
  scenarioAnswerText: string | null;
  evidence: string | null;
};

export type AdminQuestionResponses = {
  id: string;
  sortOrder: number;
  groupName: string | null;
  name: string;
  indicator: string;
  scenario: string | null;
  answers: AdminAnswer[];
};

export type AdminResponseSection = {
  assignmentId: string;
  templateName: string;
  kind: "skill" | "behaviour" | "placement";
  wave: string | null;
  employeeName: string;
  questions: AdminQuestionResponses[];
};

export async function loadAdminAssessmentResponses(
  assignmentIds: string[],
  viewer: Viewer
): Promise<AdminResponseSection[]> {
  if (viewer.role !== "admin" || assignmentIds.length === 0) return [];
  const admin = createAdminClient();
  if (!admin) return [];

  const ids = [...new Set(assignmentIds)];
  const { data: assignments } = await admin
    .from("assessment_assignments")
    .select("id, template_id, employee_id, wave")
    .in("id", ids)
    .is("deleted_at", null);
  if (!assignments?.length) return [];

  const templateIds = [...new Set(assignments.map((row) => row.template_id))];
  const employeeIds = [...new Set(assignments.map((row) => row.employee_id))];
  const assignmentIdList = assignments.map((row) => row.id);

  const [{ data: templates }, { data: employees }, { data: items }, { data: raters }] = await Promise.all([
    admin.from("assessment_templates").select("id, name, kind").in("id", templateIds).is("deleted_at", null),
    admin.from("employees").select("employee_id, full_name").in("employee_id", employeeIds),
    admin
      .from("assessment_items")
      .select("id, template_id, sort_order, group_name, name, indicator, scenario, option_a, option_b, option_c, option_d")
      .in("template_id", templateIds)
      .order("sort_order"),
    admin
      .from("assessment_raters")
      .select("id, assignment_id, rater_user_id, rater_type, status")
      .in("assignment_id", assignmentIdList)
      .order("created_at"),
  ]);

  const raterIds = (raters ?? []).map((row) => row.id);
  const userIds = [...new Set((raters ?? []).map((row) => row.rater_user_id))];
  const [{ data: profiles }, { data: responses }] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
    raterIds.length
      ? admin
          .from("assessment_responses")
          .select("rater_id, item_id, rating, not_observed, scenario_answer, evidence")
          .in("rater_id", raterIds)
      : Promise.resolve({ data: [] as { rater_id: string; item_id: string; rating: number | null; not_observed: boolean; scenario_answer: Letter | null; evidence: string | null }[] }),
  ]);

  const templateById = new Map((templates ?? []).map((row) => [row.id, row]));
  const employeeById = new Map((employees ?? []).map((row) => [row.employee_id, row.full_name]));
  const profileById = new Map((profiles ?? []).map((row) => [row.id, row.full_name ?? row.email]));
  const responsesByRaterAndItem = new Map((responses ?? []).map((row) => [`${row.rater_id}:${row.item_id}`, row]));

  return assignments.flatMap((assignment) => {
    const template = templateById.get(assignment.template_id);
    if (!template) return [];
    const employeeName = employeeById.get(assignment.employee_id) ?? assignment.employee_id;
    const assignmentRaters = (raters ?? []).filter((row) => row.assignment_id === assignment.id);
    const templateItems = (items ?? []).filter((item) => item.template_id === assignment.template_id);

    return [{
      assignmentId: assignment.id,
      templateName: template.name,
      kind: template.kind,
      wave: assignment.wave,
      employeeName,
      questions: templateItems.map((item) => ({
        id: item.id,
        sortOrder: item.sort_order,
        groupName: item.group_name,
        name: item.name,
        indicator: item.indicator,
        scenario: item.scenario,
        answers: assignmentRaters.map((rater) => {
          const response = responsesByRaterAndItem.get(`${rater.id}:${item.id}`);
          const answer = response?.scenario_answer ?? null;
          const options: Record<Letter, string | null> = {
            A: item.option_a,
            B: item.option_b,
            C: item.option_c,
            D: item.option_d,
          };
          return {
            raterId: rater.id,
            raterName: rater.rater_type === "self" ? employeeName : profileById.get(rater.rater_user_id) ?? "Unknown rater",
            raterType: rater.rater_type,
            status: rater.status,
            rating: response?.rating ?? null,
            notObserved: response?.not_observed ?? false,
            scenarioAnswer: answer,
            scenarioAnswerText: answer ? options[answer] : null,
            evidence: response?.evidence ?? null,
          };
        }),
      })),
    }];
  });
}
