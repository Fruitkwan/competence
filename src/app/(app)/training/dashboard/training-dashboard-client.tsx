"use client";

import Link from "next/link";
import { useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { HeatmapTable } from "@/components/training/heatmap-table";
import { cn } from "@/lib/utils";

type UrgencyLevel = "Critical" | "High" | "Medium" | "Low";
type RequestStatus = "Matched" | "Pending" | "Unmatched";
type TrainingType = "cross_functional" | "skill_gap" | "general";

export type TrainingDashboardData = {
  cycles: string[];
  trainingTypes: { id: TrainingType; label: string }[];
  filters: string[];
  metrics: { label: string; value: string; sub: string }[];
  heatmapDepartments: string[];
  heatmapRows: (number | null)[][];
  recentAssignments: AssignmentRow[];
  assignments: AssignmentRow[];
  recentSurveyResponses: SurveyResponseRow[];
  surveyResponses: SurveyResponseRow[];
};

type AssignmentRow = {
  id: string;
  initials: string;
  name: string;
  role: string;
  dept: string;
  course: string;
  focus: string;
  urgency: UrgencyLevel;
  status: RequestStatus;
  trainingType: TrainingType;
  enrolledAt: string;
  completedAt: string | null;
  avatarBg: string;
};

type SurveyResponseRow = {
  id: string;
  initials: string;
  name: string;
  employeeId: string | null;
  role: string;
  dept: string;
  wantsToLearnFrom: string[];
  topics: string | null;
  urgency: UrgencyLevel;
  preferredFormat: string | null;
  status: "submitted" | "reviewed" | "actioned" | "archived";
  createdAt: string;
  avatarBg: string;
};

const URGENCY_DOT: Record<UrgencyLevel, string> = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-amber-500",
  Low: "bg-emerald-500",
};

const STATUS_STYLE: Record<RequestStatus, string> = {
  Matched: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Unmatched: "bg-muted text-muted-foreground",
};

const SURVEY_STATUS_STYLE: Record<SurveyResponseRow["status"], string> = {
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  reviewed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  actioned: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

const SURVEY_STATUS_LABEL: Record<SurveyResponseRow["status"], string> = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  actioned: "Actioned",
  archived: "Archived",
};

const DEPT_TAG: Record<string, string> = {
  IT: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Product: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
  Sales: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  Marketing: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Finance: "bg-lime-50 text-lime-700 dark:bg-lime-950 dark:text-lime-400",
  HR: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-400",
  Operations: "bg-stone-100 text-stone-600 dark:bg-stone-900 dark:text-stone-400",
  Design: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  Unassigned: "bg-muted text-muted-foreground",
};

