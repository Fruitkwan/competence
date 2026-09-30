import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";
import { loadPlacementReport } from "@/lib/assessments/placement";
import { renderEmployeeReportPdf, renderPlacementReportPdf } from "@/lib/assessments/report-export";
import { getViewer, loadEmployeeReport } from "@/lib/assessments/results";

export const runtime = "nodejs";
export const maxDuration = 300;

type AssignmentRow = {
  id: string;
  template_id: string;
  employee_id: string;
  wave: string | null;
  status: string;
  created_at: string;
};

type ReportJob = {
  assignment: AssignmentRow;
  kind: "standard" | "placement";
};

function filePart(value: string, fallback: string) {
  const cleaned = [...value]
    .map((character) => (character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? "-" : character))
    .join("")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });
  if (viewer.role !== "admin") return new NextResponse("Only HR/Admin can export department reports.", { status: 403 });

  const department = new URL(request.url).searchParams.get("department")?.trim() ?? "";
  if (!department || department.length > 120) return new NextResponse("Select a valid department.", { status: 400 });

  const supabase = await createClient();
  const { data: employees, error: employeeError } = await supabase
    .from("employees")
    .select("employee_id, full_name")
    .eq("active", true)
    .eq("department", department)
    .order("full_name");
  if (employeeError) return new NextResponse("Could not load department employees.", { status: 500 });
  if (!employees?.length) return new NextResponse("No active employees were found in this department.", { status: 404 });

  const { data: assignments, error: assignmentError } = await supabase
    .from("assessment_assignments")
    .select("id, template_id, employee_id, wave, status, created_at")
    .in("employee_id", employees.map((employee) => employee.employee_id))
    .in("status", ["submitted", "closed"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (assignmentError) return new NextResponse("Could not load completed assessments.", { status: 500 });
  if (!assignments?.length) return new NextResponse("This department has no submitted assessment reports yet.", { status: 404 });

  const { data: templates, error: templateError } = await supabase
    .from("assessment_templates")
    .select("id, kind")
    .in("id", [...new Set(assignments.map((assignment) => assignment.template_id))]);
  if (templateError) return new NextResponse("Could not load assessment templates.", { status: 500 });

  const templateKind = new Map((templates ?? []).map((template) => [template.id, template.kind]));
  const employeeName = new Map(employees.map((employee) => [employee.employee_id, employee.full_name]));
  const combined = new Map<string, AssignmentRow>();
  const placement: AssignmentRow[] = [];

  for (const assignment of assignments as AssignmentRow[]) {
    if (templateKind.get(assignment.template_id) === "placement") {
      placement.push(assignment);
      continue;
    }
    const key = `${assignment.employee_id}\u0000${assignment.wave ?? "no-wave"}`;
    if (!combined.has(key)) combined.set(key, assignment);
  }

  const jobs: ReportJob[] = [
    ...[...combined.values()].map((assignment) => ({ assignment, kind: "standard" as const })),
    ...placement.map((assignment) => ({ assignment, kind: "placement" as const })),
  ];
  if (!jobs.length) return new NextResponse("This department has no supported submitted reports.", { status: 404 });

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const manifest: string[][] = [["Employee ID", "Employee", "Wave", "Report type", "Result", "File"]];
  let included = 0;

  for (let offset = 0; offset < jobs.length; offset += 3) {
    const batch = jobs.slice(offset, offset + 3);
    const results = await Promise.all(
      batch.map(async (job) => {
        try {
          if (job.kind === "placement") {
            const report = await loadPlacementReport(job.assignment.id, viewer, supabase);
            if (!report) return { job, error: "Report data was unavailable." };
            return { job, bytes: await renderPlacementReportPdf(report) };
          }
          const report = await loadEmployeeReport(job.assignment.id, viewer, supabase);
          if (!report) return { job, error: "Report data was unavailable." };
          return { job, bytes: await renderEmployeeReportPdf(report) };
        } catch (error) {
          return { job, error: error instanceof Error ? error.message : "PDF generation failed." };
        }
      }),
    );

    for (const result of results) {
      const { assignment } = result.job;
      const name = employeeName.get(assignment.employee_id) ?? assignment.employee_id;
      const wave = assignment.wave ?? "No wave";
      if ("bytes" in result && result.bytes) {
        const base = filePart(`${assignment.employee_id} - ${name} - ${wave}${result.job.kind === "placement" ? " - Placement" : ""}`, assignment.employee_id);
        let filename = `${base}.pdf`;
        let suffix = 2;
        while (usedNames.has(filename.toLowerCase())) filename = `${base}-${suffix++}.pdf`;
        usedNames.add(filename.toLowerCase());
        zip.file(filename, result.bytes);
        included += 1;
        manifest.push([assignment.employee_id, name, wave, result.job.kind, "Included", filename]);
      } else {
        manifest.push([assignment.employee_id, name, wave, result.job.kind, result.error ?? "Skipped", ""]);
      }
    }
  }

  if (!included) return new NextResponse("No PDF reports could be generated for this department.", { status: 422 });

  zip.file("report-manifest.csv", manifest.map((row) => row.map(csvCell).join(",")).join("\r\n"));
  const archive = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const responseBody = archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer;
  const today = new Date().toISOString().slice(0, 10);
  const filename = `assessment-reports-${filePart(department.toLowerCase(), "department")}-${today}.zip`;

  return new NextResponse(responseBody, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
