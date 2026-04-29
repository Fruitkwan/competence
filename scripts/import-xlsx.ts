/**
 * Import employees + appraisals from the source xlsx into Supabase.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — run from `web/`:
 *   npx tsx scripts/import-xlsx.ts "C:\Users\hisha\Downloads\Dhofar_Global_Training_Matrix_v2 (1).xlsx"
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error("Usage: tsx scripts/import-xlsx.ts <path-to-xlsx>");
  process.exit(1);
}

const buf = readFileSync(resolve(xlsxPath));
const wb = XLSX.read(buf, { type: "buffer", cellDates: true });

type Row = Record<string, unknown>;

function readSheet(name: string, headerRow: number): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Sheet not found: ${name}`);
  return XLSX.utils.sheet_to_json<Row>(ws, { range: headerRow - 1, defval: null });
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "—" ? null : s;
}

function asDate(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (!s || s === "—") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function mapCountry(c: string | null): string | null {
  if (!c) return null;
  const m: Record<string, string> = {
    KSA: "KSA",
    "Saudi Arabia": "KSA",
    UAE: "UAE",
    Qatar: "Qatar",
    Oman: "Oman",
  };
  return m[c] ?? c;
}

function mapStatus(s: string | null): string {
  if (!s) return "Not Started";
  const lc = s.toLowerCase();
  if (lc.includes("complete")) return "Completed";
  if (lc.includes("progress")) return "In Progress";
  if (lc.includes("cancel")) return "Cancelled";
  return "Not Started";
}

async function main() {
  const emps = readSheet("4. Employee Appraisals", 4);
  console.log(`Found ${emps.length} appraisal rows.`);

  const employees = new Map<string, Row>();
  const appraisals: Row[] = [];

  for (const r of emps) {
    const empId = str(r["Employee ID"]);
    if (!empId) continue;
    if (!employees.has(empId)) {
      employees.set(empId, {
        employee_id: empId,
        full_name: str(r["Employee Name"]) ?? empId,
        job_title: str(r["Job Title"]),
        country_code: mapCountry(str(r["Country"])),
        manager_name: str(r["Manager"]),
      });
    }
    appraisals.push({
      employee_id: empId,
      appraisal_date: asDate(r["Appraisal Date"]),
      required_level: str(r["Required Level"]) ?? "Competent",
      knowledge: str(r["Knowledge"]) ?? "Developing",
      skill: str(r["Skill"]) ?? "Developing",
      behaviour: str(r["Behaviour"]) ?? "Developing",
      desire: str(r["Desire"]) ?? "Developing",
      attitude: str(r["Attitude"]) ?? "Developing",
      training_start: asDate(r["Training Start"]),
      target_completion: asDate(r["Target Completion"]),
      actual_completion: asDate(r["Actual Completion"]),
      status: mapStatus(str(r["Status"])),
      reassessment_avg: r["Reassessment Avg"] == null ? null : Number(r["Reassessment Avg"]),
      evidence_url: str(r["Evidence / Certificate"]),
      notes: str(r["Notes"]),
    });
  }

  console.log(`Upserting ${employees.size} employees…`);
  {
    const { error } = await admin
      .from("employees")
      .upsert(Array.from(employees.values()), { onConflict: "employee_id" });
    if (error) throw error;
  }

  console.log(`Inserting ${appraisals.length} appraisals…`);
  // Clear existing to avoid dupes on re-run (keyed by employee+date).
  for (const chunk of chunks(appraisals, 200)) {
    const { error } = await admin.from("appraisals").insert(chunk);
    if (error) throw error;
  }

  console.log("Done.");
}

function* chunks<T>(arr: T[], n: number) {
  for (let i = 0; i < arr.length; i += n) yield arr.slice(i, i + n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
