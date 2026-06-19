"use client";

import { useMemo, useState, useTransition, type ComponentType, type MouseEventHandler } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock3, Inbox, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  updateTrainingSurveyResponseStatus,
  type TrainingSurveyStatus,
} from "@/lib/actions/training-survey";
import { cn } from "@/lib/utils";

export type TrainingSurveyResultRow = {
  id: string;
  user_id: string;
  employee_id: string | null;
  full_name: string;
  job_title: string;
  department: string;
  role_level: string;
  email: string;
  manager_name: string | null;
  learn_departments: string[];
  learn_topics: string | null;
  urgency: string | null;
  preferred_format: string | null;
  learning_hours: string | null;
  teach_departments: string[];
  teach_topics: string | null;
  confidence: string | null;
  teaching_hours: string | null;
  recommended_trainers: string | null;
  comments: string | null;
  status: TrainingSurveyStatus;
  created_at: string;
};

const STATUS_LABEL: Record<TrainingSurveyStatus, string> = {
  submitted: "Submitted",
  reviewed: "Reviewed",
  actioned: "Actioned",
  archived: "Archived",
};

const STATUS_STYLE: Record<TrainingSurveyStatus, string> = {
  submitted: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  reviewed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  actioned: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground",
};

const STATUS_OPTIONS = Object.keys(STATUS_LABEL) as TrainingSurveyStatus[];

