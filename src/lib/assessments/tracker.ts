import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type DbClient = SupabaseClient<Database>;

export type TrackerRow = {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  managerName: string | null;
  assessment: string;
  kind: string;
  wave: string | null;
  dueDate: string | null;
  status: string;
  selfDone: boolean;
  managerDone: boolean;
  peerDone: number;
  peerTotal: number;
  /** Names (+type) of raters who still owe a response. */
  waitingOn: string[];
};

export type TrackerDepartment = {
  name: string;
  rows: TrackerRow[];
  /** Assignments with self submitted (or status submitted/closed). */
  selfIn: number;
  managerIn: number;
  peerIn: number;
  peerTotal: number;
  complete: number;
};

export type RaterChase = {
  name: string;
  assigned: number;
  done: number;
  /** Employee names the rater still owes a rating for. */
  outstandingFor: string[];
};

export type TrackerData = {
  departments: TrackerDepartment[];
  raters: RaterChase[];
};

const RATER_LABEL: Record<string, string> = {
  self: "self",
  line_manager: "line manager",
  cross_dept: "cross-dept",
  peer: "peer",
};

/** Bulk progress/chase data for the admin tracker tab — one pass over every assignment. */
export async function loadAssessmentTracker(client?: DbClient): Promise<TrackerData> {
  const supabase = client ?? (await createClient());
  const admin = createAdminClient() ?? supabase;

  const { data: assignments } = await admin
    .from("assessment_assignments")
    .select("id, template_id, employee_id, wave, due_date, status, submitted_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  const rows = assignments ?? [];
  if (!rows.length) return { departments: [], raters: [] };

  const [{ data: raters }, { data: employees }, { data: templates }] = await Promise.all([
    admin
      .from("assessment_raters")
      .select("id, assignment_id, rater_user_id, rater_type, status")
      .in("assignment_id", rows.map((r) => r.id)),
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title, department, manager_name")
      .in("employee_id", [...new Set(rows.map((r) => r.employee_id))]),
    admin
      .from("assessment_templates")
      .select("id, kind, name, role_family")
      .in("id", [...new Set(rows.map((r) => r.template_id))]),
  ]);

  const raterUserIds = [...new Set((raters ?? []).map((r) => r.rater_user_id))];
  const { data: profiles } = raterUserIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", raterUserIds)
    : { data: [] };

  const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));
  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown rater"]));
  const ratersByAssignment = new Map<string, NonNullable<typeof raters>>();
  for (const r of raters ?? []) {
    const list = ratersByAssignment.get(r.assignment_id) ?? [];
    list.push(r);
    ratersByAssignment.set(r.assignment_id, list);
  }

  const chase = new Map<string, RaterChase>();
  const departments = new Map<string, TrackerDepartment>();

  for (const a of rows) {
    const emp = empById.get(a.employee_id);
    const tpl = tplById.get(a.template_id);
    const rs = ratersByAssignment.get(a.id) ?? [];

    const self = rs.find((r) => r.rater_type === "self");
    const selfDone = self?.status === "submitted" || a.status === "submitted" || a.status === "closed";
    const manager = rs.find((r) => r.rater_type === "line_manager");
    const peers = rs.filter((r) => r.rater_type === "peer" || r.rater_type === "cross_dept");
    const waitingOn = rs
      .filter((r) => r.rater_type !== "self" && r.status !== "submitted")
      .map((r) => `${nameByUser.get(r.rater_user_id) ?? "Unknown rater"} (${RATER_LABEL[r.rater_type] ?? r.rater_type})`);

    const row: TrackerRow = {
      assignmentId: a.id,
      employeeId: a.employee_id,
      employeeName: emp?.full_name ?? a.employee_id,
      jobTitle: emp?.job_title ?? null,
      managerName: emp?.manager_name ?? null,
      assessment: tpl?.role_family ?? tpl?.name ?? "Assessment",
      kind: tpl?.kind ?? "skill",
      wave: a.wave,
      dueDate: a.due_date,
      status: a.status,
      selfDone,
      managerDone: manager?.status === "submitted",
      peerDone: peers.filter((r) => r.status === "submitted").length,
      peerTotal: peers.length,
      waitingOn,
    };

    const deptName = emp?.department?.trim() || "Unassigned";
    const dept = departments.get(deptName) ?? { name: deptName, rows: [], selfIn: 0, managerIn: 0, peerIn: 0, peerTotal: 0, complete: 0 };
    dept.rows.push(row);
    if (row.selfDone) dept.selfIn += 1;
    if (row.managerDone) dept.managerIn += 1;
    dept.peerIn += row.peerDone;
    dept.peerTotal += row.peerTotal;
    if (row.selfDone && row.managerDone && row.peerDone >= row.peerTotal) dept.complete += 1;
    departments.set(deptName, dept);

    for (const r of rs.filter((r) => r.rater_type !== "self")) {
      const key = r.rater_user_id;
      const entry = chase.get(key) ?? { name: nameByUser.get(key) ?? "Unknown rater", assigned: 0, done: 0, outstandingFor: [] };
      entry.assigned += 1;
      if (r.status === "submitted") entry.done += 1;
      else entry.outstandingFor.push(`${row.employeeName} (${RATER_LABEL[r.rater_type] ?? r.rater_type})`);
      chase.set(key, entry);
    }
  }

  for (const dept of departments.values()) dept.rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return {
    departments: [...departments.values()].sort((a, b) => a.name.localeCompare(b.name)),
    raters: [...chase.values()].sort((a, b) => b.assigned - b.done - (a.assigned - a.done) || a.name.localeCompare(b.name)),
  };
}
