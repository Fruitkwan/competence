import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

export function AssessmentTracker({ data }: { data: TrackerData }) {
  const total = data.departments.reduce((n, d) => n + d.rows.length, 0);
  const selfIn = data.departments.reduce((n, d) => n + d.selfIn, 0);
  const managerIn = data.departments.reduce((n, d) => n + d.managerIn, 0);
  const peerIn = data.departments.reduce((n, d) => n + d.peerIn, 0);
  const peerTotal = data.departments.reduce((n, d) => n + d.peerTotal, 0);
  const complete = data.departments.reduce((n, d) => n + d.complete, 0);
  const outstanding = data.raters.filter((r) => r.outstandingFor.length > 0);

  const stats: [string, string][] = [
    ["In scope", String(total)],
    ["Self assessments in", `${selfIn}/${total}`],
    ["Manager ratings in", `${managerIn}/${total}`],
    ["Peer ratings in", `${peerIn}/${peerTotal}`],
    ["Fully complete", `${complete}/${total}`],
    ["Overall progress", pct(selfIn + managerIn + peerIn, total * 2 + peerTotal)],
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

      {data.departments.map((dept) => (
        <Card key={dept.name} className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="font-semibold">{dept.name}</div>
            <div className="text-xs text-muted-foreground">
              {dept.complete}/{dept.rows.length} complete · peers {dept.peerIn}/{dept.peerTotal}
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
              {dept.rows.map((row: TrackerRow) => (
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
