"use client";

import { useState, useCallback, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { RatingSelect, RatingScaleReference } from "./rating-select";
import { CompetencyRow } from "./competency-row";
import { GoalRowEditor } from "./goal-row";
import { ScoreSummary } from "./score-summary";
import { SavePdfButton } from "./pdf-export";
import { ArrowLeft, ArrowRight, Plus, CheckCircle2, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type {
  PerformanceAppraisalForm,
  CompetencyEntry,
  GoalRow,
  DevPlanRow,
  NextGoalRow,
  AppraisalType,
} from "@/lib/supabase/performance-appraisal-types";
import {
  emptyPerformanceAppraisal,
  emptyCompetency,
  emptyGoal,
  emptyDevPlan,
  emptyNextGoal,
  APPRAISAL_TYPES,
  RATING_LABELS,
  RECOMMENDED_ACTIONS,
} from "@/lib/supabase/performance-appraisal-types";
import { saveAppraisal } from "@/lib/actions/appraisals";

type Employee = { employee_id: string; full_name: string; job_title: string };
type RoleBenchmark = {
  role_title: string;
  department: string;
  competencies: { name: string; description: string | null; behavioral_indicators: string | null }[];
  kpis: { title: string; measure: string | null; target: string | null }[];
};

const STEPS = [
  "Employee Information",
  "Goals & Objectives (40%)",
  "Core Competencies (30%)",
  "Leadership (20%)",
  "Values & Culture (10%)",
  "Open Feedback",
  "Development & Next Goals",
  "Summary & Sign-off",
];

export function PerformanceAppraisalFormWizard({
  employees,
  initial,
  currentUserRole = "employee",
  roleBenchmarks = [],
}: {
  employees: Employee[];
  initial?: PerformanceAppraisalForm;
  currentUserRole?: string;
  currentUserId?: string;
  roleBenchmarks?: RoleBenchmark[];
}) {
  const [form, setForm] = useState<PerformanceAppraisalForm>(
    initial ?? emptyPerformanceAppraisal()
  );
  const [step, setStep] = useState(0);
  const [isSaving, startTransition] = useTransition();

  const patch = useCallback(
    (p: Partial<PerformanceAppraisalForm>) => setForm((f) => ({ ...f, ...p })),
    []
  );

  const goTo = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  const isFinal = form.status === "Final";
  const isHR = currentUserRole === "admin";
  const isEmployee = currentUserRole === "employee";
  const isManager = currentUserRole === "manager" || currentUserRole === "executive";
  const canEditDetails = !isEmployee && !isFinal;
  const canEditN1 = isEmployee && !isFinal;
  const canEditN2 = isManager && !isFinal;
  const canEditCalibration = isHR && !isFinal;
  const selectedEmployee = employees.find((item) => item.employee_id === form.employee_id);
  const selectedManager = employees.find((item) => item.employee_id === form.manager_id);
  const benchmarkByRole = new Map(roleBenchmarks.map((benchmark) => [benchmark.role_title, benchmark]));
  const coreCompetencyNames = Object.keys(form.core_competencies);
  const leadershipNames = Object.keys(form.leadership);
  const valuesNames = Object.keys(form.values_culture);

  function applyEmployeeBenchmark(employeeId: string) {
    const employee = employees.find((item) => item.employee_id === employeeId);
    const benchmark = employee ? benchmarkByRole.get(employee.job_title) : null;

    if (!benchmark) {
      patch({ employee_id: employeeId });
      return;
    }

    const roleCompetencies = Object.fromEntries(
      benchmark.competencies.map((competency) => [competency.name, emptyCompetency()])
    );
    const roleGoals = benchmark.kpis.slice(0, 6).map((kpi) => ({
      ...emptyGoal(),
      objective: kpi.title,
      kpi: kpi.measure ?? kpi.title,
      target: kpi.target ?? "",
    }));

    patch({
      employee_id: employeeId,
      department: benchmark.department,
      document_ref: `Role benchmark: ${benchmark.role_title}`,
      core_competencies: Object.keys(roleCompetencies).length ? roleCompetencies : form.core_competencies,
      goals: roleGoals.length ? roleGoals : form.goals,
    });
  }

  async function handleSave() {
    let nextStatus = form.status || "Draft";
    
    // Auto-advance status based on signatures
    if (form.hr_signed_at) {
      nextStatus = "Final";
    } else if (form.manager_signed_at) {
      nextStatus = "N2 Complete";
    } else if (form.employee_signed_at) {
      nextStatus = "N1 Complete";
    }

    const payload = { ...form, status: nextStatus };
    patch({ status: nextStatus });
    
    startTransition(async () => {
      const result = await saveAppraisal(payload);
      if (result.error) {
        toast.error(`Error: ${result.error}`);
        // Revert status on failure if needed
      } else {
        toast.success(`Appraisal saved as ${nextStatus}.`);
        if (result.data) {
          patch(result.data as unknown as Partial<PerformanceAppraisalForm>); // Update with server response (e.g. ID, created_at)
        }
      }
    });
  }

  /* ---- Goal helpers ---- */
  const updateGoal = (i: number, g: GoalRow) => {
    const next = [...form.goals];
    next[i] = g;
    patch({ goals: next });
  };
  const removeGoal = (i: number) => patch({ goals: form.goals.filter((_, j) => j !== i) });
  const addGoal = () => patch({ goals: [...form.goals, emptyGoal()] });

  /* ---- Competency helpers ---- */
  const updateComp = (section: "core_competencies" | "leadership" | "values_culture", name: string, entry: CompetencyEntry) => {
    patch({ [section]: { ...form[section], [name]: entry } });
  };

  /* ---- Dev plan helpers ---- */
  const updateDev = (i: number, d: DevPlanRow) => {
    const next = [...form.development_plan];
    next[i] = d;
    patch({ development_plan: next });
  };
  const addDev = () => patch({ development_plan: [...form.development_plan, emptyDevPlan()] });

  /* ---- Next goals helpers ---- */
  const updateNextGoal = (i: number, g: NextGoalRow) => {
    const next = [...form.next_period_goals];
    next[i] = g;
    patch({ next_period_goals: next });
  };
  const addNextGoal = () => patch({ next_period_goals: [...form.next_period_goals, emptyNextGoal()] });

  return (
    <>
      {/* Progress */}
      <Progress value={pct} className="mb-6">
        <ProgressLabel>
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </ProgressLabel>
        <ProgressValue />
      </Progress>

      {/* Step pills */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => goTo(i)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors select-none",
              i === step
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : i < step
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
                  : "border-border text-muted-foreground"
            )}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      {/* ===== STEP 0: Employee Info ===== */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Employee Information</CardTitle>
            <CardDescription>Basic details for the appraisal record</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Employee" required>
                {isEmployee ? (
                  <Input
                    value={selectedEmployee ? `${selectedEmployee.employee_id} - ${selectedEmployee.full_name} (${selectedEmployee.job_title})` : form.employee_id}
                    readOnly
                  />
                ) : (
                <NativeSelect value={form.employee_id} onChange={applyEmployeeBenchmark} placeholder="Select employee...">
                  {employees.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.employee_id} — {e.full_name} ({e.job_title})
                    </option>
                  ))}
                </NativeSelect>
                )}
              </Field>
              <Field label="Direct Manager (N2)">
                {isEmployee ? (
                  <Input
                    value={selectedManager ? `${selectedManager.employee_id} - ${selectedManager.full_name}` : form.manager_id}
                    readOnly
                  />
                ) : (
                <NativeSelect value={form.manager_id} onChange={(v) => patch({ manager_id: v })} placeholder="Select manager...">
                  {employees.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.employee_id} — {e.full_name}
                    </option>
                  ))}
                </NativeSelect>
                )}
              </Field>
              <Field label="Department">
                <Input value={form.department} onChange={(e) => patch({ department: e.target.value })} placeholder="e.g. Engineering" readOnly={isEmployee} />
              </Field>
              <Field label="Business Unit / Division">
                <Input value={form.business_unit} onChange={(e) => patch({ business_unit: e.target.value })} />
              </Field>
              <Field label="Location">
                <Input value={form.location} onChange={(e) => patch({ location: e.target.value })} />
              </Field>
              <Field label="Appraisal Period">
                <Input value={form.appraisal_period} onChange={(e) => patch({ appraisal_period: e.target.value })} placeholder="e.g. Jan 2025 – Dec 2025" />
              </Field>
              <Field label="Appraisal Type" required>
                <NativeSelect value={form.appraisal_type} onChange={(v) => patch({ appraisal_type: v as AppraisalType })} placeholder="Select type...">
                  {APPRAISAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Document Ref.">
                <Input value={form.document_ref} onChange={(e) => patch({ document_ref: e.target.value })} placeholder="Auto-generated or manual" />
              </Field>
            </div>
            <RatingScaleReference />
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 1: Goals (Section A) ===== */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Section A — Goals & Objectives</CardTitle>
            <CardDescription>Weight: 40% — Rate achievement of goals agreed at the start of the period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.goals.map((g, i) => (
              <GoalRowEditor
                key={i}
                index={i}
                goal={g}
                onChange={(u) => updateGoal(i, u)}
                onRemove={() => removeGoal(i)}
                canRemove={form.goals.length > 1}
                canEditDetails={canEditDetails}
                canRateN1={canEditN1}
                canRateN2={canEditN2}
              />
            ))}
            {form.goals.length < 6 && canEditDetails && (
              <Button type="button" variant="outline" size="sm" onClick={addGoal}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add Goal
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 2: Core Competencies (Section B) ===== */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Section B — Core Competencies</CardTitle>
            <CardDescription>Weight: 30% — Rate each competency independently. Both N1 and N2 provide a rating.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {coreCompetencyNames.map((c) => (
              <CompetencyRow key={c} name={c} entry={form.core_competencies[c]} onChange={(u) => updateComp("core_competencies", c, u)} canEditN1={canEditN1} canEditN2={canEditN2} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 3: Leadership (Section C) ===== */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Section C — Leadership & Management</CardTitle>
            <CardDescription>Weight: 20% — For employees with direct reports or project leadership responsibilities.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-border bg-accent/30 p-3">
              <Switch checked={form.leadership_applicable} onCheckedChange={(v) => patch({ leadership_applicable: !!v })} disabled={!canEditDetails} />
              <Label className="text-sm">This section applies to this employee</Label>
            </div>
            {form.leadership_applicable ? (
              leadershipNames.map((c) => (
                <CompetencyRow key={c} name={c} entry={form.leadership[c]} onChange={(u) => updateComp("leadership", c, u)} canEditN1={canEditN1} canEditN2={canEditN2} />
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Section marked as N/A — employee has no direct reports or leadership responsibilities.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 4: Values (Section D) ===== */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Section D — Dhofar Global Values & Culture</CardTitle>
            <CardDescription>Weight: 10% — How consistently the employee demonstrates core values.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {valuesNames.map((c) => (
              <CompetencyRow key={c} name={c} entry={form.values_culture[c]} onChange={(u) => updateComp("values_culture", c, u)} canEditN1={canEditN1} canEditN2={canEditN2} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===== STEP 5: Open Feedback (Section E) ===== */}
      {step === 5 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee (N1) Self-Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="What are your top 3 achievements this period?">
                <Textarea value={form.feedback_n1.top_achievements} onChange={(e) => patch({ feedback_n1: { ...form.feedback_n1, top_achievements: e.target.value } })} rows={3} disabled={!canEditN1} />
              </Field>
              <Field label="What challenges did you face and how did you address them?">
                <Textarea value={form.feedback_n1.challenges} onChange={(e) => patch({ feedback_n1: { ...form.feedback_n1, challenges: e.target.value } })} rows={3} disabled={!canEditN1} />
              </Field>
              <Field label="What support do you need from your manager or organization?">
                <Textarea value={form.feedback_n1.support_needed} onChange={(e) => patch({ feedback_n1: { ...form.feedback_n1, support_needed: e.target.value } })} rows={3} disabled={!canEditN1} />
              </Field>
              <Field label="What are your career aspirations for the next 1–3 years?">
                <Textarea value={form.feedback_n1.career_aspirations} onChange={(e) => patch({ feedback_n1: { ...form.feedback_n1, career_aspirations: e.target.value } })} rows={3} disabled={!canEditN1} />
              </Field>
              <Field label="How would you rate your overall performance this period? Why?">
                <Textarea value={form.feedback_n1.self_rating_rationale} onChange={(e) => patch({ feedback_n1: { ...form.feedback_n1, self_rating_rationale: e.target.value } })} rows={3} disabled={!canEditN1} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manager (N2) Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="What were the employee's top 3 achievements this period?">
                <Textarea value={form.feedback_n2.top_achievements} onChange={(e) => patch({ feedback_n2: { ...form.feedback_n2, top_achievements: e.target.value } })} rows={3} disabled={!canEditN2} />
              </Field>
              <Field label="What challenges did the employee face and how effectively were they managed?">
                <Textarea value={form.feedback_n2.challenges} onChange={(e) => patch({ feedback_n2: { ...form.feedback_n2, challenges: e.target.value } })} rows={3} disabled={!canEditN2} />
              </Field>
              <Field label="What support is this employee being provided for the next period?">
                <Textarea value={form.feedback_n2.support_provided} onChange={(e) => patch({ feedback_n2: { ...form.feedback_n2, support_provided: e.target.value } })} rows={3} disabled={!canEditN2} />
              </Field>
              <Field label="What is your recommendation for this employee's career path?">
                <Textarea value={form.feedback_n2.career_recommendation} onChange={(e) => patch({ feedback_n2: { ...form.feedback_n2, career_recommendation: e.target.value } })} rows={3} disabled={!canEditN2} />
              </Field>
              <Field label="Manager's overall assessment and key message to the employee:">
                <Textarea value={form.feedback_n2.overall_assessment} onChange={(e) => patch({ feedback_n2: { ...form.feedback_n2, overall_assessment: e.target.value } })} rows={3} disabled={!canEditN2} />
              </Field>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP 6: IDP + Next Goals (Sections F & G) ===== */}
      {step === 6 && (
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Section F — Individual Development Plan</CardTitle>
              <CardDescription>Jointly agreed development areas to build capability and support career growth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.development_plan.map((d, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 text-sm font-semibold text-muted-foreground">Development Area {i + 1}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Development Area"><Input value={d.area} onChange={(e) => updateDev(i, { ...d, area: e.target.value })} /></Field>
                    <Field label="Action / Activity"><Input value={d.action} onChange={(e) => updateDev(i, { ...d, action: e.target.value })} /></Field>
                    <Field label="Resources / Support"><Input value={d.resources} onChange={(e) => updateDev(i, { ...d, resources: e.target.value })} /></Field>
                    <Field label="Timeline"><Input value={d.timeline} onChange={(e) => updateDev(i, { ...d, timeline: e.target.value })} /></Field>
                    <Field label="Owner"><Input value={d.owner} onChange={(e) => updateDev(i, { ...d, owner: e.target.value })} /></Field>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addDev}><Plus className="mr-1 h-3.5 w-3.5" /> Add Development Area</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Section G — Goals for Next Period</CardTitle>
              <CardDescription>Agreed goals for the upcoming appraisal cycle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.next_period_goals.map((g, i) => (
                <div key={i} className="rounded-lg border border-border bg-card p-4">
                  <div className="mb-2 text-sm font-semibold text-muted-foreground">Goal {i + 1}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2"><Field label="Goal / Objective"><Input value={g.objective} onChange={(e) => updateNextGoal(i, { ...g, objective: e.target.value })} /></Field></div>
                    <Field label="Key Result / Metric"><Input value={g.key_result} onChange={(e) => updateNextGoal(i, { ...g, key_result: e.target.value })} /></Field>
                    <Field label="Target Date"><Input type="date" value={g.target_date} onChange={(e) => updateNextGoal(i, { ...g, target_date: e.target.value })} /></Field>
                    <Field label="Priority">
                      <NativeSelect value={g.priority} onChange={(v) => updateNextGoal(i, { ...g, priority: v as NextGoalRow["priority"] })} placeholder="Select...">
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </NativeSelect>
                    </Field>
                  </div>
                </div>
              ))}
              {form.next_period_goals.length < 5 && (
                <Button type="button" variant="outline" size="sm" onClick={addNextGoal}><Plus className="mr-1 h-3.5 w-3.5" /> Add Goal</Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP 7: Summary & Sign-off (Sections H, I, J) ===== */}
      {step === 7 && (
        <div className="space-y-5">
          <ScoreSummary form={form} />

          {/* Final rating + recommended action */}
          <Card>
            <CardHeader><CardTitle className="text-base">Calibrated Rating & Recommendation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Final / Calibrated Rating">
                  <RatingSelect value={form.calibrated_rating} onChange={(v) => patch({ calibrated_rating: v })} disabled={!canEditCalibration} />
                </Field>
                <Field label="Overall Performance Label">
                  <Input value={form.overall_label} onChange={(e) => patch({ overall_label: e.target.value })} placeholder={form.calibrated_rating ? RATING_LABELS[form.calibrated_rating] ?? "" : "e.g. Meets Expectations"} disabled={!canEditCalibration} />
                </Field>
              </div>
              <Field label="Rationale for Calibration (if different from computed)">
                <Textarea value={form.calibration_rationale} onChange={(e) => patch({ calibration_rationale: e.target.value })} rows={2} disabled={!canEditCalibration} />
              </Field>
              <Field label="Recommended Action">
                <NativeSelect value={form.recommended_action} onChange={(v) => patch({ recommended_action: v })} placeholder="Select action..." disabled={!canEditCalibration}>
                  {RECOMMENDED_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </NativeSelect>
              </Field>
            </CardContent>
          </Card>

          {/* Acknowledgement (Section I) */}
          <Card>
            <CardHeader><CardTitle className="text-base">Employee Acknowledgement</CardTitle></CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                I acknowledge that I have read and discussed this appraisal with my manager. My signature does not necessarily indicate agreement with the ratings.
              </p>
              <Field label="Employee Comments / Disagreement (if any)">
                <Textarea value={form.employee_comments} onChange={(e) => patch({ employee_comments: e.target.value })} rows={3} placeholder="Optional — record any disagreements here..." disabled={!canEditN1} />
              </Field>
            </CardContent>
          </Card>

          {/* Signatures (Section J) */}
          <Card>
            <CardHeader><CardTitle className="text-base">Digital Signatures</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <SignatureBlock label="Employee (N1)" signedAt={form.employee_signed_at} onSign={() => patch({ employee_signed_at: new Date().toISOString() })} disabled={!canEditN1} />
                <SignatureBlock label="Direct Manager (N2)" signedAt={form.manager_signed_at} onSign={() => patch({ manager_signed_at: new Date().toISOString() })} disabled={!canEditN2 || !form.employee_signed_at} />
                <div>
                  <SignatureBlock 
                    label="HR Representative" 
                    signedAt={form.hr_signed_at} 
                    onSign={() => patch({ hr_signed_at: new Date().toISOString() })} 
                    disabled={!canEditCalibration || !form.employee_signed_at || !form.manager_signed_at}
                  />
                  <div className="mt-2">
                    <Field label="HR Representative Name">
                      <Input 
                        value={form.hr_representative} 
                        onChange={(e) => patch({ hr_representative: e.target.value })} 
                        placeholder="Name" 
                        disabled={!canEditCalibration}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* PDF Export */}
          <Card>
            <CardHeader><CardTitle className="text-base">Export Document</CardTitle></CardHeader>
            <CardContent>
              <SavePdfButton form={form} employees={employees} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== Navigation ===== */}
      <div className="mt-6 flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => goTo(step - 1)} disabled={step === 0}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button type="button" variant="secondary" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
          Save Draft
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={() => goTo(step + 1)} disabled={isSaving}>
            Continue <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
            {isEmployee ? "Save Sign-off" : isManager ? "Save Manager Sign-off" : "Finalize Appraisal"}
          </Button>
        )}
      </div>
    </>
  );
}

/* ---- Shared helpers ---- */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

function NativeSelect({ value, onChange, placeholder, disabled, children }: { value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={cn("h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50", !value && "text-muted-foreground", disabled && "cursor-not-allowed opacity-50")}>
      <option value="" disabled>{placeholder}</option>
      {children}
    </select>
  );
}

function SignatureBlock({ label, signedAt, onSign, disabled }: { label: string; signedAt: string | null; onSign: () => void; disabled?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {signedAt ? (
        <div className="mt-2">
          <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
            Signed {new Date(signedAt).toLocaleString()}
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onSign} disabled={disabled}>
          Sign
        </Button>
      )}
    </div>
  );
}
