"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PerformanceAppraisalForm } from "@/lib/supabase/performance-appraisal-types";
import {
  RATING_LABELS,
  CORE_COMPETENCIES,
  LEADERSHIP_COMPETENCIES,
  VALUES_COMPETENCIES,
} from "@/lib/supabase/performance-appraisal-types";

/* ---- Helpers ---- */
function r(v: number | null): string {
  return v != null ? `${v} — ${RATING_LABELS[v] ?? ""}` : "—";
}
function n(v: number | null): string {
  return v != null ? v.toFixed(2) : "—";
}
function avgOf(entries: Record<string, { rating_n1: number | null; rating_n2: number | null }>, side: "rating_n1" | "rating_n2"): number | null {
  const vals = Object.values(entries).map((e) => e[side]).filter((v) => v != null) as number[];
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function avgGoals(goals: { rating_n1: number | null; rating_n2: number | null }[], side: "rating_n1" | "rating_n2"): number | null {
  const vals = goals.map((g) => g[side]).filter((v) => v != null) as number[];
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/* ---- Export function ---- */
export async function exportToPdf(element: HTMLElement, fileName: string) {
  const html2canvas = (await import("html2canvas-pro")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF("p", "mm", "a4");
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

/* ---- PDF Button ---- */
export function SavePdfButton({
  form,
  employees,
}: {
  form: PerformanceAppraisalForm;
  employees: { employee_id: string; full_name: string; job_title: string }[];
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const empName = employees.find((e) => e.employee_id === form.employee_id)?.full_name ?? form.employee_id;
  const mgrName = employees.find((e) => e.employee_id === form.manager_id)?.full_name ?? form.manager_id;

  async function handleExport() {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      const fileName = `Performance_Appraisal_${empName.replace(/\s+/g, "_")}_${form.appraisal_period || "Draft"}.pdf`;
      await exportToPdf(printRef.current, fileName);
      toast.success("PDF downloaded successfully.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  }

  const signed = !!(form.employee_signed_at && form.manager_signed_at);

  /* ---- Score computation ---- */
  const a_n1 = avgGoals(form.goals, "rating_n1");
  const a_n2 = avgGoals(form.goals, "rating_n2");
  const b_n1 = avgOf(form.core_competencies, "rating_n1");
  const b_n2 = avgOf(form.core_competencies, "rating_n2");
  const c_n1 = form.leadership_applicable ? avgOf(form.leadership, "rating_n1") : null;
  const c_n2 = form.leadership_applicable ? avgOf(form.leadership, "rating_n2") : null;
  const d_n1 = avgOf(form.values_culture, "rating_n1");
  const d_n2 = avgOf(form.values_culture, "rating_n2");

  const sections = [
    { label: "A: Goals & Objectives", weight: 0.4, n1: a_n1, n2: a_n2 },
    { label: "B: Core Competencies", weight: 0.3, n1: b_n1, n2: b_n2 },
    { label: "C: Leadership", weight: 0.2, n1: c_n1, n2: c_n2 },
    { label: "D: Values & Culture", weight: 0.1, n1: d_n1, n2: d_n2 },
  ];
  const totalN1 = sections.reduce((s, r) => s + (r.n1 != null ? r.n1 * r.weight : 0), 0);
  const totalN2 = sections.reduce((s, r) => s + (r.n2 != null ? r.n2 * r.weight : 0), 0);

  return (
    <>
      <Button
        type="button"
        onClick={handleExport}
        disabled={generating}
        className={cn(
          "gap-2",
          signed
            ? "bg-primary hover:bg-primary/90"
            : "bg-muted text-muted-foreground"
        )}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        {generating ? "Generating PDF..." : "Save as PDF"}
      </Button>
      {!signed && (
        <p className="mt-1 text-xs text-muted-foreground">
          Both N1 and N2 signatures are recommended before exporting.
        </p>
      )}

      {/* ==== Hidden printable layout ==== */}
      <div className="fixed left-[-9999px] top-0">
        <div
          ref={printRef}
          style={{
            width: "794px", // A4 at 96dpi
            padding: "40px 48px",
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "#1a1a1a",
            background: "#fff",
          }}
        >
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "24px", borderBottom: "2px solid #534AB7", paddingBottom: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: "#534AB7", textTransform: "uppercase" as const, marginBottom: "4px" }}>Dhofar Global — Human Resources Department</div>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>EMPLOYEE PERFORMANCE APPRAISAL</div>
            <div style={{ fontSize: "11px", color: "#666" }}>Two-Way Assessment | N1 (Employee) &amp; N2 (Manager)</div>
          </div>

          {/* Employee info table */}
          <SectionTitle>Employee Information</SectionTitle>
          <InfoTable rows={[
            ["Employee Name", empName, "Employee ID", form.employee_id],
            ["Job Title", employees.find((e) => e.employee_id === form.employee_id)?.job_title ?? "", "Department", form.department],
            ["Direct Manager (N2)", mgrName, "Business Unit", form.business_unit],
            ["Location", form.location, "Appraisal Period", form.appraisal_period],
            ["Appraisal Type", form.appraisal_type, "Document Ref.", form.document_ref],
          ]} />

          {/* Section A: Goals */}
          <SectionTitle>Section A — Goals &amp; Objectives (Weight: 40%)</SectionTitle>
          <table style={tableStyle}>
            <thead>
              <tr>
                <Th>#</Th><Th>Goal / Objective</Th><Th>KPI</Th><Th>Target</Th><Th>Actual</Th><Th>N1</Th><Th>N2</Th><Th>%</Th>
              </tr>
            </thead>
            <tbody>
              {form.goals.filter((g) => g.objective).map((g, i) => (
                <tr key={i}>
                  <Td>{i + 1}</Td><Td>{g.objective}</Td><Td>{g.kpi}</Td><Td>{g.target}</Td><Td>{g.actual}</Td>
                  <Td>{g.rating_n1 ?? "—"}</Td><Td>{g.rating_n2 ?? "—"}</Td><Td>{g.achievement_pct || "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Section B: Core Competencies */}
          <SectionTitle>Section B — Core Competencies (Weight: 30%)</SectionTitle>
          <CompetencyTable names={[...CORE_COMPETENCIES]} data={form.core_competencies} />

          {/* Section C: Leadership */}
          <SectionTitle>Section C — Leadership &amp; Management (Weight: 20%)</SectionTitle>
          {form.leadership_applicable ? (
            <CompetencyTable names={[...LEADERSHIP_COMPETENCIES]} data={form.leadership} />
          ) : (
            <div style={{ padding: "8px", color: "#888", fontStyle: "italic" }}>N/A — Not applicable for this employee.</div>
          )}

          {/* Section D: Values */}
          <SectionTitle>Section D — Values &amp; Culture (Weight: 10%)</SectionTitle>
          <CompetencyTable names={[...VALUES_COMPETENCIES]} data={form.values_culture} />

          {/* Section E: Feedback */}
          <SectionTitle>Section E — Two-Way Open Feedback</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "10px", marginBottom: "6px", color: "#534AB7" }}>EMPLOYEE (N1)</div>
              <FeedbackItem label="Top achievements" value={form.feedback_n1.top_achievements} />
              <FeedbackItem label="Challenges" value={form.feedback_n1.challenges} />
              <FeedbackItem label="Support needed" value={form.feedback_n1.support_needed} />
              <FeedbackItem label="Career aspirations" value={form.feedback_n1.career_aspirations} />
              <FeedbackItem label="Self-rating rationale" value={form.feedback_n1.self_rating_rationale} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "10px", marginBottom: "6px", color: "#534AB7" }}>MANAGER (N2)</div>
              <FeedbackItem label="Top achievements" value={form.feedback_n2.top_achievements} />
              <FeedbackItem label="Challenges" value={form.feedback_n2.challenges} />
              <FeedbackItem label="Support provided" value={form.feedback_n2.support_provided} />
              <FeedbackItem label="Career recommendation" value={form.feedback_n2.career_recommendation} />
              <FeedbackItem label="Overall assessment" value={form.feedback_n2.overall_assessment} />
            </div>
          </div>

          {/* Section F: IDP */}
          <SectionTitle>Section F — Individual Development Plan</SectionTitle>
          <table style={tableStyle}>
            <thead><tr><Th>#</Th><Th>Development Area</Th><Th>Action</Th><Th>Resources</Th><Th>Timeline</Th><Th>Owner</Th></tr></thead>
            <tbody>
              {form.development_plan.filter((d) => d.area).map((d, i) => (
                <tr key={i}><Td>{i + 1}</Td><Td>{d.area}</Td><Td>{d.action}</Td><Td>{d.resources}</Td><Td>{d.timeline}</Td><Td>{d.owner}</Td></tr>
              ))}
            </tbody>
          </table>

          {/* Section G: Next Goals */}
          <SectionTitle>Section G — Goals for Next Period</SectionTitle>
          <table style={tableStyle}>
            <thead><tr><Th>#</Th><Th>Goal / Objective</Th><Th>Key Result</Th><Th>Target Date</Th><Th>Priority</Th></tr></thead>
            <tbody>
              {form.next_period_goals.filter((g) => g.objective).map((g, i) => (
                <tr key={i}><Td>{i + 1}</Td><Td>{g.objective}</Td><Td>{g.key_result}</Td><Td>{g.target_date}</Td><Td>{g.priority || "—"}</Td></tr>
              ))}
            </tbody>
          </table>

          {/* Section H: Summary */}
          <SectionTitle>Section H — Overall Performance Summary</SectionTitle>
          <table style={tableStyle}>
            <thead><tr><Th>Section</Th><Th>Weight</Th><Th>N1 Score</Th><Th>N2 Score</Th><Th>Weighted (N1)</Th><Th>Weighted (N2)</Th></tr></thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.label}>
                  <Td>{s.label}</Td><Td>{(s.weight * 100)}%</Td>
                  <Td>{n(s.n1)}</Td><Td>{n(s.n2)}</Td>
                  <Td bold>{s.n1 != null ? (s.n1 * s.weight).toFixed(2) : "—"}</Td>
                  <Td bold>{s.n2 != null ? (s.n2 * s.weight).toFixed(2) : "—"}</Td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #333", fontWeight: 700 }}>
                <Td bold>TOTAL</Td><Td bold>100%</Td><Td /><Td />
                <Td bold>{totalN1.toFixed(2)}</Td><Td bold>{totalN2.toFixed(2)}</Td>
              </tr>
            </tbody>
          </table>
          {form.calibrated_rating && (
            <div style={{ marginTop: "8px" }}>
              <strong>Calibrated Rating:</strong> {r(form.calibrated_rating)}<br />
              {form.calibration_rationale && <><strong>Rationale:</strong> {form.calibration_rationale}<br /></>}
              {form.recommended_action && <><strong>Recommended Action:</strong> {form.recommended_action}</>}
            </div>
          )}

          {/* Section I: Acknowledgement */}
          {form.employee_comments && (
            <>
              <SectionTitle>Section I — Employee Acknowledgement</SectionTitle>
              <div style={{ padding: "8px", border: "1px solid #ddd", borderRadius: "4px" }}>{form.employee_comments}</div>
            </>
          )}

          {/* Section J: Signatures */}
          <SectionTitle>Section J — Signatures</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "8px" }}>
            <SignBlock label="Employee (N1)" name={empName} signedAt={form.employee_signed_at} />
            <SignBlock label="Direct Manager (N2)" name={mgrName} signedAt={form.manager_signed_at} />
            <SignBlock label="HR Representative" name={form.hr_representative} signedAt={form.hr_signed_at} />
          </div>

          {/* Footer */}
          <div style={{ marginTop: "24px", borderTop: "1px solid #ddd", paddingTop: "8px", fontSize: "9px", color: "#aaa", textAlign: "center" as const }}>
            CONFIDENTIAL — Dhofar Global Performance Appraisal — Generated {new Date().toLocaleDateString("en-GB")}
          </div>
        </div>
      </div>
    </>
  );
}

/* ==== PDF sub-components (inline styles for html2canvas) ==== */

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "10px",
  marginBottom: "12px",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "12px", fontWeight: 700, color: "#534AB7", marginTop: "18px", marginBottom: "6px", borderBottom: "1px solid #E5E3F5", paddingBottom: "4px" }}>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left" as const, padding: "5px 6px", borderBottom: "1px solid #ccc", fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, color: "#888" }}>{children}</th>;
}

