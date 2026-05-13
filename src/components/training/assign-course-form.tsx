"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, CheckCircle2, Clock, PlayCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Employee = { employee_id: string; full_name: string; job_title: string };
type Course = { id: string; title: string; develops: string | null };
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

  async function handleAssign() {
    if (!selectedEmployee || !selectedCourse) {
      toast.error("Please select both an employee and a course.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("employee_courses")
      .insert({ employee_id: selectedEmployee, course_id: selectedCourse, status: "Enrolled" })
      .select("id, employee_id, course_id, status, enrolled_at, started_at, completed_at, score")
      .single();

    if (error) {
      toast.error(error.code === "23505" ? "This employee is already enrolled in this course." : error.message);
    } else if (data) {
      const emp = employees.find((e) => e.employee_id === selectedEmployee);
      const crs = courses.find((c) => c.id === selectedCourse);
      setAssignments((prev) => [
        {
          ...data,
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
    const supabase = createClient();
    const updates: {
      status: string;
      started_at?: string;
      completed_at?: string;
    } = { status: newStatus };
    if (newStatus === "In Progress") updates.started_at = new Date().toISOString();
    if (newStatus === "Completed") updates.completed_at = new Date().toISOString();

    const { error } = await supabase.from("employee_courses").update(updates as never).eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: newStatus, ...(newStatus === "Completed" ? { completed_at: new Date().toISOString() } : {}) } : a
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
      <Card>
        <CardHeader>
          <CardTitle>Assign Course to Employee</CardTitle>
          <CardDescription>Select an employee and a course, then click Assign.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select employee...</option>
                {employees.map((e) => (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.employee_id} — {e.full_name} ({e.job_title})
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}{c.develops ? ` (${c.develops})` : ""}
                  </option>
                ))}
              </select>
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
