"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { assignAssessmentsToDepartment } from "@/lib/actions/assessments";
import { matchSkillTemplate } from "@/lib/assessments/match";
import { cn } from "@/lib/utils";

type Employee = { employee_id: string; full_name: string; job_title: string; manager_name: string | null; department: string | null };
type Template = { id: string; kind: "skill" | "behaviour" | "placement"; name: string; role_family: string | null; department?: string | null; job_titles: string[] };
type UserOption = { id: string; label: string; meta: string; employee_id: string | null };

export function DepartmentAssignPanel({
  employees,
  templates,
  users,
  defaultWave,
}: {
  employees: Employee[];
  templates: Template[];
  users: UserOption[];
  defaultWave: string;
}) {
  const router = useRouter();
  const departments = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort(),
    [employees]
  );
  const [department, setDepartment] = useState("");
  const [wave, setWave] = useState(defaultWave);
  const [dueDate, setDueDate] = useState("");
  const [includeSkill, setIncludeSkill] = useState(true);
  const [includeBehaviour, setIncludeBehaviour] = useState(true);
  const [includePlacement, setIncludePlacement] = useState(true);
  const [includeManager, setIncludeManager] = useState(true);
  const [autoPeers, setAutoPeers] = useState(true);
  const [crossDept, setCrossDept] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const hasBehaviourTemplate = templates.some((t) => t.kind === "behaviour");
  const placementTemplate = templates.find(
    (t) => t.kind === "placement" && (t.department ?? "").trim().toLowerCase() === department.trim().toLowerCase()
  );
  const members = useMemo(() => employees.filter((e) => e.department === department), [employees, department]);
  const accountByEmployee = useMemo(() => new Set(users.map((u) => u.employee_id).filter(Boolean)), [users]);

  const preview = members.map((e) => ({
    ...e,
    skill: matchSkillTemplate(e.job_title, templates),
    hasAccount: accountByEmployee.has(e.employee_id),
  }));
  const matched = preview.filter((p) => p.skill).length;
  const withAccount = preview.filter((p) => p.hasAccount).length;
  const willAssign = preview.filter(
    (p) => (includeSkill && p.skill) || (includeBehaviour && hasBehaviourTemplate) || (includePlacement && placementTemplate)
  ).length;

  const q = query.trim().toLowerCase();
  const memberIds = new Set(members.map((m) => m.employee_id));
  const raterOptions = users.filter(
    (u) => !crossDept.includes(u.id) && !(u.employee_id && memberIds.has(u.employee_id)) && (!q || `${u.label} ${u.meta}`.toLowerCase().includes(q))
  );

  async function submit() {
    if (!department) return toast.error("Select a department.");
    if (!confirm(`Assign assessments to ${willAssign} employee(s) in ${department}? Everyone involved will be notified.`)) return;
    setSaving(true);
    const result = await assignAssessmentsToDepartment({
      department,
      wave: wave.trim() || null,
      due_date: dueDate || null,
      include_skill: includeSkill,
      include_behaviour: includeBehaviour,
      include_placement: includePlacement,
      include_line_manager: includeManager,
      auto_peers: autoPeers,
      cross_dept_user_ids: crossDept,
    });
    setSaving(false);
    if (result.error) return toast.error(result.error);
    toast.success(`Created ${result.created} assignment(s) for ${result.total} employee(s) in ${department}.`);
    if (result.skipped?.length) toast.warning(`Skipped ${result.skipped.length}: ${result.skipped.slice(0, 3).join("; ")}${result.skipped.length > 3 ? "…" : ""}`);
    if (result.unmatched?.length) toast.warning(`No skill template for: ${result.unmatched.slice(0, 3).join("; ")}${result.unmatched.length > 3 ? ` (+${result.unmatched.length - 3})` : ""}. Map their job titles in the library.`);
    if (result.noAccount?.length) toast.info(`${result.noAccount.length} employee(s) have no user account yet; they will see it once linked.`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="dept">Department</Label>
          <select
            id="dept"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Select a department…</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d} ({employees.filter((e) => e.department === d).length})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <Label>Assessments</Label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeSkill} onChange={(e) => setIncludeSkill(e.target.checked)} />
            Skill assessment, matched from each employee&apos;s job title
          </label>
          <label className={cn("flex items-center gap-2 text-sm", !hasBehaviourTemplate && "opacity-50")}>
            <input
              type="checkbox"
              checked={includeBehaviour && hasBehaviourTemplate}
              disabled={!hasBehaviourTemplate}
              onChange={(e) => setIncludeBehaviour(e.target.checked)}
            />
            Behaviour, Desire and Attitude assessment (company-wide)
            {!hasBehaviourTemplate && <span className="text-xs text-muted-foreground">not published</span>}
          </label>
          <label className={cn("flex items-center gap-2 text-sm", !placementTemplate && "opacity-50")}>
            <input
              type="checkbox"
              checked={includePlacement && !!placementTemplate}
              disabled={!placementTemplate}
              onChange={(e) => setIncludePlacement(e.target.checked)}
            />
            Role placement assessment (this department)
            {!placementTemplate && <span className="text-xs text-muted-foreground">not published for this department</span>}
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="dept-wave">Wave / cycle label</Label>
            <Input id="dept-wave" value={wave} onChange={(e) => setWave(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dept-due">Due date</Label>
            <Input id="dept-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Raters</Label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={includeManager} onChange={(e) => setIncludeManager(e.target.checked)} />
            Line manager, from each employee record
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPeers} onChange={(e) => setAutoPeers(e.target.checked)} />
            Nominate up to 3 peers per person from the same department
          </label>
          <p className="text-xs text-muted-foreground">
            Peers are colleagues with user accounts, rotated so the rating load spreads. Reciprocal pairs are likely in small
            teams; report averages only.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>Cross-departmental rater(s) for every skill assessment</Label>
          <div className="flex flex-wrap gap-1.5">
            {crossDept.map((id) => {
              const u = users.find((x) => x.id === id);
              return (
                <Badge key={id} variant="outline" className="gap-1 pr-1">
                  {u?.label ?? id}
                  <button type="button" aria-label="Remove" onClick={() => setCrossDept((v) => v.filter((x) => x !== id))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              );
            })}
          </div>
          <Input placeholder="Search users outside the department…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {q && (
            <div className="max-h-40 overflow-auto rounded-md border">
              {raterOptions.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>}
              {raterOptions.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setCrossDept((v) => [...v, u.id]);
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

        <Button onClick={submit} disabled={saving || !department || willAssign === 0} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Assign to {willAssign} employee{willAssign === 1 ? "" : "s"} and notify
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4 text-primary" /> Preview
          {department && (
            <span className="text-xs font-normal text-muted-foreground">
              {members.length} employees · {matched} matched to a skill template · {withAccount} with accounts
            </span>
          )}
        </div>
        <div className="max-h-[32rem] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Skill template</TableHead>
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!department && (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                    Choose a department to preview who will be assigned.
                  </TableCell>
                </TableRow>
              )}
              {preview.map((p) => (
                <TableRow key={p.employee_id}>
                  <TableCell>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.job_title}</div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {p.skill ? (
                      p.skill.role_family ?? p.skill.name
                    ) : (
                      <span className="text-amber-600">No match</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.hasAccount ? (
                      <span className="text-xs text-emerald-600">linked</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">none yet</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
