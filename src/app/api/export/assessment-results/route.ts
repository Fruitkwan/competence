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

function safeCell(value: string | null | undefined) {
  const text = value ?? "";
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function filePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "department";
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  if (viewer.role !== "admin" && viewer.role !== "executive") return new NextResponse("Forbidden", { status: 403 });

  const requestedDepartment = new URL(request.url).searchParams.get("department")?.trim() ?? "";
  if (requestedDepartment && viewer.role !== "admin") {
    return new NextResponse("Only HR/Admin can export a whole department.", { status: 403 });
  }
  if (requestedDepartment.length > 120) return new NextResponse("Invalid department.", { status: 400 });

  const supabase = await createClient();
  const { data: departmentEmployees, error: departmentError } = requestedDepartment
    ? await supabase
        .from("employees")
        .select("employee_id, full_name, job_title, department")
        .eq("active", true)
        .eq("department", requestedDepartment)
        .order("full_name")
    : { data: null, error: null };
  if (departmentError) return new NextResponse("Could not load department employees.", { status: 500 });
  if (requestedDepartment && !departmentEmployees?.length) {
    return new NextResponse("No active employees were found in this department.", { status: 404 });
  }

  let assignmentQuery = supabase
    .from("assessment_assignments")
    .select("id, template_id, employee_id, wave, due_date, status, results_released, submitted_at, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (departmentEmployees?.length) {
    assignmentQuery = assignmentQuery.in("employee_id", departmentEmployees.map((employee) => employee.employee_id));
  }
  const { data: assignments, error: assignmentsError } = await assignmentQuery;
  if (assignmentsError) return new NextResponse("Could not load assessment assignments.", { status: 500 });

  const rows = assignments ?? [];
  const [{ data: employees }, { data: templates }] = await Promise.all([
    departmentEmployees
      ? Promise.resolve({ data: departmentEmployees })
      : rows.length
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
      "Employee Name": safeCell(emp?.full_name),
      "Job Title": safeCell(emp?.job_title),
      Department: safeCell(emp?.department),
      Assessment: safeCell(tpl?.role_family ?? tpl?.name),
      Kind: safeCell(tpl?.kind === "placement" ? "skill" : tpl?.kind),
      Wave: safeCell(a.wave),
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
  const scoredRows = sheetRows.filter((row) => typeof row.Index === "number");
  const submitted = rows.filter((row) => row.status === "submitted" || row.status === "closed").length;
  const summaryRows = [
    { Metric: "Scope", Value: requestedDepartment || "All visible departments" },
    { Metric: "Active employees", Value: requestedDepartment ? departmentEmployees?.length ?? 0 : new Set(rows.map((row) => row.employee_id)).size },
    { Metric: "Assessment assignments", Value: rows.length },
    { Metric: "Submitted / closed", Value: submitted },
    { Metric: "Pending", Value: rows.length - submitted },
    { Metric: "Completion", Value: rows.length ? `${Math.round((submitted / rows.length) * 100)}%` : "0%" },
    { Metric: "Scored results", Value: scoredRows.length },
    { Metric: "Average index", Value: scoredRows.length ? Number((scoredRows.reduce((sum, row) => sum + Number(row.Index), 0) / scoredRows.length).toFixed(1)) : "" },
    { Metric: "Strength", Value: sheetRows.filter((row) => row.Band === "Strength").length },
    { Metric: "Meets standard", Value: sheetRows.filter((row) => row.Band === "Meets standard").length },
    { Metric: "Development gap", Value: sheetRows.filter((row) => row.Band === "Development gap").length },
    { Metric: "Material gap", Value: sheetRows.filter((row) => row.Band === "Material gap").length },
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 24 }, { wch: 28 }];
  const resultsSheet = XLSX.utils.json_to_sheet(sheetRows);
  resultsSheet["!cols"] = [
    { wch: 16 }, { wch: 30 }, { wch: 28 }, { wch: 24 }, { wch: 34 }, { wch: 14 },
    { wch: 18 }, { wch: 13 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 18 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 8 },
  ];
  if (resultsSheet["!ref"]) resultsSheet["!autofilter"] = { ref: resultsSheet["!ref"] };
  XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(wb, resultsSheet, "Assessment Results");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const today = new Date().toISOString().slice(0, 10);
  const filename = requestedDepartment
    ? `assessment-results-${filePart(requestedDepartment)}-${today}.xlsx`
    : `assessment-results-${today}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
