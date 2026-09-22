import { createBearerClient } from "@/lib/api/mobile-auth";
import { getViewer } from "@/lib/assessments/results";
import { createAdminClient } from "@/lib/supabase/admin";

/** Lists the caller's own assessment assignments for the mobile app. */
export async function GET(request: Request) {
  const supabase = createBearerClient(request);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await getViewer(supabase);
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const own = viewer.employeeId
    ? `employee_user_id.eq.${viewer.userId},employee_id.eq.${viewer.employeeId}`
    : `employee_user_id.eq.${viewer.userId}`;
  const { data: assignments, error } = await supabase
    .from("assessment_assignments")
    .select("id, template_id, wave, due_date, status, results_released, submitted_at, created_at")
    .or(own)
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Templates may be archived and invisible to non-staff under RLS; read them
  // through the admin client when available (assignments are already authorized).
  const ids = [...new Set((assignments ?? []).map((a) => a.template_id))];
  const db = createAdminClient() ?? supabase;
  const { data: templates } = ids.length
    ? await db.from("assessment_templates").select("id, name, kind, role_family").in("id", ids)
    : { data: [] };
  const byId = new Map((templates ?? []).map((t) => [t.id, t]));

  return Response.json(
    (assignments ?? []).map((a) => ({ ...a, template: byId.get(a.template_id) ?? null }))
  );
}
