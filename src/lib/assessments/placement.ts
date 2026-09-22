import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  decidePlacement,
  parseRecordScores,
  scorePlacementPaper,
  type PlacementOutcome,
  type PlacementPartScore,
  type RecordScores,
} from "./placement-scoring";
import type {
  Assignment,
  Rater,
  ReportSignature,
  Response,
  SignSlot,
  Template,
  Viewer,
} from "./results";

export type {
  PlacementAnswer,
  PlacementOutcome,
  PlacementPartScore,
  RecordScores,
} from "./placement-scoring";

type DbClient = SupabaseClient<Database>;

export type RaterEvidence = {
  itemId: string;
  name: string;
  group: string | null;
  managerAvg: number | null;
  othersAvg: number | null;
  othersCount: number;
  /** Manager vs outside-rater gap of 2+ points — a calibration finding. */
  divergence: boolean;
};

export type PlacementReport = {
  employee: {
    employee_id: string;
    full_name: string;
    job_title: string;
    department: string | null;
    country_code: string | null;
    manager_name: string | null;
  };
  template: Pick<Template, "id" | "name" | "kind" | "role_family" | "department">;
  assignment: Pick<
    Assignment,
    "id" | "wave" | "due_date" | "status" | "results_released" | "submitted_at"
  >;
  parts: PlacementPartScore[];
  outcome: PlacementOutcome;
  raterEvidence: RaterEvidence[];
  raters: { type: Rater["rater_type"]; status: Rater["status"] }[];
  record: RecordScores;
  isSelf: boolean;
  signatures: Partial<Record<SignSlot, ReportSignature>>;
  canSign: Record<SignSlot, boolean>;
  canEnterRecord: boolean;
};

/** Loads the placement report for one assignment. Same gate as the standard report. */
export async function loadPlacementReport(
  assignmentId: string,
  viewer: Viewer,
  client?: DbClient,
): Promise<PlacementReport | null> {
  const user = client ?? (await createClient());
  const { data: assignment } = await user
    .from("assessment_assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return null;

  const isSelf =
    assignment.employee_user_id === viewer.userId ||
    (viewer.employeeId != null && assignment.employee_id === viewer.employeeId);
  const isStaff = viewer.role !== "employee";
  if (!isStaff && !(isSelf && assignment.results_released)) return null;

  const admin = createAdminClient() ?? user;
  const [{ data: template }, { data: items }, { data: raters }, { data: employee }] =
    await Promise.all([
      admin
        .from("assessment_templates")
        .select("*")
        .eq("id", assignment.template_id)
        .single(),
      admin
        .from("assessment_items")
        .select("*")
        .eq("template_id", assignment.template_id)
        .order("sort_order"),
      admin
        .from("assessment_raters")
        .select("*")
        .eq("assignment_id", assignment.id),
      user
        .from("employees")
        .select(
          "employee_id, full_name, job_title, department, country_code, manager_name",
        )
        .eq("employee_id", assignment.employee_id)
        .single(),
    ]);
  if (!template || template.kind !== "placement" || !items || !employee)
    return null;

  const raterRows = raters ?? [];
  const raterIds = raterRows.map((r) => r.id);
  const [{ data: responses }, { data: keys }] = await Promise.all([
    raterIds.length
      ? admin
          .from("assessment_responses")
          .select("*")
          .in("rater_id", raterIds)
      : Promise.resolve({ data: [] as Response[] }),
    items.length
      ? admin
          .from("assessment_item_keys")
          .select("item_id, answer_key, option_points, rationale")
          .in(
            "item_id",
            items.map((i) => i.id),
          )
      : Promise.resolve({ data: [] }),
  ]);

  const optionPointsByItem = new Map(
    (keys ?? [])
      .filter((k) => k.option_points != null)
      .map((k) => [k.item_id, k.option_points as Record<string, number>]),
  );

  const selfRater = raterRows.find((r) => r.rater_type === "self");
  const selfResponses = (responses ?? []).filter(
    (r) => r.rater_id === selfRater?.id,
  );

  const parts = scorePlacementPaper(items, optionPointsByItem, selfResponses);
  const record = parseRecordScores(assignment.record_scores);
  const outcome = decidePlacement(parts, record);

  // Rater evidence: averages only, never attributed to a named rater.
  const raterById = new Map(raterRows.map((r) => [r.id, r]));
  const submittedIds = new Set(
    raterRows.filter((r) => r.status === "submitted").map((r) => r.id),
  );
  const raterEvidence: RaterEvidence[] = items.map((item) => {
    const rs = (responses ?? []).filter(
      (r) =>
        r.item_id === item.id &&
        submittedIds.has(r.rater_id) &&
        !r.not_observed &&
        r.rating != null &&
        raterById.get(r.rater_id)?.rater_type !== "self",
    );
    const mgr = rs.filter(
      (r) => raterById.get(r.rater_id)?.rater_type === "line_manager",
    );
    const others = rs.filter(
      (r) => raterById.get(r.rater_id)?.rater_type !== "line_manager",
    );
    const avg = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const managerAvg = avg(mgr.map((r) => r.rating!));
    const othersAvg = avg(others.map((r) => r.rating!));
    return {
      itemId: item.id,
      name: item.name,
      group: item.group_name,
      managerAvg,
      othersAvg,
      othersCount: others.length,
      divergence:
        managerAvg != null && othersAvg != null
          ? Math.abs(managerAvg - othersAvg) >= 2
          : false,
    };
  });

  const [{ data: managesByName }, { data: managesByProfile }] =
    viewer.role === "manager"
      ? await Promise.all([
          user
            .from("employees")
            .select("employee_id")
            .eq("employee_id", employee.employee_id)
            .eq("manager_name", viewer.fullName ?? "")
            .maybeSingle(),
          user
            .from("profiles")
            .select("id")
            .eq("employee_id", employee.employee_id)
            .eq("manager_id", viewer.userId)
            .maybeSingle(),
        ])
      : [{ data: null }, { data: null }];

  return {
    employee: { ...employee, department: employee.department ?? null },
    template: {
      id: template.id,
      name: template.name,
      kind: template.kind,
      role_family: template.role_family,
      department: template.department,
    },
    assignment: {
      id: assignment.id,
      wave: assignment.wave,
      due_date: assignment.due_date,
      status: assignment.status,
      results_released: assignment.results_released,
      submitted_at: assignment.submitted_at,
    },
    parts,
    outcome,
    raterEvidence,
    raters: raterRows.map((r) => ({ type: r.rater_type, status: r.status })),
    record,
    isSelf: isSelf && viewer.role === "employee",
    signatures: (assignment.report_signatures ?? {}) as Partial<
      Record<SignSlot, ReportSignature>
    >,
    canSign: {
      employee: isSelf,
      manager:
        viewer.role === "admin" || Boolean(managesByName || managesByProfile),
      hr: viewer.role === "admin",
    },
    canEnterRecord: isStaff,
  };
}