export function TrainingSurveyResultsClient({
  rows,
  canUpdateStatus,
}: {
  rows: TrainingSurveyResultRow[];
  canUpdateStatus: boolean;
}) {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [status, setStatus] = useState<TrainingSurveyStatus | "all">("all");
  const [urgency, setUrgency] = useState("All urgency");
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");

  const departments = useMemo(
    () => ["All departments", ...uniqueSorted(rows.map((row) => row.department))],
    [rows]
  );

  const urgencies = useMemo(
    () => ["All urgency", ...uniqueSorted(rows.map((row) => row.urgency).filter(Boolean) as string[])],
    [rows]
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesDepartment = department === "All departments" || row.department === department;
      const matchesStatus = status === "all" || row.status === status;
      const matchesUrgency = urgency === "All urgency" || row.urgency === urgency;
      const haystack = [
        row.full_name,
        row.employee_id,
        row.job_title,
        row.department,
        row.role_level,
        row.email,
        row.manager_name,
        row.learn_departments.join(" "),
        row.learn_topics,
        row.teach_departments.join(" "),
        row.teach_topics,
        row.comments,
      ]
        .join(" ")
        .toLowerCase();
      return matchesDepartment && matchesStatus && matchesUrgency && (!needle || haystack.includes(needle));
    });
  }, [department, rows, search, status, urgency]);

  const selected = rows.find((row) => row.id === selectedId) ?? filteredRows[0] ?? rows[0];
  const submitted = rows.filter((row) => row.status === "submitted").length;
  const actioned = rows.filter((row) => row.status === "actioned").length;
  const trainers = rows.filter((row) => row.teach_departments.length || row.teach_topics).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Responses" value={rows.length} icon={Inbox} />
        <MetricCard label="Submitted" value={submitted} icon={Clock3} tone="amber" />
        <MetricCard label="Actioned" value={actioned} icon={CheckCircle2} tone="green" />
        <MetricCard label="Can train" value={trainers} icon={CheckCircle2} tone="blue" />
      </div>

      <Card className="mt-5">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle>Survey responses</CardTitle>
            <CardDescription>Training feedback from employees</CardDescription>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search responses..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <NativeSelect value={department} onChange={setDepartment} options={departments} />
            <NativeSelect
              value={status}
              onChange={(value) => setStatus(value as TrainingSurveyStatus | "all")}
              options={["all", ...STATUS_OPTIONS]}
              labels={{ all: "All statuses", ...STATUS_LABEL }}
            />
            <NativeSelect value={urgency} onChange={setUrgency} options={urgencies} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2">Employee</th>
                    <th className="pb-2">Department</th>
                    <th className="pb-2">Needs</th>
                    <th className="pb-2">Can train</th>
                    <th className="pb-2">Urgency</th>
                    <th className="pb-2">Submitted</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "cursor-pointer border-t border-border transition-colors hover:bg-accent/50",
                        selected?.id === row.id && "bg-accent/60"
                      )}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td className="py-3 pr-4 align-top">
                        <div className="font-medium">{row.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[row.employee_id, row.job_title].filter(Boolean).join(" · ")}
                        </div>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <Badge variant="outline">{row.department}</Badge>
                      </td>
                      <td className="max-w-[240px] py-3 pr-4 align-top text-muted-foreground">
                        {row.learn_departments.length ? row.learn_departments.join(", ") : "-"}
                      </td>
                      <td className="max-w-[240px] py-3 pr-4 align-top text-muted-foreground">
                        {row.teach_departments.length ? row.teach_departments.join(", ") : "-"}
                      </td>
                      <td className="py-3 pr-4 align-top">{row.urgency ?? "-"}</td>
                      <td className="py-3 pr-4 align-top text-muted-foreground">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="py-3 align-top">
                        {canUpdateStatus ? (
                          <StatusSelect
                            responseId={row.id}
                            value={row.status}
                            onClick={(event) => event.stopPropagation()}
                          />
                        ) : (
                          <StatusBadge status={row.status} />
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        No survey responses match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <ResponseDetails row={selected} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function StatusSelect({
  responseId,
  value,
  onClick,
}: {
  responseId: string;
  value: TrainingSurveyStatus;
  onClick: MouseEventHandler<HTMLSelectElement>;
}) {
  const [isPending, startTransition] = useTransition();
  const [localValue, setLocalValue] = useState(value);

  function update(nextStatus: TrainingSurveyStatus) {
    setLocalValue(nextStatus);
    startTransition(async () => {
      const result = await updateTrainingSurveyResponseStatus(responseId, nextStatus);
      if (result.error) {
        setLocalValue(value);
        toast.error(result.error);
        return;
      }
      toast.success("Survey status updated.");
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <select
        value={localValue}
        onClick={onClick}
        onChange={(event) => update(event.target.value as TrainingSurveyStatus)}
        disabled={isPending}
        className="h-7 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {STATUS_LABEL[option]}
          </option>
        ))}
      </select>
    </span>
  );
}

function ResponseDetails({ row }: { row?: TrainingSurveyResultRow }) {
  if (!row) {
    return (
      <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
        No response selected.
      </div>
    );
  }

  return (
    <aside className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{row.full_name}</h3>
          <p className="text-xs text-muted-foreground">{row.email}</p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <Detail label="Employee ID" value={row.employee_id ?? "-"} />
        <Detail label="Job title" value={row.job_title} />
        <Detail label="Department" value={row.department} />
        <Detail label="Role level" value={row.role_level} />
        <Detail label="Manager" value={row.manager_name ?? "-"} />
        <Detail label="Preferred format" value={row.preferred_format ?? "-"} />
        <Detail label="Learning hours" value={row.learning_hours ?? "-"} />
        <Detail label="Trainer confidence" value={row.confidence ?? "-"} />
        <Detail label="Teaching hours" value={row.teaching_hours ?? "-"} />
        <Detail label="Wants to learn from" value={listValue(row.learn_departments)} />
        <Detail label="Learning topics" value={row.learn_topics ?? "-"} />
        <Detail label="Can train" value={listValue(row.teach_departments)} />
        <Detail label="Training topics" value={row.teach_topics ?? "-"} />
        <Detail label="Recommended trainers" value={row.recommended_trainers ?? "-"} />
        <Detail label="Comments" value={row.comments ?? "-"} />
      </dl>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  tone?: "neutral" | "amber" | "green" | "blue";
}) {
  const colors = {
    neutral: "text-foreground",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
  }[tone];
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Icon className={cn("h-8 w-8", colors)} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn("text-2xl font-semibold", colors)}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: TrainingSurveyStatus }) {
  return (
    <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{value}</dd>
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function listValue(values: string[]) {
  return values.length ? values.join(", ") : "-";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
