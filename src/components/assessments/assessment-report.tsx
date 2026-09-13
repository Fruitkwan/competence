"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Download, Loader2, ShieldAlert, Target, Brain, Scale } from "lucide-react";
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
      await exportToPdf(printRef.current, `Assessment_${employee.employee_id}_${(wave ?? "report").replace(/\s+/g, "_")}.pdf`);
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

      <div ref={printRef} className="space-y-4 rounded-xl bg-background p-1">
        {/* Row 1: profile / behavioural donut / warnings */}
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1.2fr_1fr]">
          <Card className="border-2">
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
                <p className="text-sm text-muted-foreground">No skill assessment on record for this wave.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold">Behavioural Profile</CardTitle>
            </CardHeader>
            <CardContent>
              {behaviour ? (
                <BehaviourDonut result={behaviour} initials={initials(employee.full_name)} />
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">No behaviour assessment on record for this wave.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-2">
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
        <Card className="border-2">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Target className="h-4 w-4 text-primary" /> Role Match for: {roleFamily}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <PercentDonut value={skill?.score.index ?? null} color="#4f46e5" />
                  <div>
                    <div className="text-sm font-medium">Skill</div>
                    <div className="text-xs text-muted-foreground">Average of competency scores vs a {STANDARD}% standard</div>
                  </div>
                </div>
                {skill && skill.score.items.length > 0 && (
                  <RadarBlock
                    data={skill.score.items.map((i) => ({ name: shortName(i.name), candidate: i.score ?? 0, role: STANDARD }))}
                    color="#4f46e5"
                  />
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <PercentDonut value={behaviour?.score.will_index ?? null} color="#db2777" />
                  <div>
                    <div className="text-sm font-medium">Will</div>
                    <div className="text-xs text-muted-foreground">Desire and Attitude combined vs a {STANDARD}% standard</div>
                  </div>
                </div>
                {behaviour && behaviour.score.items.length > 0 && (
                  <RadarBlock
                    data={behaviour.score.items.map((i) => ({ name: shortName(i.name), candidate: i.score ?? 0, role: STANDARD }))}
                    color="#db2777"
                  />
                )}
              </div>
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

        <p className="px-2 text-[10px] text-muted-foreground">
          Scores are weighted percentages ({skill ? "cross-departmental 40 / line manager 20 / scenario 30 / self 10" : ""}
          {skill && behaviour ? "; " : ""}
          {behaviour ? "peer 45 / line manager 20 / scenario 25 / self 10" : ""}). Bands: Strength ≥75, Meets standard ≥60,
          Development gap ≥45, Material gap &lt;45. Individual rater scores are never disclosed; a result is provisional below three
          rater responses.
        </p>
      </div>
    </div>
  );
}

/* ---------------- blocks ---------------- */

function Stat({ ring, title, text }: { ring: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-4">
      {ring}
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{text}</div>
      </div>
    </div>
  );
}

function ScoreRing({ value, band }: { value: number | null; band: Band | null }) {
  const color = band ? BAND_COLOR[band] : "#94a3b8";
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
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
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function IconRing({ icon, tone }: { icon: React.ReactNode; tone: string }) {
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: tone, color: tone, backgroundColor: `${tone}14` }}
    >
      {icon}
    </div>
  );
}

function PercentDonut({ value, color }: { value: number | null; color: string }) {
  const data = [
    { name: "score", value: value ?? 0 },
    { name: "rest", value: 100 - (value ?? 0) },
  ];
  return (
    <div className="relative h-24 w-24 shrink-0">
      <PieChart width={96} height={96}>
        <Pie data={data} dataKey="value" innerRadius={34} outerRadius={46} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={false}>
          <Cell fill={color} />
          <Cell fill="#e2e8f0" />
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color }}>
        {value == null ? "—" : `${value}%`}
      </div>
    </div>
  );
}

function BehaviourDonut({ result, initials }: { result: AssignmentResult; initials: string }) {
  const counters: Record<string, number> = {};
  const data = result.score.items.map((i) => {
    const g = i.group_name ?? "Behaviour";
    const palette = GROUP_COLOR[g] ?? GROUP_COLOR.Behaviour;
    const idx = counters[g] ?? 0;
    counters[g] = idx + 1;
    return { name: i.name, value: i.score ?? 0, weight: 1, color: palette[idx % palette.length], group: g };
  });
  return (
    <div className="grid items-center gap-2 sm:grid-cols-[180px_1fr]">
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="weight" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} fillOpacity={0.35 + 0.65 * (d.value / 100)} />
              ))}
            </Pie>
            <Tooltip formatter={(v, _n, p) => [`${(p as { payload?: { value?: number } }).payload?.value ?? v}%`, ""]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-base font-semibold">{initials}</div>
        </div>
      </div>
      <ul className="space-y-1 text-xs">
        {data.map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="flex-1 truncate">{d.name}</span>
            <span className="font-medium tabular-nums">{d.value}%</span>
          </li>
        ))}
        <li className="mt-2 flex gap-3 border-t pt-2 text-[11px] text-muted-foreground">
          {Object.entries(result.score.groups).map(([g, v]) => (
            <span key={g}>
              {g} <span className="font-medium text-foreground">{v ?? "—"}</span>
            </span>
          ))}
        </li>
      </ul>
    </div>
  );
}

function RadarBlock({ data, color }: { data: { name: string; candidate: number; role: number }[]; color: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
          <Radar name="Candidate" dataKey="candidate" stroke={color} fill={color} fillOpacity={0.3} isAnimationActive={false} />
          <Radar name="Role standard" dataKey="role" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.08} strokeDasharray="4 3" isAnimationActive={false} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Tooltip />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SkillWillGrid({ group }: { group: string }) {
  const cells: { label: string; key: string; cls: string }[] = [
    { label: "High skill\nlow will", key: "High skill, low will", cls: "rounded-tl-md" },
    { label: "High skill\nhigh will", key: "High skill, high will", cls: "rounded-tr-md" },
    { label: "Low skill\nlow will", key: "Low skill, low will", cls: "rounded-bl-md" },
    { label: "Low skill\nhigh will", key: "Low skill, high will", cls: "rounded-br-md" },
  ];
  return (
    <div className="grid w-44 grid-cols-2 gap-1">
      {cells.map((c) => (
        <div
          key={c.key}
          className={cn(
            "flex h-16 items-center justify-center whitespace-pre-line text-center text-[10px] leading-tight",
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
                <TableCell className="text-xs text-muted-foreground">{i.flag ?? ""}</TableCell>
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
