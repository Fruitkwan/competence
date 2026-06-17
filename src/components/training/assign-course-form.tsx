"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { formatCourseDevelops } from "@/lib/course-format";
import { assignCourseToEmployee, updateEmployeeCourseStatus } from "@/lib/actions/training";
import { toast } from "sonner";

type Employee = { employee_id: string; full_name: string; job_title: string };
type Course = { id: string; title: string; develops: string | null };
type PickerOption = { value: string; label: string; meta?: string };
type Assignment = {
  id: string;
  employee_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  employee_name: string;
  course_title: string;
};

const STATUS_COLORS: Record<string, string> = {
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Enrolled: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Dropped: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

export function AssignCourseForm({
  employees,
  courses,
  initialAssignments,
}: {
  employees: Employee[];
  courses: Course[];
  initialAssignments: Assignment[];
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const employeeOptions = useMemo<PickerOption[]>(
    () =>
      employees.map((employee) => ({
        value: employee.employee_id,
        label: `${employee.employee_id} - ${employee.full_name}`,
        meta: employee.job_title,
      })),
    [employees]
  );
  const courseOptions = useMemo<PickerOption[]>(
    () =>
      courses.map((course) => ({
        value: course.id,
        label: course.title,
        meta: formatCourseDevelops(course.develops) || undefined,
      })),
    [courses]
  );

  async function handleAssign() {
    if (!selectedEmployee || !selectedCourse) {
      toast.error("Please select both an employee and a course.");
      return;
    }
    setSaving(true);
    const result = await assignCourseToEmployee(selectedEmployee, selectedCourse);

    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      const emp = employees.find((e) => e.employee_id === selectedEmployee);
      const crs = courses.find((c) => c.id === selectedCourse);
      setAssignments((prev) => [
        {
          ...result.data,
          employee_name: emp?.full_name ?? selectedEmployee,
          course_title: crs?.title ?? "",
        },
        ...prev,
      ]);
      toast.success(`Assigned "${crs?.title}" to ${emp?.full_name}`);
      setSelectedEmployee("");
      setSelectedCourse("");
    }
    setSaving(false);
  }

  async function handleUpdateStatus(id: string, newStatus: string) {
    const result = await updateEmployeeCourseStatus(id, newStatus);
    if (result.error) {
      toast.error(result.error);
    } else {
      const now = new Date().toISOString();
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: newStatus,
                ...(newStatus === "In Progress" ? { started_at: now } : {}),
                ...(newStatus === "Completed" ? { completed_at: now } : {}),
              }
            : a
        )
      );
      toast.success("Status updated.");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const supabase = createClient();
    const { error } = await supabase.from("employee_courses").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Assignment removed.");
    }
    setDeletingId(null);
  }

  const filtered = filter
    ? assignments.filter(
        (a) =>
          a.employee_name.toLowerCase().includes(filter.toLowerCase()) ||
          a.course_title.toLowerCase().includes(filter.toLowerCase())
      )
    : assignments;

  return (
    <div className="space-y-6">
      {/* Assign form */}
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Assign Course to Employee</CardTitle>
          <CardDescription>Select an employee and a course, then click Assign.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-visible transition-[padding] has-[.training-picker-open]:pb-72">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Employee</label>
              <SearchablePicker
                options={employeeOptions}
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                placeholder="Type employee ID or name..."
                emptyText="No employees match."
              />
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Course</label>
              <SearchablePicker
                options={courseOptions}
                value={selectedCourse}
                onChange={setSelectedCourse}
                placeholder="Type course title or focus..."
                emptyText="No courses match."
              />
            </div>
            <Button onClick={handleAssign} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Assign
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Assignments table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>Current Assignments ({assignments.length})</CardTitle>
            <Input
              placeholder="Filter by name or course..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enrolled</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No assignments found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employee_name}</TableCell>
                    <TableCell>{a.course_title}</TableCell>
                    <TableCell>
                      <select
                        value={a.status}
                        onChange={(e) => handleUpdateStatus(a.id, e.target.value)}
                        className={cn("rounded-full border-0 px-2.5 py-0.5 text-xs font-medium outline-none", STATUS_COLORS[a.status] ?? "")}
                      >
                        <option value="Enrolled">Enrolled</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Dropped">Dropped</option>
                      </select>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(a.enrolled_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {a.completed_at ? new Date(a.completed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {a.score != null ? `${a.score}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="text-destructive hover:text-destructive"
                      >
                        {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SearchablePicker({
  options,
  value,
  onChange,
  placeholder,
  emptyText,
}: {
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;
  const visibleText = open ? query : selected ? selected.label : "";
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? options.filter((option) =>
          [option.label, option.meta].filter(Boolean).join(" ").toLowerCase().includes(needle)
        )
      : options;
    return matches.slice(0, 40);
  }, [options, query]);

  function choose(option: PickerOption) {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", open && "training-picker-open")}>
      <div className="flex h-9 items-center gap-2 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={visibleText}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            if (value) onChange("");
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-input bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  option.value === value && "bg-accent text-accent-foreground"
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{option.label}</span>
                  {option.meta ? (
                    <span className="block truncate text-xs text-muted-foreground">{option.meta}</span>
                  ) : null}
                </span>
                {option.value === value ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            ))
          )}
          {options.length > filtered.length ? (
            <div className="px-3 py-2 text-center text-xs text-muted-foreground">
              Showing {filtered.length} of {options.length}. Keep typing to narrow.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
