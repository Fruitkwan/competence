import { createBearerClient } from "@/lib/api/mobile-auth";
import { getViewer, loadEmployeeReport } from "@/lib/assessments/results";
import { loadPlacementReport } from "@/lib/assessments/placement";
import { createAdminClient } from "@/lib/supabase/admin";

/** Returns the report for one assignment (mobile app). Placement reports carry a `placement` marker. */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const supabase = createBearerClient(request);
  if (!supabase) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const viewer = await getViewer(supabase);
  if (!viewer) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const { data: assignment } = await supabase
    .from("assessment_assignments")
    .select("template_id")
    .eq("id", id)
    .maybeSingle();
  if (!assignment) return Response.json({ error: "Not found" }, { status: 404 });

  const db = createAdminClient() ?? supabase;
  const { data: template } = await db
    .from("assessment_templates")
    .select("kind")
    .eq("id", assignment.template_id)
    .maybeSingle();

  if (template?.kind === "placement") {
    const placement = await loadPlacementReport(id, viewer, supabase);
    if (!placement) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ placement: true, report: placement });
  }

  const report = await loadEmployeeReport(id, viewer, supabase);
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(report);
}
