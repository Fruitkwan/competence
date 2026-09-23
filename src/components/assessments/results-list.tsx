"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";

export type ResultListRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  department: string;
  assessment: string;
  kind: string;
  wave: string | null;
  dueDate: string | null;
  assignmentStatus: string;
  resultsReleased: boolean;
  index: number | null;
  provisional: boolean;
  selfDone: boolean;
  ratersIn: number;
  ratersTotal: number;
  flags: number;
};

type Progress = "awaiting_self" | "waiting_raters" | "ready" | "released" | "closed";

const BAND_STYLE: Record<string, string> = {
  Strength: "border-emerald-300 text-emerald-700",
  "Meets standard": "border-blue-300 text-blue-700",
  "Development gap": "border-amber-300 text-amber-700",
  "Material gap": "border-red-300 text-red-700",
};

const PROGRESS_STYLE: Record<Progress, string> = {
  awaiting_self: "border-slate-300 text-slate-700",
  waiting_raters: "border-amber-300 text-amber-700",
  ready: "border-blue-300 text-blue-700",
  released: "border-emerald-300 text-emerald-700",
  closed: "border-slate-300 text-slate-600",
};

function bandOf(score: number | null) {
  if (score == null) return "Unscored";
  if (score >= 75) return "Strength";
  if (score >= 60) return "Meets standard";
  if (score >= 45) return "Development gap";
  return "Material gap";
}

function progressOf(row: ResultListRow): Progress {
  if (row.assignmentStatus === "closed") return "closed";
  if (row.resultsReleased) return "released";
  if (!row.selfDone) return "awaiting_self";
  if (row.ratersTotal === 0 || row.ratersIn < row.ratersTotal) return "waiting_raters";
  return "ready";
}

function progressLabel(row: ResultListRow) {
  const progress = progressOf(row);
  if (progress === "awaiting_self") return row.assignmentStatus === "in_progress" ? "Employee in progress" : "Awaiting employee";
  if (progress === "waiting_raters") return row.ratersTotal === 0 ? "Raters not assigned" : "Waiting for raters";
  if (progress === "ready") return "Ready to review";
  if (progress === "released") return "Released";
  return "Closed";
}

function isOverdue(row: ResultListRow) {
  if (!row.dueDate || progressOf(row) === "released" || progressOf(row) === "closed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${row.dueDate}T00:00:00`).getTime() < today.getTime();
}

export function ResultsList({ rows }: { rows: ResultListRow[] }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [wave, setWave] = useState("all");
  const [progress, setProgress] = useState("all");
  const [band, setBand] = useState("all");

  const departments = useMemo(() => [...new Set(rows.map((row) => row.department))].sort(), [rows]);
  const waves = useMemo(
    () => [...new Set(rows.map((row) => row.wave).filter((value): value is string => Boolean(value)))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.employeeName.toLowerCase().includes(normalizedQuery) ||
        row.employeeId.toLowerCase().includes(normalizedQuery) ||
        (row.jobTitle ?? "").toLowerCase().includes(normalizedQuery) ||
        row.assessment.toLowerCase().includes(normalizedQuery);
      const matchesProgress =
        progress === "all" ||
        progressOf(row) === progress ||
        (progress === "attention" && (isOverdue(row) || row.flags > 0 || (row.selfDone && row.ratersTotal === 0)));
      return (
        matchesQuery &&
        (department === "all" || row.department === department) &&
        (wave === "all" || row.wave === wave) &&
        matchesProgress &&
        (band === "all" || bandOf(row.index) === band)
      );
    });
  }, [rows, query, department, wave, progress, band]);

  const awaitingEmployee = rows.filter((row) => progressOf(row) === "awaiting_self").length;
  const waitingRaters = rows.filter((row) => progressOf(row) === "waiting_raters").length;
  const ready = rows.filter((row) => progressOf(row) === "ready").length;
  const attention = rows.filter((row) => isOverdue(row) || row.flags > 0 || (row.selfDone && row.ratersTotal === 0)).length;
  const hasFilters = Boolean(query) || department !== "all" || wave !== "all" || progress !== "all" || band !== "all";

  const clearFilters = () => {
    setQuery("");
    setDepartment("all");
    setWave("all");
    setProgress("all");
    setBand("all");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Assignments", rows.length],
          ["Awaiting employee", awaitingEmployee],
          ["Waiting for raters", waitingRaters],
          ["Ready to review", ready],
          ["Needs attention", attention],
        ].map(([label, value]) => (
          <Card key={label} className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-64 flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search assessment results"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employee, ID, title or assessment…"
            className="pl-8"
          />
        </div>
        <Select value={department} onValueChange={(value) => setDepartment(String(value ?? "all"))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={wave} onValueChange={(value) => setWave(String(value ?? "all"))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Wave" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All waves</SelectItem>
            {waves.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={progress} onValueChange={(value) => setProgress(String(value ?? "all"))}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Progress" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All progress</SelectItem>
            <SelectItem value="attention">Needs attention</SelectItem>
            <SelectItem value="awaiting_self">Awaiting employee</SelectItem>
            <SelectItem value="waiting_raters">Waiting for raters</SelectItem>
            <SelectItem value="ready">Ready to review</SelectItem>
            <SelectItem value="released">Released</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={band} onValueChange={(value) => setBand(String(value ?? "all"))}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Band" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bands</SelectItem>
            {["Strength", "Meets standard", "Development gap", "Material gap", "Unscored"].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={clearFilters}>
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">Showing {filtered.length} of {rows.length}</span>
        <a href="/api/export/assessment-results" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Export all
        </a>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Assessment</TableHead>
              <TableHead>Wave</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Index</TableHead>
              <TableHead>Band</TableHead>
              <TableHead className="text-right">Raters</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <div className="font-medium">No assessments match these filters</div>
                  <button type="button" className="mt-1 text-sm text-primary hover:underline" onClick={clearFilters}>
                    Clear filters
                  </button>
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => {
              const progressValue = progressOf(row);
              const bandValue = bandOf(row.index);
              const overdue = isOverdue(row);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{row.jobTitle || row.employeeId}</div>
                  </TableCell>
                  <TableCell>
                    {row.assessment}
                    <span className="ml-1 text-xs capitalize text-muted-foreground">({row.kind === "placement" ? "skill" : row.kind})</span>
                  </TableCell>
                  <TableCell>
                    {row.wave ?? "—"}
                    {row.dueDate && (
                      <div className={overdue ? "text-xs font-medium text-red-600" : "text-xs text-muted-foreground"}>
                        {overdue ? "Overdue " : "due "}{formatDate(row.dueDate)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={PROGRESS_STYLE[progressValue]}>{progressLabel(row)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{row.index ?? "—"}</TableCell>
                  <TableCell>
                    {row.index != null && <Badge variant="outline" className={BAND_STYLE[bandValue]}>{bandValue}</Badge>}
                    {row.provisional && row.index != null && <div className="text-[10px] text-amber-600">provisional</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.ratersTotal ? `${row.ratersIn}/${row.ratersTotal}` : <span className="text-red-600">0 assigned</span>}
                  </TableCell>
                  <TableCell>
                    {row.flags > 0 ? (
                      <span className="inline-flex items-center gap-1 font-medium text-amber-700" title={`${row.flags} result flag${row.flags === 1 ? "" : "s"}`}>
                        <AlertTriangle className="size-3.5" aria-hidden="true" /> {row.flags}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/assessments/${row.id}/report`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
