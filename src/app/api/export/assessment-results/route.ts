import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { getViewer, loadAssignmentResult } from "@/lib/assessments/results";

function band(score: number | null) {
  if (score == null) return "";
  if (score >= 75) return "Strength";
  if (score >= 60) return "Meets standard";
  if (score >= 45) return "Development gap";
  return "Material gap";
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  if (viewer.role === "employee") return new NextResponse("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data: assignments } = await supabase
    .from("assessment_assignments")
    .select("id, template_id, employee_id, wave, due_date, status, results_released, submitted_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = assignments ?? [];
  const [{ data: employees }, { data: templates }] = await Promise.all([
    rows.length
      ? supabase.from("employees").select("employee_id, full_name, job_title, department").in("employee_id", [...new Set(rows.map((r) => r.employee_id))])
      : { data: [] },
    rows.length
      ? supabase.from("assessment_templates").select("id, kind, name, role_family").in("id", [...new Set(rows.map((r) => r.template_id))])
      : { data: [] },
  ]);
  const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));

  const scored = await Promise.all(rows.map((a) => loadAssignmentResult(a.id, viewer)));

  const sheetRows = rows.map((a, i) => {
    const emp = empById.get(a.employee_id);
    const tpl = tplById.get(a.template_id);
    const result = scored[i];
    const index = result?.score.index ?? null;
    const nonSelf = result?.raters.filter((r) => r.type !== "self") ?? [];
    const flags = (result?.score.warnings ?? []).filter((w) => w.code !== "provisional").length;
    return {
      "Employee ID": a.employee_id,
      "Employee Name": emp?.full_name ?? "",
      "Job Title": emp?.job_title ?? "",
      Department: emp?.department ?? "",
      Assessment: tpl?.role_family ?? tpl?.name ?? "",
      Kind: tpl?.kind === "placement" ? "skill" : (tpl?.kind ?? ""),
      Wave: a.wave ?? "",
      "Due Date": a.due_date ?? "",
      Status: a.status.replace("_", " "),
      Released: a.results_released ? "Y" : "N",
      Index: index ?? "",
      Band: band(index),
      Provisional: result?.score.provisional ? "Y" : "",
      "Raters in": nonSelf.filter((r) => r.status === "submitted").length,
      "Raters total": nonSelf.length,
      Flags: flags || "",
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), "Assessment Results");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="assessment-results-${today}.xlsx"`,
    },
  });
}
