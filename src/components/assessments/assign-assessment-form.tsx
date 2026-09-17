"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Eye, EyeOff, Loader2, Send, Settings2, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeePicker } from "@/components/ui/employee-picker";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignAssessments, deleteAssignment, releaseResults, suggestTemplatesForEmployee, updateAssignmentRaters } from "@/lib/actions/assessments";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DepartmentAssignPanel } from "./department-assign-panel";

type Employee = { employee_id: string; full_name: string; job_title: string; manager_name: string | null; department: string | null };
type Template = { id: string; kind: "skill" | "behaviour"; name: string; role_family: string | null; job_titles: string[] };
type UserOption = { id: string; label: string; meta: string; employee_id: string | null };

export type AssignmentRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  template_name: string;
  kind: "skill" | "behaviour";
  wave: string | null;
  due_date: string | null;
  status: "assigned" | "in_progress" | "submitted" | "closed";
  results_released: boolean;
  has_account: boolean;
  self_done: boolean;
  raters_total: number;
  raters_done: number;
  raters: { user_id: string; type: "self" | "line_manager" | "cross_dept" | "peer"; status: "pending" | "submitted" }[];
  manager_user_id: string | null;
};

const STATUS_STYLE: Record<AssignmentRow["status"], string> = {
  assigned: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  submitted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

export function AssignAssessmentForm({
  employees,
  templates,
  users,
  assignments,
  canDelete,
  canBulkAssign,
}: {
  employees: Employee[];
  templates: Template[];
  users: UserOption[];
  assignments: AssignmentRow[];
  canDelete: boolean;
  canBulkAssign: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"single" | "department">("single");
  const [employeeId, setEmployeeId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [wave, setWave] = useState(`Wave 1 - ${new Date().getFullYear()}`);
  const [dueDate, setDueDate] = useState("");
  const [includeManager, setIncludeManager] = useState(true);
  const [crossDept, setCrossDept] = useState<string[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [editingRaters, setEditingRaters] = useState<AssignmentRow | null>(null);

  const employee = employees.find((e) => e.employee_id === employeeId) ?? null;
  const employeeUser = users.find((u) => u.employee_id === employeeId) ?? null;
  const managerUser = useMemo(
    () => (employee?.manager_name ? users.find((u) => u.label === employee.manager_name) ?? null : null),
    [employee, users]
  );

  function chooseEmployee(id: string) {
    setEmployeeId(id);
    setSelected(new Set());
    if (!id) return;
    suggestTemplatesForEmployee(id).then((ids) => setSelected(new Set(ids)));
  }

  const hasSkill = [...selected].some((id) => templates.find((t) => t.id === id)?.kind === "skill");
  const hasBehaviour = [...selected].some((id) => templates.find((t) => t.id === id)?.kind === "behaviour");

  async function submit() {
    if (!employeeId) return toast.error("Select an employee.");
    if (selected.size === 0) return toast.error("Select at least one assessment.");
    setSaving(true);
    const result = await assignAssessments({
      employee_id: employeeId,
      template_ids: [...selected],
      wave: wave.trim() || null,
      due_date: dueDate || null,
      include_line_manager: includeManager,
      cross_dept_user_ids: crossDept,
      peer_user_ids: peers,
    });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    if (result.created?.length) toast.success(`Assigned: ${result.created.join(", ")}`);
    if (result.skipped?.length) toast.warning(`Skipped: ${result.skipped.join(", ")}`);
    if (result.warning) toast.warning(result.warning);
    chooseEmployee("");
    setCrossDept([]);
    setPeers([]);
    router.refresh();
  }

  async function toggleRelease(row: AssignmentRow) {
    setBusyId(row.id);
    const result = await releaseResults(row.id, !row.results_released);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success(row.results_released ? "Results hidden from employee." : "Results released to employee.");
      router.refresh();
    }
  }

  async function remove(row: AssignmentRow) {
    if (!confirm(`Delete ${row.template_name} for ${row.employee_name}? All responses will be lost.`)) return;
    setBusyId(row.id);
    const result = await deleteAssignment(row.id);
    setBusyId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success("Deleted.");
      router.refresh();
    }
  }

  const q = filter.trim().toLowerCase();
  const visible = q
    ? assignments.filter((a) => `${a.employee_name} ${a.employee_id} ${a.template_name} ${a.wave ?? ""}`.toLowerCase().includes(q))
    : assignments;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">New assignment</CardTitle>
            <CardDescription>
              {mode === "single"
                ? "The skill instrument is suggested from the employee's job title; the behaviour instrument is company-wide."
                : "Assign the matching skill assessment and the behaviour assessment to every active employee in a department."}
            </CardDescription>
          </div>
          {canBulkAssign && (
            <div className="inline-flex shrink-0 rounded-md border p-0.5 text-sm">
              {(["single", "department"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded px-3 py-1 transition-colors",
                    mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                  )}
                >
                  {m === "single" ? "One employee" : "Whole department"}
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        {mode === "department" ? (
          <CardContent>
            <DepartmentAssignPanel employees={employees} templates={templates} users={users} defaultWave={wave} />
          </CardContent>
        ) : (
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <EmployeePicker options={employees} value={employeeId} onChange={chooseEmployee} clearable />
              {employee && (
                <p className="text-xs text-muted-foreground">
                  {employee.job_title}
                  {employee.department ? ` · ${employee.department}` : ""}
                  {employeeUser ? "" : " · no user account yet"}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Assessments</Label>
              {templates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No published assessments. <Link href="/admin/assessments" className="underline">Publish one in the library.</Link>
                </p>
              )}
              <div className="grid gap-1.5">
                {templates.map((t) => {
                  const on = selected.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent",
                        on && "border-primary/60 bg-primary/5"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={on}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(t.id);
                          else next.delete(t.id);
                          setSelected(next);
                        }}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{t.role_family ?? t.name}</span>
                        <span className="ml-2 text-xs capitalize text-muted-foreground">{t.kind}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="wave">Wave / cycle label</Label>
                <Input id="wave" value={wave} onChange={(e) => setWave(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="due">Due date</Label>
                <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Line manager</Label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includeManager} onChange={(e) => setIncludeManager(e.target.checked)} />
                {managerUser ? (
                  <span>
                    {managerUser.label} <span className="text-xs text-muted-foreground">rates as line manager</span>
                  </span>
                ) : employee ? (
                  <span className="text-muted-foreground">
                    {employee.manager_name ? `${employee.manager_name} has no user account` : "No manager on record"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Auto-filled from the employee record</span>
                )}
              </label>
            </div>

            <UserMultiPicker
              label="Cross-departmental rater(s)"
              hint={hasSkill ? "Skill assessment. Someone outside the direct reporting line." : "Only used by the skill assessment."}
              users={users}
              exclude={[employeeUser?.id, managerUser?.id]}
              value={crossDept}
              onChange={setCrossDept}
              disabled={!hasSkill}
            />
            <UserMultiPicker
              label="Peer raters (minimum 3)"
              hint={hasBehaviour ? "Behaviour assessment. Colleagues who work alongside the person daily." : "Only used by the behaviour assessment."}
              users={users}
              exclude={[employeeUser?.id, managerUser?.id]}
              value={peers}
              onChange={setPeers}
              disabled={!hasBehaviour}
            />

            <Button onClick={submit} disabled={saving || !employeeId || selected.size === 0} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Assign and notify
            </Button>
          </div>
        </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">Assignments</CardTitle>
            <CardDescription>{assignments.length} total</CardDescription>
          </div>
          <Input className="max-w-xs" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Wave</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Self</TableHead>
                <TableHead>Raters</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    No assignments yet.
                  </TableCell>
                </TableRow>
              )}
              {visible.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.employee_name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{a.employee_id}</div>
                  </TableCell>
                  <TableCell>
                    {a.template_name}
                    <span className="ml-1 text-xs capitalize text-muted-foreground">({a.kind})</span>
                  </TableCell>
                  <TableCell>{a.wave ?? "—"}</TableCell>
                  <TableCell>{formatDate(a.due_date)}</TableCell>
                  <TableCell>
                    {a.self_done ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-muted-foreground">pending</span>}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {a.raters_done}/{a.raters_total}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLE[a.status]}>
                      {a.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleRelease(a)}
                      disabled={busyId === a.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                        a.results_released ? "border-emerald-300 text-emerald-700" : "text-muted-foreground"
                      )}
                    >
                      {a.results_released ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {a.results_released ? "Released" : "Hidden"}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link href={`/assessments/${a.id}/report`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Report
                      </Link>
                      {a.status !== "closed" && (
                        <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => setEditingRaters(a)}>
                          <Settings2 className="h-3.5 w-3.5" />
                          Raters
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="icon-sm" variant="ghost" disabled={busyId === a.id} onClick={() => remove(a)} aria-label="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ManageRatersDialog
        key={editingRaters?.id ?? "closed"}
        assignment={editingRaters}
        users={users}
        onOpenChange={(open) => !open && setEditingRaters(null)}
        onSaved={() => {
          setEditingRaters(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function ManageRatersDialog({
  assignment,
  users,
  onOpenChange,
  onSaved,
}: {
  assignment: AssignmentRow | null;
  users: UserOption[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [includeManager, setIncludeManager] = useState(
    () => assignment?.raters.some((r) => r.type === "line_manager") ?? false
  );
  const [others, setOthers] = useState(
    () => assignment?.raters.filter((r) => r.type !== "line_manager").map((r) => r.user_id) ?? []
  );
  const [saving, setSaving] = useState(false);

  function initialise(open: boolean) {
    onOpenChange(open);
  }

  async function save() {
    if (!assignment) return;
    setSaving(true);
    const result = await updateAssignmentRaters({
      assignment_id: assignment.id,
      include_line_manager: includeManager,
      other_user_ids: others,
    });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    if (result.warning) toast.warning(result.warning);
    const changes = [result.added ? `${result.added} added` : "", result.removed ? `${result.removed} removed` : ""].filter(Boolean);
    toast.success(changes.length ? `Raters updated: ${changes.join(", ")}.` : "Raters are already up to date.");
    onSaved();
  }

  const submitted = assignment?.raters.filter((r) => r.status === "submitted") ?? [];
  const subjectUserId = users.find((u) => u.employee_id === assignment?.employee_id)?.id;
  const manager = users.find((u) => u.id === assignment?.manager_user_id) ?? null;

  return (
    <Dialog open={!!assignment} onOpenChange={initialise}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Manage raters</DialogTitle>
          <DialogDescription>
            {assignment?.employee_name} · {assignment?.template_name}. Newly added raters are notified immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-2">
            <Label>Line manager</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeManager}
                onChange={(event) => setIncludeManager(event.target.checked)}
                disabled={!manager || submitted.some((r) => r.type === "line_manager")}
              />
              {manager ? manager.label : "No registered manager account"}
              {submitted.some((r) => r.type === "line_manager") && <span className="text-xs text-muted-foreground">submitted</span>}
            </label>
          </div>
          <UserMultiPicker
            label={assignment?.kind === "skill" ? "Cross-departmental raters" : "Peer raters"}
            hint="Submitted responses are preserved and cannot be removed."
            users={users}
            exclude={[subjectUserId, assignment?.manager_user_id]}
            value={others}
            onChange={(ids) => {
              const submittedIds = new Set(submitted.filter((r) => r.type !== "line_manager").map((r) => r.user_id));
              setOthers([...new Set([...ids, ...submittedIds])]);
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => initialise(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save and notify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserMultiPicker({
  label,
  hint,
  users,
  exclude,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  users: UserOption[];
  exclude: (string | null | undefined)[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const options = users.filter(
    (u) => !exclude.includes(u.id) && !value.includes(u.id) && (!q || `${u.label} ${u.meta}`.toLowerCase().includes(q))
  );
  const chosen = value.map((id) => users.find((u) => u.id === id)).filter((u): u is UserOption => !!u);

  return (
    <div className={cn("grid gap-2", disabled && "opacity-50")}>
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex flex-wrap gap-1.5">
        {chosen.map((u) => (
          <Badge key={u.id} variant="outline" className="gap-1 pr-1">
            {u.label}
            <button type="button" aria-label={`Remove ${u.label}`} onClick={() => onChange(value.filter((v) => v !== u.id))}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input placeholder="Search users…" value={query} onChange={(e) => setQuery(e.target.value)} disabled={disabled} />
      {q && !disabled && (
        <div className="max-h-40 overflow-auto rounded-md border">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>}
          {options.slice(0, 20).map((u) => (
            <button
              key={u.id}
              type="button"
              className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                onChange([...value, u.id]);
                setQuery("");
              }}
            >
              <span>{u.label}</span>
              <span className="text-xs text-muted-foreground">{u.meta}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
