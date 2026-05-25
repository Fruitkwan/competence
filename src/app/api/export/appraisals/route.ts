import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

type Row = {
  employee_id: string;
  full_name: string;
  job_title: string;
  country_code: string | null;
  manager_name: string | null;
  cluster: string;
  kpi_linked: string | null;
  required_level: string;
  required_numeric: number;
  appraisal_date: string;
  knowledge: string;
  skill: string;
  behaviour: string;
  desire: string;
  attitude: string;
  current_avg: number;
  gap: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  dominant_gap_code: string;
  recommended_course: string | null;
  training_mode: string | null;
  training_start: string | null;
  target_completion: string | null;
  actual_completion: string | null;
  status: string;
  overdue: boolean;
  reassessment_avg: number | null;
  evidence_url: string | null;
  notes: string | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const search = request.nextUrl.searchParams;
  const query = (search.get("q") ?? "").toLowerCase().trim();
  const status = search.get("status") ?? "";
  const priority = search.get("priority") ?? "";
  const cluster = search.get("cluster") ?? "";
  const country = search.get("country") ?? "";
  const overdueOnly = search.get("overdue") === "1";
  const requestedScope = search.get("scope") ?? "";

  // Resolve role + identity (same logic as the page).
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? "employee";
  const myFullName = profile?.full_name ?? null;

  const { data: myEmployee } = await supabase
    .from("employees")
    .select("employee_id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const myEmployeeId = myEmployee?.employee_id ?? null;
  const myDisplayName = myEmployee?.full_name ?? myFullName;

  const allowedScopes = new Set(
    role === "employee" ? ["own"] : ["own", "team", "all"],
  );
  const scope = allowedScopes.has(requestedScope)
    ? requestedScope
    : role === "employee"
    ? "own"
    : role === "manager"
    ? "team"
    : "all";

  let q = supabase
    .from("appraisal_full")
    .select(
      "employee_id, full_name, job_title, country_code, manager_name, cluster, kpi_linked, required_level, required_numeric, appraisal_date, knowledge, skill, behaviour, desire, attitude, current_avg, gap, priority, dominant_gap_code, recommended_course, training_mode, training_start, target_completion, actual_completion, status, overdue, reassessment_avg, evidence_url, notes",
    )
    .order("appraisal_date", { ascending: false });

  if (scope === "own") {
    if (!myEmployeeId) return emptyWorkbook("no-employee-link");
    q = q.eq("employee_id", myEmployeeId);
  } else if (scope === "team") {
    if (!myDisplayName) return emptyWorkbook("no-profile");
    q = q.eq("manager_name", myDisplayName);
  }
  if (status) q = q.eq("status", status);
  if (priority) q = q.eq("priority", priority);
  if (cluster) q = q.eq("cluster", cluster);
  if (country) q = q.eq("country_code", country);
  if (overdueOnly) q = q.eq("overdue", true);

  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  // Free-text search is applied client-side after the DB filters
  // so it matches the page's behaviour exactly.
  const rows = ((data ?? []) as Row[]).filter((r) => {
    if (!query) return true;
    const hay = [
      r.employee_id,
      r.full_name,
      r.job_title,
      r.recommended_course,
      r.manager_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });

  const sheetRows = rows.map((r) => ({
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
  const ws = XLSX.utils.json_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, "Employee Appraisals");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="appraisals-${today}.xlsx"`,
    },
  });
}

function emptyWorkbook(reason: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["No data", reason]]);
  XLSX.utils.book_append_sheet(wb, ws, "Empty");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="appraisals-empty.xlsx"`,
    },
  });
}
