"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { HeatmapTable } from "@/components/training/heatmap-table";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/* =====================================================================
   DEMO DATA — mirrors the original HTML file exactly
   ===================================================================== */

const METRICS = [
  { label: "Responses received", value: "47", sub: "of 62 sent" },
  { label: "Training matches found", value: "31", sub: "trainer ↔ learner pairs" },
  { label: "Critical urgency requests", value: "8", sub: "need immediate action" },
  { label: "Depts with trainers available", value: "9", sub: "out of 10 departments" },
];

const FILTER_DEPTS = [
  "All departments", "IT", "Product", "Sales",
  "Marketing", "Finance", "HR", "Operations",
];

/* --- Heatmap data --- */
const HEAT_DEPTS = ["IT", "Product", "Sales", "Marketing", "Finance", "Operations"];
const HEAT_ROWS = [
  [null, 6, 2, 4, 1, 2],
  [8, null, 5, 4, 2, 2],
  [3, 5, null, 7, 4, 1],
  [4, 4, 6, null, 2, 0],
  [1, 3, 4, 2, null, 5],
  [5, 3, 2, 1, 6, null],
];

/* --- Matches data --- */
const MATCHES = [
  { initials: "AK", name: "Ali Karimov", deptFrom: "IT", learnDept: "Product", topic: "API basics", fit: "High", avatarBg: "bg-blue-100 text-blue-700" },
  { initials: "SC", name: "Sara Chen", deptFrom: "Finance", learnDept: "Operations", topic: "Budgeting & forecasting", fit: "High", avatarBg: "bg-amber-100 text-amber-700" },
  { initials: "MP", name: "Maria Patel", deptFrom: "Marketing", learnDept: "Sales", topic: "Campaign strategy", fit: "High", avatarBg: "bg-emerald-100 text-emerald-700" },
  { initials: "JN", name: "James Nguyen", deptFrom: "Product", learnDept: "IT", topic: "Roadmap & prioritization", fit: "Medium", avatarBg: "bg-violet-100 text-violet-700" },
  { initials: "LR", name: "Layla Rashid", deptFrom: "HR", learnDept: "Finance", topic: "Compensation structure", fit: "Medium", avatarBg: "bg-pink-100 text-pink-700" },
  { initials: "DW", name: "David Wu", deptFrom: "Design", learnDept: "Marketing", topic: "Brand & visual design", fit: "Medium", avatarBg: "bg-orange-100 text-orange-700" },
];

type UrgencyLevel = "Critical" | "High" | "Medium" | "Low";

const URGENCY_DOT: Record<UrgencyLevel, string> = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

type RequestStatus = "Matched" | "Pending" | "Unmatched";

const STATUS_STYLE: Record<RequestStatus, string> = {
  Matched: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Unmatched: "bg-muted text-muted-foreground",
};

interface RequestRow {
  initials: string;
  name: string;
  role: string;
  dept: string;
  learnFrom: string;
  canTrain: string;
  urgency: UrgencyLevel;
  format: string;
  hrs: string;
  status: RequestStatus;
  avatarBg: string;
}

const REQUESTS: RequestRow[] = [
  { initials: "AK", name: "Ali Karimov", role: "Sr. Engineer", dept: "IT", learnFrom: "Product, Marketing", canTrain: "Sales, HR, Ops", urgency: "Critical", format: "1-on-1", hrs: "3–5", status: "Matched", avatarBg: "bg-blue-100 text-blue-700" },
  { initials: "SC", name: "Sara Chen", role: "Finance Manager", dept: "Finance", learnFrom: "Operations, Sales", canTrain: "Engineering, Product", urgency: "Critical", format: "Workshop", hrs: "6–10", status: "Matched", avatarBg: "bg-amber-100 text-amber-700" },
  { initials: "MP", name: "Maria Patel", role: "Mkt Lead", dept: "Marketing", learnFrom: "Sales, IT", canTrain: "HR, Finance", urgency: "High", format: "Group session", hrs: "3–5", status: "Matched", avatarBg: "bg-emerald-100 text-emerald-700" },
  { initials: "JN", name: "James Nguyen", role: "Product Manager", dept: "Product", learnFrom: "IT, Design", canTrain: "Marketing, Sales", urgency: "High", format: "1-on-1", hrs: "1–2", status: "Pending", avatarBg: "bg-violet-100 text-violet-700" },
  { initials: "LR", name: "Layla Rashid", role: "HR Specialist", dept: "HR", learnFrom: "Finance, Legal", canTrain: "Operations", urgency: "High", format: "Self-paced", hrs: "3–5", status: "Pending", avatarBg: "bg-pink-100 text-pink-700" },
  { initials: "DW", name: "David Wu", role: "Senior Designer", dept: "Design", learnFrom: "Marketing, Product", canTrain: "Engineering, HR", urgency: "Medium", format: "Lunch & learn", hrs: "1–2", status: "Pending", avatarBg: "bg-orange-100 text-orange-700" },
  { initials: "RB", name: "Rania Bashir", role: "Account Executive", dept: "Sales", learnFrom: "Finance, Marketing", canTrain: "Customer Success", urgency: "Medium", format: "Workshop", hrs: "3–5", status: "Unmatched", avatarBg: "bg-emerald-100 text-emerald-700" },
  { initials: "TM", name: "Tom Mills", role: "Ops Analyst", dept: "Operations", learnFrom: "Finance, IT", canTrain: "Supply Chain", urgency: "Low", format: "Self-paced", hrs: "1–2", status: "Unmatched", avatarBg: "bg-muted text-muted-foreground" },
];