function Td({ children, bold }: { children?: React.ReactNode; bold?: boolean }) {
  return <td style={{ padding: "5px 6px", borderBottom: "1px solid #eee", fontWeight: bold ? 700 : 400 }}>{children}</td>;
}

function InfoTable({ rows }: { rows: string[][] }) {
  return (
    <table style={{ ...tableStyle, marginBottom: "16px" }}>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            <td style={{ padding: "4px 6px", fontWeight: 600, color: "#666", width: "18%", borderBottom: "1px solid #eee" }}>{row[0]}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee", width: "32%" }}>{row[1] || "—"}</td>
            <td style={{ padding: "4px 6px", fontWeight: 600, color: "#666", width: "18%", borderBottom: "1px solid #eee" }}>{row[2]}</td>
            <td style={{ padding: "4px 6px", borderBottom: "1px solid #eee", width: "32%" }}>{row[3] || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CompetencyTable({ names, data }: { names: string[]; data: Record<string, { rating_n1: number | null; rating_n2: number | null; comments_n1: string; comments_n2: string; evidence: string }> }) {
  return (
    <table style={tableStyle}>
      <thead>
        <tr><Th>Competency</Th><Th>N1</Th><Th>N2</Th><Th>Employee Comments</Th><Th>Manager Comments</Th></tr>
      </thead>
      <tbody>
        {names.map((name) => {
          const e = data[name];
          return (
            <tr key={name}>
              <Td bold>{name}</Td>
              <Td>{e?.rating_n1 ?? "—"}</Td>
              <Td>{e?.rating_n2 ?? "—"}</Td>
              <Td>{e?.comments_n1 || "—"}</Td>
              <Td>{e?.comments_n2 || "—"}</Td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FeedbackItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "6px" }}>
      <div style={{ fontSize: "9px", fontWeight: 600, color: "#888", textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ padding: "4px 0", minHeight: "16px" }}>{value || "—"}</div>
    </div>
  );
}

function SignBlock({ label, name, signedAt }: { label: string; name: string; signedAt: string | null }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "10px", textAlign: "center" as const }}>
      <div style={{ fontSize: "9px", fontWeight: 600, color: "#888", textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ marginTop: "6px", fontWeight: 600 }}>{name || "—"}</div>
      {signedAt ? (
        <div style={{ marginTop: "4px", fontSize: "10px", color: "#0F6E56" }}>
          ✓ Signed — {new Date(signedAt).toLocaleDateString("en-GB")}
        </div>
      ) : (
        <div style={{ marginTop: "4px", fontSize: "10px", color: "#aaa" }}>Not signed</div>
      )}
    </div>
  );
}
