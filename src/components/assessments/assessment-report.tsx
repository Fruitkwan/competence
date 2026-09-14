"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Brain, CheckCircle2, CircleDashed, Download, Info, Loader2, Scale, ShieldAlert, Target } from "lucide-react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportToPdf } from "@/components/performance-appraisal/pdf-export";
import { ASSESSMENT_PURPOSE } from "@/lib/assessments/copy";
import type { EmployeeReport, AssignmentResult } from "@/lib/assessments/results";
import type { Band, ItemScore, Warning } from "@/lib/assessments/scoring";
import { cn } from "@/lib/utils";

const BAND_COLOR: Record<Band, string> = {
  Strength: "#059669",
  "Meets standard": "#2563eb",
  "Development gap": "#d97706",
  "Material gap": "#dc2626",
};

const BAND_BADGE: Record<Band, string> = {
  Strength: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "Meets standard": "border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "Development gap": "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "Material gap": "border-red-300 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const GROUP_COLOR: Record<string, string[]> = {
  Behaviour: ["#4f46e5", "#6366f1", "#818cf8"],
  Desire: ["#db2777", "#f472b6"],
  Attitude: ["#d97706", "#fbbf24"],
};

const STANDARD = 60;

/** Width of the off-screen print layout; wide enough for A4 landscape at ~2.1 mm per 10 px. */
const PRINT_WIDTH = 1400;

