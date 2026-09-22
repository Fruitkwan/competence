"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Loader2, ShieldAlert } from "lucide-react";
import { SignatureField } from "@/components/assessments/assessment-report";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { saveRecordScores, signAssessmentReport } from "@/lib/actions/assessments";
import type { PlacementReport, RecordScores } from "@/lib/assessments/placement";
import type { SignSlot } from "@/lib/assessments/results";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

const PART_THRESHOLDS: Record<number, string> = {
  1: "Gate: 12+ and no 0-point answer",
  2: "Senior threshold: 14+ (12+ floor for Sales Manager)",
  3: "Sales Manager threshold: 15+ (13–14 Acting)",
  4: "Gate: any 0-point answer caps at Sales Executive",
};

const RECORD_LABELS: Record<keyof RecordScores, string> = {
  commercial: "Commercial record",
  account: "Account record",
  leadership: "Leadership record",
};

function RecordScoresCard({ report }: { report: PlacementReport }) {
  const router = useRouter();
  const [values, setValues] = useState<RecordScores>(report.record);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="size-4" /> Verified performance record
        </CardTitle>
        <CardDescription>
          12-month record, entered by HR. A missing commercial record leaves the result pending; missing sections count as unmet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          {(Object.keys(RECORD_LABELS) as (keyof RecordScores)[]).map((key) => (
            <div key={key} className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{RECORD_LABELS[key]} (0–100)</span>
              {report.canEnterRecord ? (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Not verified"
                  value={values[key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [key]: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                />
              ) : (
                <div className="text-sm font-semibold tabular-nums">{values[key] ?? "—"}</div>
              )}
            </div>
          ))}
        </div>
        {report.canEnterRecord && (
          <Button
            className="mt-4"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await saveRecordScores(report.assignment.id, values);
                if (res.error) toast.error(res.error);
                else {
                  toast.success("Record scores saved.");
                  router.refresh();
                }
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Save record
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function PlacementReportView({ report }: { report: PlacementReport }) {
  const router = useRouter();
  const { employee, template, assignment, parts, outcome, raterEvidence, raters, signatures, canSign } = report;

  async function sign(slot: SignSlot, date: string) {
    const res = await signAssessmentReport(assignment.id, slot, date);
    if (res.error) toast.error(res.error);
    else {
      toast.success("Report signed.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <header className="overflow-hidden rounded-xl border border-teal-200/70 bg-gradient-to-r from-teal-50 via-white to-white px-6 py-5 dark:border-teal-900 dark:from-teal-950/40 dark:via-background dark:to-background">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">Dhofar Global</div>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">Skill assessment report</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{template.name}</p>
          </div>
          <div className="rounded-full border border-teal-300 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-800 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-200">
            Confidential
          </div>
        </div>
        <div className="mt-5 grid gap-3 border-t border-teal-200/60 pt-4 text-xs text-slate-700 dark:border-teal-900 dark:text-slate-200 sm:grid-cols-4">
          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Employee</span>{employee.full_name}</div>
          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Job title</span>{employee.job_title}</div>
          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Assessment wave</span>{assignment.wave ?? "Not specified"}</div>
          <div><span className="block text-[10px] uppercase tracking-wider text-slate-500">Submitted</span>{formatDate(assignment.submitted_at) || "—"}</div>
        </div>
      </header>

      {/* Outcome */}
      <Card className={cn(outcome.pendingRecord && "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20")}>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-xl">{outcome.label}</CardTitle>
            {outcome.step > 0 && <Badge variant="outline">Ladder step {outcome.step}</Badge>}
            {outcome.pendingRecord && (
              <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">
                Awaiting record
              </Badge>
            )}
          </div>
          <CardDescription className="text-sm leading-relaxed">{outcome.reason}</CardDescription>
        </CardHeader>
      </Card>

      {/* Part scores */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {parts.map((p) => (
          <Card key={p.part} className={cn(p.part === 4 && p.zeroItems.length > 0 && "border-red-300 dark:border-red-800")}>
            <CardHeader className="gap-1 pb-3">
              <CardTitle className="text-sm">Part {p.part} — {p.name}</CardTitle>
              <CardDescription className="text-xs">{PART_THRESHOLDS[p.part]}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums">{p.points}</span>
                <span className="text-sm text-muted-foreground">/ {p.outOf}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                {[4, 2, 1, 0].map((v) => {
                  const n = p.answers.filter((a) => a.points === v).length;
                  return (
                    <span key={v} className={cn("rounded border px-1.5 py-0.5 tabular-nums", v === 0 && n > 0 && "border-red-300 text-red-700 dark:text-red-300")}>
                      {n}×{v}pt
                    </span>
                  );
                })}
                <span className="rounded border px-1.5 py-0.5 tabular-nums text-muted-foreground">{p.answered}/{p.answers.length} answered</span>
              </div>
              {p.zeroItems.length > 0 && (
                <p className="mt-2 flex items-start gap-1 text-[11px] text-red-700 dark:text-red-300">
                  <ShieldAlert className="mt-0.5 size-3 shrink-0" />
                  0-point answer{p.zeroItems.length > 1 ? "s" : ""}: {p.zeroItems.join("; ")}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <RecordScoresCard report={report} />

      {/* Rater evidence — averages only, never attributed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rater evidence</CardTitle>
          <CardDescription>
            Line manager and cross-departmental ratings shown as averages only. A gap of 2+ points between them is flagged for calibration.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Question</TableHead>
                <TableHead className="text-right">Line manager</TableHead>
                <TableHead className="text-right">Other raters (avg)</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {raterEvidence.map((r) => (
                <TableRow key={r.itemId}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.group}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.managerAvg?.toFixed(1) ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.othersAvg?.toFixed(1) ?? "—"}
                    <span className="ml-1 text-xs text-muted-foreground">({r.othersCount})</span>
                  </TableCell>
                  <TableCell>
                    {r.divergence && (
                      <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
                        2+ gap
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rater status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rater status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {raters.map((r, i) => (
            <Badge key={i} variant="outline" className={cn("gap-1 capitalize", r.status === "submitted" && "border-emerald-300 text-emerald-700 dark:text-emerald-300")}>
              {r.status === "submitted" && <CheckCircle2 className="size-3" />}
              {r.type.replace("_", " ")} · {r.status.replace("_", " ")}
            </Badge>
          ))}
        </CardContent>
      </Card>

      {/* Signatures */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acknowledgement</CardTitle>
          <CardDescription>Each party confirms the report has been reviewed. Signing records name and date only.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <SignatureField role="Employee" name={employee.full_name} signature={signatures.employee} canSign={canSign.employee} onSign={(d) => sign("employee", d)} />
          <SignatureField role="Line manager" signature={signatures.manager} canSign={canSign.manager} onSign={(d) => sign("manager", d)} />
          <SignatureField role="HR representative" signature={signatures.hr} canSign={canSign.hr} onSign={(d) => sign("hr", d)} />
        </CardContent>
      </Card>
    </div>
  );
}
