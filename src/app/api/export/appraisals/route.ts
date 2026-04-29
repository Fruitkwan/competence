import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("appraisal_full")
    .select(
      "employee_id, full_name, job_title, country_code, manager_name, cluster, kpi_linked, required_level, required_numeric, appraisal_date, knowledge, skill, behaviour, desire, attitude, current_avg, gap, priority, dominant_gap_code, recommended_course, training_mode, training_start, target_completion, actual_completion, status, overdue, reassessment_avg, evidence_url, notes"
    )
    .order("appraisal_date", { ascending: false });

  if (error) return new NextResponse(error.message, { status: 500 });

  const rows = (data ?? []).map((r) => ({
    "Employee ID": r.employee_id,
    "Employee Name": r.full_name,
    "Job Title": r.job_title,
    Country: r.country_code,
    Manager: r.manager_name,
    Cluster: r.cluster,
    "KPI Linked": r.kpi_linked,
    "Required Level": r.required_level,
    "Req #": r.required_numeric,
    "Appraisal Date": r.appraisal_date,
    Knowledge: r.knowledge,
    Skill: r.skill,
    Behaviour: r.behaviour,
    Desire: r.desire,
    Attitude: r.attitude,
    "Current Avg": r.current_avg,
    Gap: r.gap,
    Priority: r.priority,
    "Dominant Gap": r.dominant_gap_code,
    "Recommended Course": r.recommended_course,
    "Training Mode": r.training_mode,
    "Training Start": r.training_start,
    "Target Completion": r.target_completion,
    "Actual Completion": r.actual_completion,
    Status: r.status,
    "Overdue?": r.overdue ? "YES" : "",
    "Reassessment Avg": r.reassessment_avg,
    "Evidence / Certificate": r.evidence_url,
    Notes: r.notes,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Employee Appraisals");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="training-matrix-${today}.xlsx"`,
    },
  });
}
