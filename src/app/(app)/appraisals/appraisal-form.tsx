"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmployeePicker } from "@/components/ui/employee-picker";
import { toast } from "sonner";
import { Info, Loader2, Sparkles } from "lucide-react";
import { priorityColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";

type Appraisal = Database["public"]["Tables"]["appraisals"]["Row"];
type Employee = { employee_id: string; full_name: string; job_title: string };

const LEVEL_NUM: Record<string, number> = {
  Gap: 1,
  Developing: 2,
  Competent: 3,
  Expert: 4,
};

const LEVEL_TONES: Record<string, string> = {
  Gap: "data-[selected=true]:bg-red-100 data-[selected=true]:text-red-900 data-[selected=true]:border-red-300 dark:data-[selected=true]:bg-red-900/40 dark:data-[selected=true]:text-red-100",
  Developing:
    "data-[selected=true]:bg-amber-100 data-[selected=true]:text-amber-900 data-[selected=true]:border-amber-300 dark:data-[selected=true]:bg-amber-900/40 dark:data-[selected=true]:text-amber-100",
  Competent:
    "data-[selected=true]:bg-emerald-100 data-[selected=true]:text-emerald-900 data-[selected=true]:border-emerald-300 dark:data-[selected=true]:bg-emerald-900/40 dark:data-[selected=true]:text-emerald-100",
  Expert:
    "data-[selected=true]:bg-blue-100 data-[selected=true]:text-blue-900 data-[selected=true]:border-blue-300 dark:data-[selected=true]:bg-blue-900/40 dark:data-[selected=true]:text-blue-100",
};

const DIMS = [
  { key: "knowledge", label: "Knowledge (K)" },
  { key: "skill", label: "Skill (S)" },
  { key: "behaviour", label: "Behaviour (B)" },
  { key: "desire", label: "Desire (D)" },
  { key: "attitude", label: "Attitude (A)" },
] as const;

type DimKey = (typeof DIMS)[number]["key"];

export function AppraisalForm({
  mode,
  employees,
  levels,
  defaultEmployeeId,
  appraisal,
}: {
  mode: "create" | "edit";
  employees: Employee[];
  levels: string[];
  defaultEmployeeId?: string;
  appraisal?: Appraisal;
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    employee_id: appraisal?.employee_id ?? defaultEmployeeId ?? "",
    appraisal_date: appraisal?.appraisal_date ?? today,
    required_level: appraisal?.required_level ?? "Competent",
    knowledge: appraisal?.knowledge ?? "Competent",
    skill: appraisal?.skill ?? "Competent",
    behaviour: appraisal?.behaviour ?? "Competent",
    desire: appraisal?.desire ?? "Competent",
    attitude: appraisal?.attitude ?? "Competent",
    training_start: appraisal?.training_start ?? "",
    target_completion: appraisal?.target_completion ?? "",
    actual_completion: appraisal?.actual_completion ?? "",
    status: appraisal?.status ?? "Not Started",
    reassessment_avg: appraisal?.reassessment_avg?.toString() ?? "",
    evidence_url: appraisal?.evidence_url ?? "",
    notes: appraisal?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [requiredAutoFilled, setRequiredAutoFilled] = useState(false);

  // Look up role's required level on employee change
  useEffect(() => {
    if (!form.employee_id) return;
    const supabase = createClient();
    (async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("job_title")
        .eq("employee_id", form.employee_id)
        .single();
      if (!emp?.job_title) return;
      const { data: role } = await supabase
        .from("roles")
        .select("required_level")
        .eq("title", emp.job_title)
        .single();
      if (role?.required_level) {
        setForm((f) => {
          if (f.required_level === role.required_level) return f;
          setRequiredAutoFilled(true);
          return { ...f, required_level: role.required_level };
        });
      }
    })();
  }, [form.employee_id]);

  const computed = useMemo(() => {
    const vals = DIMS.map((d) => LEVEL_NUM[form[d.key as DimKey]] ?? 0);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const req = LEVEL_NUM[form.required_level] ?? 3;
    const gap = Math.round((req - avg) * 100) / 100;
    const priority = gap >= 1.5 ? "HIGH" : gap >= 0.5 ? "MEDIUM" : "LOW";
    const minIdx = vals.indexOf(Math.min(...vals));
    const dominant = ["K", "S", "B", "D", "A"][minIdx];
    return { avg, req, gap, priority, dominant };
  }, [form]);

  const setLevel = (key: DimKey, value: string) =>
    setForm((f) => ({ ...f, [key]: value }) as typeof form);

  const setAllLevelsTo = (value: string) =>
    setForm((f) => ({
      ...f,
      knowledge: value,
      skill: value,
      behaviour: value,
      desire: value,
      attitude: value,
    }));

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.employee_id === form.employee_id) ?? null,
    [employees, form.employee_id],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employee_id) {
      toast.error("Please pick an employee.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const payload = {
      employee_id: form.employee_id,
      appraisal_date: form.appraisal_date,
      required_level: form.required_level,
      knowledge: form.knowledge,
      skill: form.skill,
      behaviour: form.behaviour,
      desire: form.desire,
      attitude: form.attitude,
      training_start: form.training_start || null,
      target_completion: form.target_completion || null,
      actual_completion: form.actual_completion || null,
      status: form.status as Appraisal["status"],
      reassessment_avg: form.reassessment_avg
        ? Number(form.reassessment_avg)
        : null,
      evidence_url: form.evidence_url || null,
      notes: form.notes || null,
    };

    try {
      if (mode === "create") {
        const { data, error } = await supabase
          .from("appraisals")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Appraisal created.");
        router.replace(`/appraisals/${data.id}`);
        router.refresh();
      } else if (appraisal) {
        const { error } = await supabase
          .from("appraisals")
          .update(payload)
          .eq("id", appraisal.id);
        if (error) throw error;
        toast.success("Appraisal updated.");
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee &amp; date</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label>Employee</Label>
              <EmployeePicker
                options={employees}
                value={form.employee_id}
                onChange={(id) =>
                  setForm((f) => ({ ...f, employee_id: id }))
                }
                clearable
              />
              {selectedEmployee && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedEmployee.full_name} ·{" "}
                  {selectedEmployee.job_title}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Appraisal date</Label>
              <Input
                type="date"
                value={form.appraisal_date}
                onChange={(e) =>
                  setForm({ ...form, appraisal_date: e.target.value })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                Required level
                {requiredAutoFilled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Sparkles className="size-3" />
                    Auto from role
                  </span>
                )}
              </Label>
              <Select
                value={form.required_level}
                onValueChange={(v) => {
                  setRequiredAutoFilled(false);
                  setForm({ ...form, required_level: String(v ?? "") });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {levels.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Competency appraisal</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllLevelsTo(form.required_level)}
              title="Set all five competencies to the required level"
            >
              Set all to {form.required_level}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {DIMS.map((d) => (
              <div key={d.key} className="grid gap-2">
                <Label>{d.label}</Label>
                <LevelPills
                  levels={levels}
                  value={form[d.key as DimKey]}
                  onChange={(v) => setLevel(d.key as DimKey, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Training plan</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Training start</Label>
              <Input
                type="date"
                value={form.training_start}
                onChange={(e) =>
                  setForm({ ...form, training_start: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Target completion</Label>
              <Input
                type="date"
                value={form.target_completion}
                onChange={(e) =>
                  setForm({ ...form, target_completion: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Actual completion</Label>
              <Input
                type="date"
                value={form.actual_completion}
                onChange={(e) =>
                  setForm({ ...form, actual_completion: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    status: String(v ?? "Not Started") as Appraisal["status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not Started">Not Started</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reassessment avg</Label>
              <Input
                type="number"
                step="0.1"
                min="1"
                max="4"
                value={form.reassessment_avg}
                onChange={(e) =>
                  setForm({ ...form, reassessment_avg: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Evidence / Certificate URL</Label>
              <Input
                type="url"
                placeholder="https://"
                value={form.evidence_url}
                onChange={(e) =>
                  setForm({ ...form, evidence_url: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card
          className={cn(
            "transition-colors",
            computed.priority === "HIGH" &&
              "border-red-300 dark:border-red-900",
            computed.priority === "MEDIUM" &&
              "border-amber-300 dark:border-amber-900",
            computed.priority === "LOW" &&
              "border-emerald-300 dark:border-emerald-900",
          )}
        >
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <p className="text-xs text-muted-foreground">
              Auto-computed from competencies.
            </p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Current avg" v={computed.avg.toFixed(2)} />
            <Row k="Required" v={computed.req.toFixed(0)} />
            <Row
              k="Gap"
              v={computed.gap.toFixed(2)}
              tone={
                computed.gap >= 1.5
                  ? "danger"
                  : computed.gap >= 0.5
                  ? "warning"
                  : undefined
              }
            />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Priority</span>
              <Badge
                variant="outline"
                className={priorityColor[computed.priority]}
              >
                {computed.priority}
              </Badge>
            </div>
            <Row k="Dominant gap" v={computed.dominant} />
          </CardContent>
        </Card>

        {!form.employee_id && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <Info className="mt-0.5 size-4 shrink-0" />
            Pick an employee to enable the form.
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            disabled={loading || !form.employee_id}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create appraisal" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function LevelPills({
  levels,
  value,
  onChange,
}: {
  levels: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {levels.map((l) => {
        const selected = l === value;
        return (
          <button
            key={l}
            type="button"
            data-selected={selected}
            onClick={() => onChange(l)}
            className={cn(
              "rounded-full border border-input bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              LEVEL_TONES[l] ??
                "data-[selected=true]:bg-foreground data-[selected=true]:text-background",
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Row({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          tone === "danger" && "text-red-600 dark:text-red-400",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {v}
      </span>
    </div>
  );
}
