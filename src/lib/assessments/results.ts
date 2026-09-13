import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  placeOnGrid,
  resolveScoring,
  scorePerson,
  SKILL_WILL_ACTIONS,
  type AssessmentKind,
  type ItemInput,
  type PersonScore,
  type SkillWillGroup,
} from "./scoring";

type Tables = Database["public"]["Tables"];
export type Assignment = Tables["assessment_assignments"]["Row"];
export type Template = Tables["assessment_templates"]["Row"];
export type Item = Tables["assessment_items"]["Row"];
export type Rater = Tables["assessment_raters"]["Row"];
export type Response = Tables["assessment_responses"]["Row"];

export type Viewer = {
  userId: string;
  role: "admin" | "manager" | "employee" | "executive";
  employeeId: string | null;
  fullName: string | null;
};

export type AssignmentResult = {
  assignment: Assignment;
  template: Template;
  items: Item[];
  score: PersonScore;
  raters: { type: Rater["rater_type"]; status: Rater["status"] }[];
};

export type EmployeeReport = {
  employee: { employee_id: string; full_name: string; job_title: string; department: string | null; country_code: string | null; manager_name: string | null };
  skill: AssignmentResult | null;
  behaviour: AssignmentResult | null;
  grid: { group: SkillWillGroup; action: string } | null;
  /** Whether the viewer is the assessed employee (limits detail shown). */
  isSelf: boolean;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id, full_name")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role, employeeId: profile.employee_id, fullName: profile.full_name };
}

function dataClient() {
  return createAdminClient();
}

/** Loads one assignment and scores it. Returns null when not found or not permitted. */
export async function loadAssignmentResult(assignmentId: string, viewer: Viewer): Promise<AssignmentResult | null> {
  const user = await createClient();
  const { data: assignment } = await user
    .from("assessment_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return null;

  const isSelf = assignment.employee_user_id === viewer.userId || (viewer.employeeId != null && assignment.employee_id === viewer.employeeId);
  const isStaff = viewer.role !== "employee";
  if (!isStaff && !(isSelf && assignment.results_released)) return null;

  return scoreAssignment(assignment);
}

async function scoreAssignment(assignment: Assignment): Promise<AssignmentResult | null> {
  const admin = dataClient() ?? (await createClient());
  const [{ data: template }, { data: items }, { data: raters }] = await Promise.all([
    admin.from("assessment_templates").select("*").eq("id", assignment.template_id).single(),
    admin.from("assessment_items").select("*").eq("template_id", assignment.template_id).order("sort_order"),
    admin.from("assessment_raters").select("*").eq("assignment_id", assignment.id),
  ]);
  if (!template || !items) return null;

  const raterIds = (raters ?? []).map((r) => r.id);
  const [{ data: responses }, { data: keys }] = await Promise.all([
    raterIds.length
      ? admin.from("assessment_responses").select("*").in("rater_id", raterIds)
      : Promise.resolve({ data: [] as Response[] }),
    admin.from("assessment_item_keys").select("item_id, answer_key").in("item_id", items.map((i) => i.id)),
  ]);

  const keyByItem = new Map((keys ?? []).map((k) => [k.item_id, k.answer_key]));
  const raterById = new Map((raters ?? []).map((r) => [r.id, r]));
  const kind = template.kind as AssessmentKind;

  const inputs: ItemInput[] = items.map((item) => {
    const rs = (responses ?? []).filter((r) => r.item_id === item.id);
    const input: ItemInput = {
      item_id: item.id,
      name: item.name,
      group_name: item.group_name,
      self: null,
      line_manager: null,
      others: [],
      scenario_correct: null,
      not_observed_count: 0,
      rater_count: 0,
    };
    for (const r of rs) {
      const rater = raterById.get(r.rater_id);
      if (!rater || rater.status !== "submitted") continue;
      if (rater.rater_type === "self") {
        input.self = r.rating;
        const key = keyByItem.get(item.id);
        if (r.scenario_answer && key) input.scenario_correct = r.scenario_answer === key;
        continue;
      }
      input.rater_count += 1;
      if (r.not_observed || r.rating == null) {
        input.not_observed_count += 1;
        continue;
      }
      if (rater.rater_type === "line_manager") input.line_manager = r.rating;
      else input.others.push(r.rating);
    }
    return input;
  });

  const score = scorePerson(kind, inputs, resolveScoring(kind, template.scoring));
  return {
    assignment,
    template,
    items,
    score,
    raters: (raters ?? []).map((r) => ({ type: r.rater_type, status: r.status })),
  };
}

/**
 * Builds the combined report for an employee: latest skill + latest behaviour
 * assignment (same wave preferred), placed on the skill/will grid.
 */
export async function loadEmployeeReport(assignmentId: string, viewer: Viewer): Promise<EmployeeReport | null> {
  const primary = await loadAssignmentResult(assignmentId, viewer);
  if (!primary) return null;

  const user = await createClient();
  const { data: employee } = await user
    .from("employees")
    .select("employee_id, full_name, job_title, department, country_code, manager_name")
    .eq("employee_id", primary.assignment.employee_id)
    .single();
  if (!employee) return null;

  const otherKind: AssessmentKind = primary.template.kind === "skill" ? "behaviour" : "skill";
  const { data: otherTemplates } = await user.from("assessment_templates").select("id").eq("kind", otherKind);
  const otherTemplateIds = (otherTemplates ?? []).map((t) => t.id);
  const { data: candidates } = otherTemplateIds.length
    ? await user
        .from("assessment_assignments")
        .select("id, wave")
        .eq("employee_id", employee.employee_id)
        .in("template_id", otherTemplateIds)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; wave: string | null }[] };

  const sameWave = (candidates ?? []).find((c) => c.wave && c.wave === primary.assignment.wave);
  const companionRow = sameWave ?? (candidates ?? [])[0] ?? null;
  const companion = companionRow ? await loadAssignmentResult(companionRow.id, viewer) : null;

  const skill = primary.template.kind === "skill" ? primary : companion;
  const behaviour = primary.template.kind === "behaviour" ? primary : companion;

  const cutoff = resolveScoring("skill", skill?.template.scoring).grid_cutoff;
  const group = placeOnGrid(skill?.score.index ?? null, behaviour?.score.will_index ?? null, cutoff);

  const isSelf =
    primary.assignment.employee_user_id === viewer.userId ||
    (viewer.employeeId != null && primary.assignment.employee_id === viewer.employeeId);

  return {
    employee: { ...employee, department: employee.department ?? null },
    skill,
    behaviour,
    grid: group ? { group, action: SKILL_WILL_ACTIONS[group] } : null,
    isSelf: isSelf && viewer.role === "employee",
  };
}
