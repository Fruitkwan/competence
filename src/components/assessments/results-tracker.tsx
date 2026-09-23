"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import type { TrackerData, TrackerRow } from "@/lib/assessments/tracker";

function Tick({ done }: { done: boolean }) {
  return done ? (
    <Badge variant="outline" className="border-emerald-300 text-emerald-700">Done</Badge>
  ) : (
    <Badge variant="outline" className="border-amber-300 text-amber-700">Pending</Badge>
  );
}

function pct(n: number, d: number) {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}

const STATUS_FILTERS = [
  ["all", "All"],
  ["incomplete", "Has pending"],
  ["complete", "Fully complete"],
  ["self", "Self pending"],
  ["manager", "Manager pending"],
  ["peers", "Peers pending"],
] as const;

function matches(row: TrackerRow, status: string) {
  switch (status) {
    case "incomplete": return !(row.selfDone && row.managerDone && row.peerDone >= row.peerTotal);
    case "complete": return row.selfDone && row.managerDone && row.peerDone >= row.peerTotal;
    case "self": return !row.selfDone;
    case "manager": return !row.managerDone;
    case "peers": return row.peerDone < row.peerTotal;
    default: return true;
  }
}

export function AssessmentTracker({ data }: { data: TrackerData }) {
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.departments
      .filter((d) => dept === "all" || d.name === dept)
      .map((d) => ({
        ...d,
        rows: d.rows.filter(
          (r) =>
            matches(r, status) &&
            (!q ||
              r.employeeName.toLowerCase().includes(q) ||
              (r.jobTitle ?? "").toLowerCase().includes(q) ||
              r.waitingOn.some((w) => w.toLowerCase().includes(q)))
        ),
      }))
      .filter((d) => d.rows.length > 0);
  }, [data, query, dept, status]);

  const shown = filtered.reduce((n, d) => n + d.rows.length, 0);
  const total = data.departments.reduce((n, d) => n + d.rows.length, 0);
  const selfIn = filtered.reduce((n, d) => n + d.rows.filter((r) => r.selfDone).length, 0);
  const managerIn = filtered.reduce((n, d) => n + d.rows.filter((r) => r.managerDone).length, 0);
  const peerIn = filtered.reduce((n, d) => n + d.rows.reduce((m, r) => m + r.peerDone, 0), 0);
  const peerTotal = filtered.reduce((n, d) => n + d.rows.reduce((m, r) => m + r.peerTotal, 0), 0);
  const complete = filtered.reduce(
    (n, d) => n + d.rows.filter((r) => r.selfDone && r.managerDone && r.peerDone >= r.peerTotal).length,
    0
  );
  const outstanding = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.raters.filter((r) => r.outstandingFor.length > 0 && (!q || r.name.toLowerCase().includes(q)));
  }, [data, query]);

  const stats: [string, string][] = [
    ["In scope", String(shown)],
    ["Self assessments in", `${selfIn}/${shown}`],
    ["Manager ratings in", `${managerIn}/${shown}`],
    ["Peer ratings in", `${peerIn}/${peerTotal}`],
    ["Fully complete", `${complete}/${shown}`],
    ["Overall progress", pct(selfIn + managerIn + peerIn, shown * 2 + peerTotal)],
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-72">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search employee, job title or rater…"
            className="pl-8"
          />
        </div>
        <Select value={dept} onValueChange={(v) => setDept(String(v ?? "all"))}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {data.departments.map((d) => (
              <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(String(v ?? "all"))}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(([v, label]) => (
              <SelectItem key={v} value={v}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(query || dept !== "all" || status !== "all") && (
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => { setQuery(""); setDept("all"); setStatus("all"); }}
          >
            Clear filters
          </button>
        )}
        <button
          className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          disabled={exporting || shown === 0}
          onClick={async () => {
            setExporting(true);
            try {
              const XLSX = await import("xlsx");
              const progress = filtered.flatMap((d) =>
                d.rows.map((r) => ({
                  Department: d.name,
                  "Employee ID": r.employeeId,
                  "Employee Name": r.employeeName,
                  "Job Title": r.jobTitle ?? "",
                  "Line Manager": r.managerName ?? "",
                  Assessment: r.assessment,
                  Kind: r.kind === "placement" ? "skill" : r.kind,
                  Wave: r.wave ?? "",
                  "Due Date": r.dueDate ?? "",
                  "Self done?": r.selfDone ? "Y" : "N",
                  "Manager done?": r.managerDone ? "Y" : "N",
                  "Peers in": r.peerDone,
                  "Peers total": r.peerTotal,
                  "STILL WAITING FOR": r.waitingOn.join("; "),
                  Status: r.status.replace("_", " "),
                }))
              );
              const chase = outstanding.map((r) => ({
                Rater: r.name,
                "Assigned to rate": r.assigned,
                Done: r.done,
                Outstanding: r.outstandingFor.length,
                "Waiting for": r.outstandingFor.join("; "),
              }));
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(progress), "Person_Progress");
              XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(chase), "Peer_Chase");
              XLSX.writeFile(wb, `assessment-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`);
            } finally {
              setExporting(false);
            }
          }}
        >
          <Download className="size-3.5" /> {exporting ? "Exporting…" : "Export Excel"}
        </button>
        <span className="ml-auto text-xs text-muted-foreground">
          Showing {shown} of {total}
        </span>
      </div>

      {filtered.length === 0 && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          No assignments match the current filters.
        </Card>
      )}

      {filtered.map((deptCard) => (
        <Card key={deptCard.name} className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-semibold">{deptCard.name}</div>
            <div className="text-xs text-muted-foreground">
              {deptCard.rows.filter((r) => r.selfDone && r.managerDone && r.peerDone >= r.peerTotal).length}/{deptCard.rows.length} complete
              {" · peers "}
              {deptCard.rows.reduce((n, r) => n + r.peerDone, 0)}/{deptCard.rows.reduce((n, r) => n + r.peerTotal, 0)}
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Self</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead className="text-right">Peers</TableHead>
                <TableHead>Still waiting on</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Report</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deptCard.rows.map((row: TrackerRow) => (
                <TableRow key={row.assignmentId}>
                  <TableCell>
                    <div className="font-medium">{row.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{row.jobTitle}</div>
                  </TableCell>
                  <TableCell>
                    {row.assessment}
                    <span className="ml-1 text-xs capitalize text-muted-foreground">({row.kind === "placement" ? "skill" : row.kind})</span>
                  </TableCell>
                  <TableCell><Tick done={row.selfDone} /></TableCell>
                  <TableCell><Tick done={row.managerDone} /></TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.peerTotal ? `${row.peerDone}/${row.peerTotal}` : "—"}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    {row.waitingOn.length ? (
                      <span className="text-xs text-amber-700">{row.waitingOn.join(", ")}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{row.dueDate ? formatDate(row.dueDate) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/assessments/${row.assignmentId}/report`} className="text-xs font-medium text-primary hover:underline">
                      Open
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}

      {outstanding.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b px-4 py-3 font-semibold">Raters who still owe a rating</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rater</TableHead>
                <TableHead className="text-right">Assigned</TableHead>
                <TableHead className="text-right">Done</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Waiting for</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.assigned}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.done}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.outstandingFor.length}</TableCell>
                  <TableCell className="max-w-96 whitespace-normal text-xs text-muted-foreground">{r.outstandingFor.join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
