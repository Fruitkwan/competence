"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AnalyticsRow = {
  employeeName: string;
  department: string;
  assessment: string;
  kind: string;
  wave: string | null;
  status: string;
  index: number | null;
  ratersIn: number;
  ratersTotal: number;
  flags: number;
};

const BAND_COLORS: Record<string, string> = {
  Strength: "#059669",
  "Meets standard": "#2563eb",
  "Development gap": "#d97706",
  "Material gap": "#dc2626",
  Unscored: "#94a3b8",
};

const STATUS_COLORS: Record<string, string> = {
  assigned: "#94a3b8",
  "in progress": "#d97706",
  submitted: "#059669",
  closed: "#2563eb",
};

function bandOf(index: number | null) {
  if (index == null) return "Unscored";
  if (index >= 75) return "Strength";
  if (index >= 60) return "Meets standard";
  if (index >= 45) return "Development gap";
  return "Material gap";
}

export function ResultsAnalytics({ rows }: { rows: AnalyticsRow[] }) {
  const [dept, setDept] = useState("all");
  const [kind, setKind] = useState("all");
  const [wave, setWave] = useState("all");
  const [band, setBand] = useState("all");

  const departments = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);
  const waves = useMemo(() => [...new Set(rows.map((r) => r.wave).filter((w): w is string => Boolean(w)))].sort(), [rows]);
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))].sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (dept === "all" || r.department === dept) &&
          (kind === "all" || r.kind === kind) &&
          (wave === "all" || r.wave === wave) &&
          (band === "all" || bandOf(r.index) === band)
      ),
    [rows, dept, kind, wave, band]
  );

  const scored = filtered.filter((r) => r.index != null);
  const avgIndex = scored.length ? Math.round(scored.reduce((n, r) => n + (r.index ?? 0), 0) / scored.length) : null;
  const complete = filtered.filter((r) => r.status === "submitted" || r.status === "closed").length;
  const flagged = filtered.filter((r) => r.flags > 0).length;

  const bandData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) counts.set(bandOf(r.index), (counts.get(bandOf(r.index)) ?? 0) + 1);
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const deptData = useMemo(() => {
    const byDept = new Map<string, { total: number; count: number }>();
    for (const r of scored) {
      const e = byDept.get(r.department) ?? { total: 0, count: 0 };
      e.total += r.index ?? 0;
      e.count += 1;
      byDept.set(r.department, e);
    }
    return [...byDept.entries()]
      .map(([name, v]) => ({ name, avg: Math.round(v.total / v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg);
  }, [scored]);

  const distData = useMemo(() => {
    const buckets = [
      { name: "0–44", min: 0, max: 44, count: 0 },
      { name: "45–59", min: 45, max: 59, count: 0 },
      { name: "60–74", min: 60, max: 74, count: 0 },
      { name: "75–100", min: 75, max: 100, count: 0 },
    ];
    for (const r of scored) {
      const b = buckets.find((b) => (r.index ?? 0) >= b.min && (r.index ?? 0) <= b.max);
      if (b) b.count += 1;
    }
    return buckets;
  }, [scored]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of filtered) {
      const s = r.status.replace("_", " ");
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const stats: [string, string][] = [
    ["Assignments", String(filtered.length)],
    ["Avg index", avgIndex != null ? String(avgIndex) : "—"],
    ["Scored", `${scored.length}/${filtered.length}`],
    ["Complete", `${complete}/${filtered.length}`],
    ["With warnings", String(flagged)],
  ];

  const filterRow = (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={dept} onValueChange={(v) => setDept(String(v ?? "all"))}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Department" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All departments</SelectItem>
          {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={kind} onValueChange={(v) => setKind(String(v ?? "all"))}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {kinds.map((k) => <SelectItem key={k} value={k} className="capitalize">{k === "placement" ? "skill" : k}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={wave} onValueChange={(v) => setWave(String(v ?? "all"))}>
        <SelectTrigger className="w-44"><SelectValue placeholder="Wave" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All waves</SelectItem>
          {waves.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={band} onValueChange={(v) => setBand(String(v ?? "all"))}>
        <SelectTrigger className="w-48"><SelectValue placeholder="Band" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All bands</SelectItem>
          {["Strength", "Meets standard", "Development gap", "Material gap", "Unscored"].map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(dept !== "all" || kind !== "all" || wave !== "all" || band !== "all") && (
        <button className="text-xs font-medium text-primary hover:underline" onClick={() => { setDept("all"); setKind("all"); setWave("all"); setBand("all"); }}>
          Clear filters
        </button>
      )}
      <span className="ml-auto text-xs text-muted-foreground">Showing {filtered.length} of {rows.length}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {filterRow}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map(([label, value]) => (
          <Card key={label} className="p-3">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Band distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              {bandData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bandData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {bandData.map((e) => <Cell key={e.name} fill={BAND_COLORS[e.name] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={24} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Completion status</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              {statusData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      {statusData.map((e) => <Cell key={e.name} fill={STATUS_COLORS[e.name] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={24} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Average index by department</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              {deptData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deptData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v, _n, item) => [`${v} (${item.payload.count} scored)`, "Avg index"]} />
                    <Bar dataKey="avg" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Score distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              {scored.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {distData.map((b) => (
                        <Cell key={b.name} fill={b.min >= 75 ? "#059669" : b.min >= 60 ? "#2563eb" : b.min >= 45 ? "#d97706" : "#dc2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty />}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Empty() {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
      No data for the current filters
    </div>
  );
}