export function TrainingDashboardClient({ data }: { data: TrainingDashboardData }) {
  const [activeDept, setActiveDept] = useState("All departments");
  const [activeType, setActiveType] = useState<TrainingType>(data.trainingTypes[0]?.id ?? "cross_functional");
  const [search, setSearch] = useState("");

  const filteredAssignments = data.assignments.filter((row) => {
    const matchesDept = activeDept === "All departments" || row.dept === activeDept;
    const matchesType = row.trainingType === activeType;
    const haystack = [row.name, row.role, row.dept, row.course, row.focus].join(" ").toLowerCase();
    return matchesDept && matchesType && (!search || haystack.includes(search.toLowerCase()));
  });
  const recentAssignments = data.assignments.filter((row) => row.trainingType === activeType).slice(0, 6);
  const filteredSurveyResponses = data.surveyResponses.filter((response) => matchesSurveyDept(response, activeDept));
  const recentSurveyResponses =
    activeType === "cross_functional" ? data.recentSurveyResponses.filter((response) => matchesSurveyDept(response, activeDept)) : [];

  return (
    <>
      <PageHeader
        title="Training Dashboard"
        description="Manager dashboard - training demand, assignments, and employee course progress."
        actions={
          <>
            {data.cycles.length > 0 && <NativeSelect options={data.cycles} />}
            <Button variant="outline" size="sm" type="button">
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {data.metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{metric.label}</div>
              <div className="mt-1 text-2xl font-semibold">{metric.value}</div>
              <div className="mt-0.5 text-xs text-muted-foreground/60">{metric.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Type:</span>
        {data.trainingTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setActiveType(type.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors select-none",
              activeType === type.id
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Filter:</span>
        {data.filters.map((department) => (
          <button
            key={department}
            onClick={() => setActiveDept(department)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] transition-colors select-none",
              activeDept === department
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            {department}
          </button>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Training demand heatmap</CardTitle>
            <CardDescription>Rows = employee department · Columns = requested learning department</CardDescription>
          </CardHeader>
          <CardContent>
            {data.heatmapDepartments.length > 0 ? (
              <HeatmapTable departments={data.heatmapDepartments} rows={data.heatmapRows} />
            ) : (
              <EmptyState text="No department data yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent survey demand</CardTitle>
            <CardDescription>Latest employee training feedback</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Wants to learn from</th>
                  <th className="pb-2">Urgency</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSurveyResponses.map((response) => (
                  <tr key={response.id} className="border-t border-border">
                    <td className="py-2.5">
                      <SurveyEmployeeCell response={response} />
                    </td>
                    <td className="max-w-[240px] text-muted-foreground">
                      {response.wantsToLearnFrom.length ? response.wantsToLearnFrom.join(", ") : "-"}
                    </td>
                    <td>
                      <UrgencyLabel urgency={response.urgency} />
                    </td>
                    <td>
                      <SurveyStatusBadge status={response.status} />
                    </td>
                  </tr>
                ))}
                {recentSurveyResponses.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No survey demand for this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="mt-3 text-right">
              <Link href="/training/survey/results" className="text-xs font-medium text-primary hover:underline">
                View all survey results
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Recent training assignments</CardTitle>
          <CardDescription>Latest employee course records</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Course</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAssignments.map((assignment) => (
                <tr key={assignment.id} className="border-t border-border">
                  <td className="py-2.5">
                    <EmployeeCell assignment={assignment} />
                  </td>
                  <td>
                    <DepartmentBadge department={assignment.dept} />
                  </td>
                  <td className="text-muted-foreground">{assignment.course}</td>
                  <td>
                    <StatusBadge status={assignment.status} />
                  </td>
                </tr>
              ))}
              {recentAssignments.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    No training assignments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {activeType === "cross_functional" && (
        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Survey demand details</CardTitle>
            <CardDescription>Employee requests from the live training survey</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2">Employee</th>
                  <th className="pb-2">Department</th>
                  <th className="pb-2">Wants to learn from</th>
                  <th className="pb-2">Topics</th>
                  <th className="pb-2">Format</th>
                  <th className="pb-2">Urgency</th>
                  <th className="pb-2">Submitted</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSurveyResponses.map((response) => (
                  <tr key={response.id} className="border-t border-border">
                    <td className="py-2.5">
                      <SurveyEmployeeCell response={response} />
                    </td>
                    <td>
                      <DepartmentBadge department={response.dept} />
                    </td>
                    <td className="max-w-[220px] text-muted-foreground">
                      {response.wantsToLearnFrom.length ? response.wantsToLearnFrom.join(", ") : "-"}
                    </td>
                    <td className="max-w-[260px] text-muted-foreground">{response.topics ?? "-"}</td>
                    <td className="text-muted-foreground">{response.preferredFormat ?? "-"}</td>
                    <td>
                      <UrgencyLabel urgency={response.urgency} />
                    </td>
                    <td className="text-muted-foreground">{formatDate(response.createdAt)}</td>
                    <td>
                      <SurveyStatusBadge status={response.status} />
                    </td>
                  </tr>
                ))}
                {filteredSurveyResponses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      No survey demand matches your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card className="mt-5">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Training assignments</CardTitle>
            <CardDescription>Employees and courses from the live directory</CardDescription>
          </div>
          <Input
            className="w-56"
            placeholder="Search by name, course, or department..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-2">Employee</th>
                <th className="pb-2">Department</th>
                <th className="pb-2">Course</th>
                <th className="pb-2">Focus</th>
                <th className="pb-2">Urgency</th>
                <th className="pb-2">Enrolled</th>
                <th className="pb-2">Completed</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((assignment) => (
                <tr
                  key={assignment.id}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-accent/50"
                >
                  <td className="py-2.5">
                    <EmployeeCell assignment={assignment} />
                  </td>
                  <td>
                    <DepartmentBadge department={assignment.dept} />
                  </td>
                  <td className="text-muted-foreground">{assignment.course}</td>
                  <td className="text-muted-foreground">{assignment.focus}</td>
                  <td>
                    <UrgencyLabel urgency={assignment.urgency} />
                  </td>
                  <td className="text-muted-foreground">{formatDate(assignment.enrolledAt)}</td>
                  <td className="text-muted-foreground">{formatDate(assignment.completedAt)}</td>
                  <td>
                    <StatusBadge status={assignment.status} />
                  </td>
                </tr>
              ))}
              {filteredAssignments.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No training assignments match your filters.
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

function SurveyEmployeeCell({ response }: { response: SurveyResponseRow }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          response.avatarBg
        )}
      >
        {response.initials}
      </div>
      <div>
        <div className="font-medium">{response.name}</div>
        <div className="text-[11px] text-muted-foreground">{response.role}</div>
      </div>
    </div>
  );
}

function EmployeeCell({ assignment }: { assignment: AssignmentRow }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          assignment.avatarBg
        )}
      >
        {assignment.initials}
      </div>
      <div>
        <div className="font-medium">{assignment.name}</div>
        <div className="text-[11px] text-muted-foreground">{assignment.role}</div>
      </div>
    </div>
  );
}

function DepartmentBadge({ department }: { department: string }) {
  return (
    <Badge className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", DEPT_TAG[department] ?? "bg-muted text-muted-foreground")}>
      {department}
    </Badge>
  );
}

function UrgencyLabel({ urgency }: { urgency: UrgencyLevel }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", URGENCY_DOT[urgency])} />
      {urgency}
    </span>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>
      {status}
    </span>
  );
}

function SurveyStatusBadge({ status }: { status: SurveyResponseRow["status"] }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold", SURVEY_STATUS_STYLE[status])}>
      {SURVEY_STATUS_LABEL[status]}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function NativeSelect({ options }: { options: string[] }) {
  return (
    <select className="rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
      {options.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  );
}

function matchesSurveyDept(response: SurveyResponseRow, activeDept: string) {
  return (
    activeDept === "All departments" ||
    response.dept === activeDept ||
    response.wantsToLearnFrom.includes(activeDept)
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