const DEPT_TAG: Record<string, string> = {
  IT: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Product: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  Sales: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Marketing: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Finance: "bg-lime-50 text-lime-700 dark:bg-lime-950 dark:text-lime-400",
  HR: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-400",
  Operations: "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-400",
  "Customer Success": "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
  Design: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  "Data & Analytics": "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
};

/* =====================================================================
   COMPONENT
   ===================================================================== */

export default function TrainingDashboardPage() {
  const [activeDept, setActiveDept] = useState("All departments");
  const [search, setSearch] = useState("");

  const filteredRequests = REQUESTS.filter((r) => {
    const matchesDept = activeDept === "All departments" || r.dept === activeDept;
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.dept.toLowerCase().includes(search.toLowerCase());
    return matchesDept && matchesSearch;
  });

  return (
    <>
      <PageHeader
        title="Cross-Functional Training"
        description="Manager dashboard — training demand, matches, and requests overview."
        actions={
          <>
            <NativeSelect
              options={["Q2 2025 Cycle", "Q1 2025 Cycle", "Q4 2024 Cycle"]}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                alert("Export feature: connect to your data backend to enable CSV/PDF export.")
              }
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      {/* ---- Metrics ---- */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {METRICS.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {m.label}
              </div>
              <div className="mt-1 text-2xl font-semibold">{m.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground/60">{m.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ---- Filters ---- */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        {FILTER_DEPTS.map((d) => (
          <button
            key={d}
            onClick={() => setActiveDept(d)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors select-none",
              activeDept === d
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            {d}
          </button>
        ))}
      </div>

      {/* ---- Heatmap + Matches ---- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Training demand heatmap</CardTitle>
            <CardDescription>
              Rows = who wants to learn · Columns = from which dept
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeatmapTable departments={HEAT_DEPTS} rows={HEAT_ROWS} />
          </CardContent>
        </Card>

        {/* Matches */}
        <Card>
          <CardHeader>
            <CardTitle>Top training matches</CardTitle>
            <CardDescription>Best trainer–learner pairs</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Trainer</th>
                  <th className="pb-2">Learner dept</th>
                  <th className="pb-2">Topic</th>
                  <th className="pb-2">Fit</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {MATCHES.map((m) => (
                  <tr key={m.name} className="border-t border-border">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            m.avatarBg
                          )}
                        >
                          {m.initials}
                        </div>
                        <div>
                          <div className="font-medium">{m.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {m.deptFrom}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          DEPT_TAG[m.learnDept] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {m.learnDept}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{m.topic}</td>
                    <td>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          m.fit === "High"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                        )}
                      >
                        {m.fit === "High" ? "★" : "◆"} {m.fit}
                      </span>
                    </td>
                    <td>
                      <Button variant="outline" size="xs">
                        Pair
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* ---- All Requests Table ---- */}
      <Card className="mt-5">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>All training requests</CardTitle>
            <CardDescription>
              Sorted by urgency — click a row to view full response
            </CardDescription>
          </div>
          <Input
            className="w-56"
            placeholder="Search by name or department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Wants to learn from</th>
                <th className="pb-2">Can train</th>
                <th className="pb-2">Urgency</th>
                <th className="pb-2">Format</th>
                <th className="pb-2">Hrs/mo</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => (
                <tr
                  key={r.name}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-accent/50"
                >
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                          r.avatarBg
                        )}
                      >
                        {r.initials}
                      </div>
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.role}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        DEPT_TAG[r.dept] ?? "bg-muted text-muted-foreground"
                      )}
                    >
                      {r.dept}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{r.learnFrom}</td>
                  <td className="text-muted-foreground">{r.canTrain}</td>
                  <td>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          URGENCY_DOT[r.urgency]
                        )}
                      />
                      {r.urgency}
                    </span>
                  </td>
                  <td className="text-muted-foreground">{r.format}</td>
                  <td className="text-muted-foreground">{r.hrs}</td>
                  <td>
                    <span
                      className={cn(
                        "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        STATUS_STYLE[r.status]
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No requests match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

/* ---- Tiny helper ---- */
function NativeSelect({ options }: { options: string[] }) {
  return (
    <select className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  );
}