export function AssessmentReport({ report }: { report: EmployeeReport }) {
  const printRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { employee, skill, behaviour, grid, isSelf } = report;
  const roleFamily = skill?.template.role_family ?? employee.job_title;
  const date = formatDate((skill ?? behaviour)?.assignment.submitted_at ?? (skill ?? behaviour)?.assignment.created_at ?? null);
  const wave = (skill ?? behaviour)?.assignment.wave;
  const provisional = (skill?.score.provisional ?? false) || (behaviour?.score.provisional ?? false);

  const warnings = dedupeWarnings([...(skill?.score.warnings ?? []), ...(behaviour?.score.warnings ?? [])]).filter(
    (w) => !isSelf || !["manager_rater_divergence", "reputation_ahead", "invisible_work"].includes(w.code)
  );

  async function download() {
    if (!printRef.current) return;
    setExporting(true);
    try {
      await exportToPdf(printRef.current, `Assessment_${employee.employee_id}_${(wave ?? "report").replace(/\s+/g, "_")}.pdf`, {
        fitToPage: true,
        windowWidth: PRINT_WIDTH,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={download} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
        </Button>
      </div>

      <div className="space-y-4 rounded-xl bg-background p-1">
        <header className="overflow-hidden rounded-xl border border-teal-200/70 bg-gradient-to-r from-teal-50 via-white to-white px-6 py-5 dark:border-teal-900 dark:from-teal-950/40 dark:via-background dark:to-background">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">Dhofar Global</div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Employee assessment report</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Capability, judgement and behavioural insights</p>
            </div>
            <div className="rounded-full border border-teal-300 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-800 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-200">
              Confidential
            </div>
          </div>
          <div className="mt-5 grid gap-3 border-t border-teal-200/60 pt-4 text-xs text-slate-700 dark:border-teal-900 dark:text-slate-200 sm:grid-cols-3">
            <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Employee</span>{employee.full_name}</div>
            <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Assessment wave</span>{wave ?? "Not specified"}</div>
            <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Report date</span>{date || new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </header>
        {/* Row 1: profile / behavioural donut / warnings */}
        <div className="grid items-start gap-4 lg:grid-cols-[1.1fr_1.2fr_1fr]">
          <Card className="border-0 shadow-sm ring-1 ring-foreground/10">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">{employee.full_name}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {employee.employee_id} · {employee.job_title}
                    {employee.department ? ` · ${employee.department}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {date}
                    {wave ? ` · ${wave}` : ""}
                  </div>
                </div>
                {provisional && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700">
                    Provisional
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="text-sm font-semibold">Capability Profile</div>
              {skill ? (
                <>
                  <Stat
                    ring={<ScoreRing value={skill.score.index} band={skill.score.items.length ? bandOf(skill.score.index) : null} />}
                    title="Skill Index"
                    text={indexText(skill.score.index)}
                  />
                  <Stat
                    ring={<IconRing icon={<Brain className="h-6 w-6" />} tone="#7c3aed" />}
                    title="Judgement"
                    text={
                      skill.score.scenarios_answered
                        ? `${skill.score.scenarios_correct} of ${skill.score.scenarios_answered} scenario checks answered with the best option.`
                        : "Scenario checks not yet answered."
                    }
                  />
                  <Stat
                    ring={<IconRing icon={<Scale className="h-6 w-6" />} tone="#0891b2" />}
                    title="Self-awareness"
                    text={selfAwarenessText(skill.score.items)}
                  />
                </>
              ) : (
                <MissingAssessment type="Skill" />
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-foreground/10">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold">Behavioural Profile</CardTitle>
              <p className="text-xs text-muted-foreground">Hover or focus an item to inspect its score.</p>
            </CardHeader>
            <CardContent>
              {behaviour ? (
                <BehaviourDonut result={behaviour} initials={initials(employee.full_name)} />
              ) : (
                <MissingAssessment type="Behaviour" />
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-foreground/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> Advisory Warnings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {warnings.length === 0 && <p className="text-sm text-muted-foreground">No divergence flags raised.</p>}
              {warnings.map((w) => (
                <div key={w.code} className="flex gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <div className="font-medium">{w.title}</div>
                    <div className="text-xs text-muted-foreground">{w.detail}</div>
                    {w.items.length > 0 && <div className="mt-0.5 text-xs">{w.items.join(" · ")}</div>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: role match */}
        <Card className="border-0 shadow-sm ring-1 ring-foreground/10">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Target className="h-4 w-4 text-primary" /> Role match: {roleFamily}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Role placement combines capability (Skill) with motivation and adaptability (Will).
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-1">
            <div className="flex flex-wrap gap-2">
              <CoveragePill label="Skill assessment" available={Boolean(skill)} />
              <CoveragePill label="Behaviour assessment" available={Boolean(behaviour)} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <RoleDimension
                title="Skill"
                description={`Competency score compared with the ${STANDARD}% role standard.`}
                value={skill?.score.index ?? null}
                color="#4f46e5"
                missingText="No active Skill assessment could be paired with this report. Assign or complete one to calculate capability and role placement."
                chart={skill?.score.items.length ? (
                  <RadarBlock
                    data={skill.score.items.map((i) => ({ name: shortName(i.name), candidate: i.score ?? 0, role: STANDARD }))}
                    color="#4f46e5"
                  />
                ) : null}
              />
              <RoleDimension
                title="Will"
                description={`Desire and Attitude score compared with the ${STANDARD}% role standard.`}
                value={behaviour?.score.will_index ?? null}
                color="#db2777"
                missingText="No active Behaviour assessment could be paired with this report. Assign or complete one to calculate Will and role placement."
                chart={behaviour?.score.items.length ? (
                  <RadarBlock
                    data={behaviour.score.items.map((i) => ({ name: shortName(i.name), candidate: i.score ?? 0, role: STANDARD }))}
                    color="#db2777"
                  />
                ) : null}
              />
            </div>

            {grid && (
              <div className="mt-4 grid gap-4 rounded-lg border bg-muted/30 p-4 md:grid-cols-[auto_1fr]">
                <SkillWillGrid group={grid.group} />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Placement</div>
                  <div className="text-lg font-semibold">{grid.group}</div>
                  <div className="mt-1 text-sm">{grid.action}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    The placement matters more than the score: the four groups need completely different responses.
                  </p>
                </div>
              </div>
            )}
            {!grid && (
              <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <div>
                  <div className="text-sm font-medium">Role placement is waiting for both assessments</div>
                  <p className="mt-1 text-xs text-blue-800/80 dark:text-blue-200/80">
                    Skill and Will must both have a score before the employee can be placed on the four-quadrant grid.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Row 3: detail */}
        {skill && <DetailTable result={skill} isSelf={isSelf} title="Skill competencies" />}
        {behaviour && <DetailTable result={behaviour} isSelf={isSelf} title="Behaviour, Desire and Attitude" />}

        {behaviour?.assignment.aspiration && Object.keys(behaviour.assignment.aspiration).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Aspiration and intent (self-reported, unscored)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Object.entries(behaviour.assignment.aspiration as Record<string, string>)
                .filter(([, v]) => v)
                .map(([q, v]) => (
                  <div key={q}>
                    <div className="text-xs text-muted-foreground">{q}</div>
                    <div>{v}</div>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        <Card className="break-inside-avoid border-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Report acknowledgement and e-signatures</CardTitle>
            <p className="text-xs text-muted-foreground">
              Signatures confirm that the report was reviewed. They do not necessarily indicate agreement with every result.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <SignatureField role="Employee" name={employee.full_name} />
            <SignatureField role="Line manager" />
            <SignatureField role="HR representative" />
          </CardContent>
        </Card>

        <p className="px-2 text-[10px] text-muted-foreground">
          Scores are weighted percentages ({skill ? "cross-departmental 40 / line manager 20 / scenario 30 / self 10" : ""}
          {skill && behaviour ? "; " : ""}
          {behaviour ? "peer 45 / line manager 20 / scenario 25 / self 10" : ""}). Bands: Strength ≥75, Meets standard ≥60,
          Development gap ≥45, Material gap &lt;45. Individual rater scores are never disclosed; a result is provisional below three
          rater responses.
        </p>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t px-2 pt-3 text-[10px] text-muted-foreground">
          <span>Dhofar Global Performance Hub</span>
          <span>Confidential employee record · Generated {new Date().toLocaleDateString("en-GB")}</span>
        </footer>
      </div>

      {/* Off-screen one-page layout captured by "Download PDF". */}
      <div aria-hidden inert className="pointer-events-none fixed left-[-20000px] top-0 select-none">
        <PrintReport
          ref={printRef}
          report={report}
          warnings={warnings}
          roleFamily={roleFamily}
          date={date}
          wave={wave ?? null}
          provisional={provisional}
        />
      </div>
    </div>
  );
}

/* ---------------- one-page print layout ---------------- */

function PrintReport({
  ref,
  report,
  warnings,
  roleFamily,
  date,
  wave,
  provisional,
}: {
  ref: React.Ref<HTMLDivElement>;
  report: EmployeeReport;
  warnings: Warning[];
  roleFamily: string;
  date: string;
  wave: string | null;
  provisional: boolean;
}) {
  const { employee, skill, behaviour, grid, isSelf } = report;
  const aspiration = Object.entries((behaviour?.assignment.aspiration as Record<string, string> | null) ?? {}).filter(([, v]) => v);
  const reportDate = date || new Date().toLocaleDateString("en-GB");

  return (
    <div ref={ref} style={{ width: PRINT_WIDTH }} className="space-y-3 bg-white p-8 text-[11px] leading-snug text-slate-900">
      <header className="flex items-center justify-between gap-6 rounded-lg border border-teal-200 bg-gradient-to-r from-teal-50 to-white px-5 py-3">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-teal-700">Dhofar Global</div>
          <div className="text-lg font-semibold leading-tight">Employee assessment report</div>
          <div className="max-w-[640px] text-[10px] leading-snug text-slate-600">{ASSESSMENT_PURPOSE}</div>
        </div>
        <div className="flex items-center gap-8">
          <PrintMeta label="Employee" value={employee.full_name} />
          <PrintMeta label="Assessment wave" value={wave ?? "Not specified"} />
          <PrintMeta label="Report date" value={reportDate} />
          <span className="rounded-full border border-teal-300 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-teal-800">Confidential</span>
        </div>
      </header>

      <div className="grid grid-cols-[1.05fr_1.35fr_1fr] gap-3">
        <PrintBox>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-base font-semibold leading-tight">{employee.full_name}</div>
              <div className="text-[10px] text-slate-500">
                {employee.employee_id} · {employee.job_title}
                {employee.department ? ` · ${employee.department}` : ""}
              </div>
            </div>
            {provisional && <span className="rounded-full border border-amber-300 px-2 py-0.5 text-[9px] font-medium text-amber-700">Provisional</span>}
          </div>
          <div className="mt-3 text-[9px] font-semibold uppercase tracking-wider text-slate-500">Capability profile</div>
          {skill ? (
            <div className="mt-2 space-y-2.5">
              <Stat ring={<ScoreRing value={skill.score.index} band={skill.score.items.length ? bandOf(skill.score.index) : null} size="sm" />} title="Skill Index" text={indexText(skill.score.index)} compact />
              <Stat
                ring={<IconRing icon={<Brain className="h-4 w-4" />} tone="#7c3aed" size="sm" />}
                title="Judgement"
                text={skill.score.scenarios_answered ? `${skill.score.scenarios_correct} of ${skill.score.scenarios_answered} scenario checks answered with the best option.` : "Scenario checks not yet answered."}
                compact
              />
              <Stat ring={<IconRing icon={<Scale className="h-4 w-4" />} tone="#0891b2" size="sm" />} title="Self-awareness" text={selfAwarenessText(skill.score.items)} compact />
            </div>
          ) : (
            <PrintMissing type="Skill" />
          )}
        </PrintBox>

        <PrintBox title="Behavioural profile">
          {behaviour ? <BehaviourDonut result={behaviour} initials={initials(employee.full_name)} size={150} interactive={false} /> : <PrintMissing type="Behaviour" />}
        </PrintBox>

        <PrintBox title="Advisory warnings">
          {warnings.length === 0 && <p className="text-slate-500">No divergence flags raised.</p>}
          <div className="space-y-2">
            {warnings.map((w) => (
              <div key={w.code} className="flex gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                <div>
                  <div className="font-medium leading-tight">{w.title}</div>
                  <div className="text-[10px] leading-snug text-slate-500">{w.detail}</div>
                  {w.items.length > 0 && <div className="text-[10px]">{w.items.join(" · ")}</div>}
                </div>
              </div>
            ))}
          </div>
        </PrintBox>
      </div>

      <PrintBox title={`Role match: ${roleFamily}`} subtitle="Role placement combines capability (Skill) with motivation and adaptability (Will).">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-4">
          <PrintDimension
            title="Skill"
            description={`Competency score vs the ${STANDARD}% role standard.`}
            value={skill?.score.index ?? null}
            color="#4f46e5"
            missingText="No active Skill assessment could be paired with this report."
            chart={skill?.score.items.length ? <RadarBlock data={skill.score.items.map((i) => ({ name: shortName(i.name), candidate: i.score ?? 0, role: STANDARD }))} color="#4f46e5" width={400} height={190} /> : null}
          />
          <PrintDimension
            title="Will"
            description={`Desire and Attitude score vs the ${STANDARD}% role standard.`}
            value={behaviour?.score.will_index ?? null}
            color="#db2777"
            missingText="No active Behaviour assessment could be paired with this report."
            chart={behaviour?.score.items.length ? <RadarBlock data={behaviour.score.items.map((i) => ({ name: shortName(i.name), candidate: i.score ?? 0, role: STANDARD }))} color="#db2777" width={400} height={190} /> : null}
          />
          <div className="flex w-56 flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
            {grid ? (
              <>
                <SkillWillGrid group={grid.group} compact />
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Placement</div>
                  <div className="font-semibold">{grid.group}</div>
                  <div className="mt-0.5 text-[10px] leading-snug text-slate-600">{grid.action}</div>
                </div>
              </>
            ) : (
              <div className="text-[10px] leading-snug text-slate-500">Placement on the four-quadrant grid needs both a Skill and a Will score.</div>
            )}
          </div>
        </div>
      </PrintBox>

      {(skill || behaviour) && (
        <div className={cn("grid gap-3", skill && behaviour ? "grid-cols-2" : "grid-cols-1")}>
          {skill && <PrintScoreTable result={skill} isSelf={isSelf} title="Skill competencies" />}
          {behaviour && <PrintScoreTable result={behaviour} isSelf={isSelf} title="Behaviour, Desire and Attitude" />}
        </div>
      )}

      {aspiration.length > 0 && (
        <PrintBox title="Aspiration and intent" subtitle="Self-reported, unscored.">
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
            {aspiration.map(([q, v]) => (
              <div key={q} className="max-h-12 overflow-hidden">
                <div className="text-[9px] text-slate-500">{q}</div>
                <div className="text-[10px] leading-snug">{v}</div>
              </div>
            ))}
          </div>
        </PrintBox>
      )}

      <div className="grid grid-cols-3 gap-3">
        <PrintSignature role="Employee" name={employee.full_name} />
        <PrintSignature role="Line manager" />
        <PrintSignature role="HR representative" />
      </div>

      <footer className="flex items-start justify-between gap-8 border-t border-slate-200 pt-2 text-[9px] leading-snug text-slate-500">
        <p className="max-w-[880px]">
          Scores are weighted percentages ({skill ? "cross-departmental 40 / line manager 20 / scenario 30 / self 10" : ""}
          {skill && behaviour ? "; " : ""}
          {behaviour ? "peer 45 / line manager 20 / scenario 25 / self 10" : ""}). Bands: Strength ≥75, Meets standard ≥60, Development gap ≥45, Material gap &lt;45.
          Individual rater scores are never disclosed; a result is provisional below three rater responses. Signatures confirm the report was reviewed, not agreement with every result.
        </p>
        <span className="shrink-0 text-right">
          Dhofar Global Performance Hub
          <br />
          Confidential employee record · Generated {new Date().toLocaleDateString("en-GB")}
        </span>
      </footer>
    </div>
  );
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-[10px]">
      <div className="text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  );
}

function PrintBox({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3.5">
      {title && (
        <div className="mb-2">
          <div className="font-semibold">{title}</div>
          {subtitle && <div className="text-[10px] text-slate-500">{subtitle}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function PrintMissing({ type }: { type: "Skill" | "Behaviour" }) {
  return (
    <div className="flex gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
      <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
      <div>
        <div className="font-medium">{type} assessment unavailable</div>
        <p className="text-[10px] leading-snug text-slate-500">No visible active {type.toLowerCase()} assessment was found for this employee.</p>
      </div>
    </div>
  );
}

function PrintDimension({
  title,
  description,
  value,
  color,
  missingText,
  chart,
}: {
  title: string;
  description: string;
  value: number | null;
  color: string;
  missingText: string;
  chart: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-3">
        <PercentDonut value={value} color={color} size={64} />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {value != null && <span className="rounded-full border border-slate-300 px-1.5 py-px text-[9px]">{bandOf(value)}</span>}
          </div>
          <p className="text-[10px] leading-snug text-slate-500">{description}</p>
        </div>
      </div>
      {value == null ? <div className="mt-3 rounded-md bg-slate-50 p-3 text-[10px] text-slate-500">{missingText}</div> : <div className="mt-1 flex justify-center">{chart}</div>}
    </div>
  );
}

function PrintScoreTable({ result, isSelf, title }: { result: AssignmentResult; isSelf: boolean; title: string }) {
  const isSkill = result.template.kind === "skill";
  const th = "pb-1 pr-2 text-[9px] font-medium uppercase tracking-wider text-slate-500";
  const td = "py-[3px] pr-2 align-top";
  return (
    <PrintBox title={title}>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="text-left">
            <th className={th}>Item</th>
            {!isSelf && <th className={cn(th, "text-right")}>Self</th>}
            {!isSelf && <th className={cn(th, "text-right")}>Line mgr</th>}
            {!isSelf && <th className={cn(th, "text-right")}>{isSkill ? "Cross-dept" : "Peers"}</th>}
            <th className={cn(th, "text-center")}>Scenario</th>
            <th className={cn(th, "text-right")}>Score</th>
            <th className={th}>Band</th>
            <th className={cn(th, "pr-0")}>Flag</th>
          </tr>
        </thead>
        <tbody>
          {result.score.items.map((i) => (
            <tr key={i.item_id} className="border-t border-slate-100">
              <td className={td}>
                <span className="font-medium">{i.name}</span>
                {i.group_name && <span className="ml-1 text-slate-400">{i.group_name}</span>}
              </td>
              {!isSelf && <td className={cn(td, "text-right tabular-nums")}>{i.self ?? "—"}</td>}
              {!isSelf && <td className={cn(td, "text-right tabular-nums")}>{i.line_manager ?? "—"}</td>}
              {!isSelf && (
                <td className={cn(td, "text-right tabular-nums")}>
                  {i.others_avg ?? "—"}
                  {i.others_count > 0 && <span className="ml-0.5 text-slate-400">({i.others_count})</span>}
                </td>
              )}
              <td className={cn(td, "text-center")}>{i.scenario_correct == null ? "—" : i.scenario_correct ? <span className="text-emerald-600">✓</span> : <span className="text-red-600">✗</span>}</td>
              <td className={cn(td, "text-right font-semibold tabular-nums")}>{i.score ?? "—"}</td>
              <td className={td}>
                {i.band && (
                  <span className="rounded px-1.5 py-px text-[9px] font-medium" style={{ color: BAND_COLOR[i.band], backgroundColor: `${BAND_COLOR[i.band]}1a` }}>
                    {i.band}
                  </span>
                )}
              </td>
              <td className={cn(td, "pr-0 text-[9px] text-slate-500")}>{i.flag ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintBox>
  );
}

function PrintSignature({ role, name }: { role: string; name?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{role}</div>
      <div className="mt-4 border-b border-slate-400 pb-0.5 text-[10px]">{name ?? ""}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-3 text-[9px] text-slate-500">
        <span>Signature</span>
        <span className="border-b border-slate-300">Date</span>
      </div>
    </div>
  );
}

/* ---------------- blocks ---------------- */

function SignatureField({ role, name }: { role: string; name?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{role}</div>
      <div className="mt-6 border-b border-foreground/40 pb-1 text-sm">{name ?? ""}</div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] text-muted-foreground">
        <span>Signature</span>
        <span className="border-b">Date</span>
      </div>
    </div>
  );
}

function Stat({ ring, title, text, compact }: { ring: React.ReactNode; title: string; text: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center", compact ? "gap-3" : "gap-4")}>
      {ring}
      <div>
        <div className={cn("font-medium", compact ? "text-[11px] leading-tight" : "text-sm")}>{title}</div>
        <div className={cn("text-muted-foreground", compact ? "text-[10px] leading-snug text-slate-500" : "text-xs")}>{text}</div>
      </div>
    </div>
  );
}

const RING_SIZE = { sm: "h-12 w-12", md: "h-16 w-16" } as const;
const RING_TEXT = { sm: "text-sm", md: "text-lg" } as const;

function ScoreRing({ value, band, size = "md" }: { value: number | null; band: Band | null; size?: keyof typeof RING_SIZE }) {
  const color = band ? BAND_COLOR[band] : "#94a3b8";
  return (
    <div className={cn("relative shrink-0", RING_SIZE[size])}>
      <svg viewBox="0 0 36 36" className={cn("-rotate-90", RING_SIZE[size])}>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeDasharray={`${((value ?? 0) / 100) * 97.4} 97.4`}
          strokeLinecap="round"
        />
      </svg>
      <div className={cn("absolute inset-0 flex items-center justify-center font-bold", RING_TEXT[size])} style={{ color }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function IconRing({ icon, tone, size = "md" }: { icon: React.ReactNode; tone: string; size?: keyof typeof RING_SIZE }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full border-2", RING_SIZE[size])}
      style={{ borderColor: tone, color: tone, backgroundColor: `${tone}14` }}
    >
      {icon}
    </div>
  );
}

function MissingAssessment({ type }: { type: "Skill" | "Behaviour" }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4">
      <div className="flex gap-3">
        <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div>
          <div className="text-sm font-medium">{type} assessment unavailable</div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            No visible active {type.toLowerCase()} assessment was found for this employee. The report first checks the same wave, then the
            latest non-closed assignment. Assign or complete one to add this score.
          </p>
        </div>
      </div>
    </div>
  );
}

function CoveragePill({ label, available }: { label: string; available: boolean }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        available
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
      )}
    >
      {available ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
      {label}: {available ? "Available" : "Missing"}
    </div>
  );
}

function RoleDimension({
  title,
  description,
  value,
  color,
  missingText,
  chart,
}: {
  title: string;
  description: string;
  value: number | null;
  color: string;
  missingText: string;
  chart: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-4">
        <PercentDonut value={value} color={color} />
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{title}</h3>
            {value != null && <Badge variant="outline">{bandOf(value)}</Badge>}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {value == null ? (
        <div className="mt-4 rounded-lg bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">{missingText}</div>
      ) : (
        chart
      )}
    </section>
  );
}

function PercentDonut({ value, color, size = 96 }: { value: number | null; color: string; size?: number }) {
  const data = [
    { name: "score", value: value ?? 0 },
    { name: "rest", value: 100 - (value ?? 0) },
  ];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie data={data} dataKey="value" innerRadius={size * 0.354} outerRadius={size * 0.479} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
          <Cell fill={color} />
          <Cell fill="#e2e8f0" />
        </Pie>
      </PieChart>
      <div className={cn("absolute inset-0 flex items-center justify-center font-bold", size < 80 ? "text-sm" : "text-lg")} style={{ color }}>
        {value == null ? "—" : `${value}%`}
      </div>
    </div>
  );
}

function BehaviourDonut({
  result,
  initials,
  size = 176,
  interactive = true,
}: {
  result: AssignmentResult;
  initials: string;
  size?: number;
  interactive?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const counters: Record<string, number> = {};
  const data = result.score.items.map((i) => {
    const g = i.group_name ?? "Behaviour";
    const palette = GROUP_COLOR[g] ?? GROUP_COLOR.Behaviour;
    const idx = counters[g] ?? 0;
    counters[g] = idx + 1;
    return { name: i.name, value: i.score ?? 0, weight: 1, color: palette[idx % palette.length], group: g };
  });
  const activeItem = activeIndex == null ? null : data[activeIndex];
  const pie = (
    <Pie
      data={data}
      dataKey="weight"
      nameKey="name"
      innerRadius={size * 0.295}
      outerRadius={size * 0.455}
      paddingAngle={2}
      stroke="none"
      isAnimationActive={false}
      onMouseEnter={interactive ? (_, index) => setActiveIndex(index) : undefined}
      onMouseLeave={interactive ? () => setActiveIndex(null) : undefined}
    >
      {data.map((d) => (
        <Cell key={d.name} fill={d.color} fillOpacity={0.35 + 0.65 * (d.value / 100)} />
      ))}
    </Pie>
  );
  return (
    <div className={cn("grid items-center", interactive ? "gap-5 sm:grid-cols-[190px_minmax(0,1fr)]" : "gap-4 grid-cols-[auto_minmax(0,1fr)]")}>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        {interactive ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>{pie}</PieChart>
          </ResponsiveContainer>
        ) : (
          <PieChart width={size} height={size}>{pie}</PieChart>
        )}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            className="flex flex-col items-center justify-center rounded-full bg-background text-center shadow-sm ring-1 ring-foreground/10"
            style={{ width: size * 0.45, height: size * 0.45 }}
          >
            <span className={cn("font-semibold", activeItem ? "text-lg tabular-nums" : interactive ? "text-base" : "text-sm")}>{activeItem ? `${activeItem.value}%` : initials}</span>
            {activeItem && <span className="mt-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{activeItem.group}</span>}
          </div>
        </div>
      </div>
      <div>
        <ul className={cn(interactive ? "space-y-0.5 text-xs" : "text-[10px]")}>
        {data.map((d, index) => (
          <li
            key={d.name}
            tabIndex={interactive ? 0 : undefined}
            onMouseEnter={interactive ? () => setActiveIndex(index) : undefined}
            onMouseLeave={interactive ? () => setActiveIndex(null) : undefined}
            onFocus={interactive ? () => setActiveIndex(index) : undefined}
            onBlur={interactive ? () => setActiveIndex(null) : undefined}
            className={cn(
              "flex cursor-default items-center gap-2 rounded-md outline-none",
              interactive ? "px-2 py-1 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary/40" : "py-px",
              activeIndex === index && "bg-muted"
            )}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="font-medium tabular-nums">{d.value}%</span>
          </li>
        ))}
        </ul>
        <div className={cn("flex flex-wrap gap-2 border-t text-muted-foreground", interactive ? "mt-3 pt-3 text-[11px]" : "mt-2 pt-2 text-[10px]")}>
          {Object.entries(result.score.groups).map(([g, v]) => (
            <span key={g} className={cn("rounded-full bg-muted", interactive ? "px-2 py-1" : "px-1.5 py-0.5")}>
              {g} <span className="font-semibold text-foreground">{v ?? "—"}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RadarBlock({
  data,
  color,
  width,
  height,
}: {
  data: { name: string; candidate: number; role: number }[];
  color: string;
  /** Fixed dimensions render a static chart (used by the print layout). */
  width?: number;
  height?: number;
}) {
  const chart = (
    <RadarChart data={data} outerRadius="70%" width={width} height={height}>
      <PolarGrid />
      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
      <Radar name="Candidate" dataKey="candidate" stroke={color} fill={color} fillOpacity={0.3} isAnimationActive={false} />
      <Radar name="Role standard" dataKey="role" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} strokeDasharray="4 3" isAnimationActive={false} />
      <Legend wrapperStyle={{ fontSize: width ? 10 : 11 }} />
      {!width && <Tooltip />}
    </RadarChart>
  );
  if (width && height) return chart;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
}

function SkillWillGrid({ group, compact }: { group: string; compact?: boolean }) {
  const cells: { label: string; key: string; cls: string }[] = [
    { label: "High skill\nlow will", key: "High skill, low will", cls: "rounded-tl-md" },
    { label: "High skill\nhigh will", key: "High skill, high will", cls: "rounded-tr-md" },
    { label: "Low skill\nlow will", key: "Low skill, low will", cls: "rounded-bl-md" },
    { label: "Low skill\nhigh will", key: "Low skill, high will", cls: "rounded-br-md" },
  ];
  return (
    <div className={cn("grid grid-cols-2 gap-1", compact ? "w-36" : "w-44")}>
      {cells.map((c) => (
        <div
          key={c.key}
          className={cn(
            "flex items-center justify-center whitespace-pre-line text-center leading-tight",
            compact ? "h-12 text-[9px]" : "h-16 text-[10px]",
            c.cls,
            c.key === group ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"
          )}
        >
          {c.label}
        </div>
      ))}
    </div>
  );
}

function DetailTable({ result, isSelf, title }: { result: AssignmentResult; isSelf: boolean; title: string }) {
  const isSkill = result.template.kind === "skill";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Advisory flags appear only when a defined rating-divergence rule is triggered.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              {!isSelf && <TableHead className="text-right">Self</TableHead>}
              {!isSelf && <TableHead className="text-right">Line mgr</TableHead>}
              {!isSelf && <TableHead className="text-right">{isSkill ? "Cross-dept" : "Peers"}</TableHead>}
              <TableHead className="text-center">Scenario</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Band</TableHead>
              <TableHead>Flag</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.score.items.map((i) => (
              <TableRow key={i.item_id}>
                <TableCell>
                  <div className="font-medium">{i.name}</div>
                  {i.group_name && <div className="text-xs text-muted-foreground">{i.group_name}</div>}
                </TableCell>
                {!isSelf && <TableCell className="text-right tabular-nums">{i.self ?? "—"}</TableCell>}
                {!isSelf && <TableCell className="text-right tabular-nums">{i.line_manager ?? "—"}</TableCell>}
                {!isSelf && (
                  <TableCell className="text-right tabular-nums">
                    {i.others_avg ?? "—"}
                    {i.others_count > 0 && <span className="ml-1 text-xs text-muted-foreground">({i.others_count})</span>}
                  </TableCell>
                )}
                <TableCell className="text-center">
                  {i.scenario_correct == null ? "—" : i.scenario_correct ? <span className="text-emerald-600">✓</span> : <span className="text-red-600">✗</span>}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{i.score ?? "—"}</TableCell>
                <TableCell>
                  {i.band && (
                    <Badge variant="outline" className={BAND_BADGE[i.band]}>
                      {i.band}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {i.flag ?? <span className="italic text-muted-foreground/70">No advisory flag</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ---------------- helpers ---------------- */

function bandOf(score: number | null): Band | null {
  if (score == null) return null;
  if (score >= 75) return "Strength";
  if (score >= 60) return "Meets standard";
  if (score >= 45) return "Development gap";
  return "Material gap";
}

function indexText(v: number | null) {
  const b = bandOf(v);
  if (b === "Strength") return "Above the standard. Use this person to help train others.";
  if (b === "Meets standard") return "Meets the standard for the role. No targeted action required.";
  if (b === "Development gap") return "Below the standard. Include in the targeted training group.";
  if (b === "Material gap") return "Material gap. Priority for training with a specific development action.";
  return "Not enough inputs yet to compute an index.";
}

function selfAwarenessText(items: ItemScore[]) {
  const gaps = items.map((i) => i.self_vs_rater_gap).filter((g): g is number => g != null);
  if (!gaps.length) return "Awaiting rater input for comparison.";
  const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (mean >= 1) return `Rates self ${mean.toFixed(1)} points above raters on average. Feedback conversation before training.`;
  if (mean <= -1) return `Rates self ${Math.abs(mean).toFixed(1)} points below raters on average. Likely under-confidence.`;
  return "Self-rating is broadly aligned with how others see the work.";
}

function dedupeWarnings(ws: Warning[]): Warning[] {
  const byCode = new Map<string, Warning>();
  for (const w of ws) {
    const existing = byCode.get(w.code);
    if (existing) existing.items = [...new Set([...existing.items, ...w.items])];
    else byCode.set(w.code, { ...w, items: [...w.items] });
  }
  return [...byCode.values()];
}

function shortName(name: string) {
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatDate(v: string | null) {
  if (!v) return "";
  return new Date(v).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
