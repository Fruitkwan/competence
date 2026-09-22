import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadAssignmentResult, type Viewer } from "@/lib/assessments/results";
import type { OrgAssessment } from "./organization-chart";

/** Uses the same row visibility and score/release gate as assessment reports. */
export async function loadOrgAssessments(client: SupabaseClient<Database>, viewer: Viewer) {
  const staff = viewer.role !== "employee";
  let query = client.from("assessment_assignments")
    .select("id, employee_id, template_id, wave, submitted_at, results_released")
    .not("submitted_at", "is", null).order("submitted_at", { ascending: false });
  if (!staff) {
    if (!viewer.employeeId) return new Map<string, OrgAssessment[]>();
    query = query.eq("employee_id", viewer.employeeId).eq("results_released", true);
  }
  const { data: rows, error } = await query;
  if (error) throw new Error("Unable to load organization assessment results");
  // Keep the latest completed attempt for each employee/instrument.
  const seen = new Set<string>();
  const latest = (rows ?? []).filter((row) => {
    const key = `${row.employee_id}:${row.template_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ids = latest.map((row) => row.id);
  const { data: raters, error: raterError } = staff && ids.length
    ? await client.from("assessment_raters").select("assignment_id, rater_user_id").in("assignment_id", ids).neq("rater_type", "self")
    : { data: [], error: null };
  if (raterError) throw new Error("Unable to load assigned rater names");
  const userIds = [...new Set((raters ?? []).map((rater) => rater.rater_user_id))];
  const { data: profiles, error: profileError } = userIds.length
    ? await client.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [], error: null };
  if (profileError) throw new Error("Unable to load rater profiles");
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const result = new Map<string, OrgAssessment[]>();
  // Bound concurrent report calculations for large directories.
  for (let offset = 0; offset < latest.length; offset += 6) {
    const batch = await Promise.all(latest.slice(offset, offset + 6).map(async (row) => ({ row, report: await loadAssignmentResult(row.id, viewer, client) })));
    for (const { row, report } of batch) {
      if (!report) continue;
      const summary: OrgAssessment = {
        id: row.id, name: report.template.name, wave: row.wave,
        score: report.score.index, provisional: report.score.provisional,
        raters: staff ? [...new Set((raters ?? []).filter((rater) => rater.assignment_id === row.id).map((rater) => names.get(rater.rater_user_id) || "Name unavailable"))] : null,
      };
      result.set(row.employee_id, [...(result.get(row.employee_id) ?? []), summary]);
    }
  }
  return result;
}
