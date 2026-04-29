"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { DeptGrid } from "@/components/training/dept-grid";
import { PillSelect } from "@/components/training/pill-select";
import { CheckCircle2, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Constants ---------- */
const DEPARTMENTS_OPTIONS = [
  "Engineering", "Product", "Sales", "Marketing", "Finance", "HR",
  "Operations", "Customer Success", "Legal", "Design",
  "Data & Analytics", "Supply Chain", "IT", "Strategy",
];

const ROLES = [
  "Employee / Individual Contributor",
  "Team Lead",
  "Manager",
  "Senior Manager / Director",
  "VP / Executive",
];

const URGENCY_OPTIONS = [
  "Low — nice to have",
  "Medium — this quarter",
  "High — this month",
  "Critical — ASAP",
];

const FORMAT_OPTIONS = [
  "Workshop / group session",
  "1-on-1 coaching",
  "Job shadowing",
  "Online / self-paced",
  "Lunch & learn",
];

const HOUR_OPTIONS = ["1–2 hrs", "3–5 hrs", "6–10 hrs", "10+ hrs"];

const CONFIDENCE_OPTIONS = [
  "Beginner — I can share basics",
  "Intermediate — comfortable teaching",
  "Expert — deep subject matter knowledge",
];

/* ---------- Types ---------- */
type FormErrors = Record<string, string>;

/* ---------- Component ---------- */
export default function TrainingSurveyPage() {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [dept, setDept] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [manager, setManager] = useState("");

  // Step 2 fields
  const [learnDepts, setLearnDepts] = useState<Set<string>>(new Set());
  const [learnTopics, setLearnTopics] = useState("");
  const [urgency, setUrgency] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [learnHrs, setLearnHrs] = useState<string | null>(null);

  // Step 3 fields
  const [teachDepts, setTeachDepts] = useState<Set<string>>(new Set());
  const [teachTopics, setTeachTopics] = useState("");
  const [confidence, setConfidence] = useState<string | null>(null);
  const [teachHrs, setTeachHrs] = useState<string | null>(null);
  const [recommend, setRecommend] = useState("");
  const [comments, setComments] = useState("");

  // UI state
  const [errors, setErrors] = useState<FormErrors>({});
  const [responseId, setResponseId] = useState<string | null>(null);

  /* ---------- Helpers ---------- */
  const toggleSet = useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>) =>
      (dept: string) =>
        setter((prev) => {
          const next = new Set(prev);
          next.has(dept) ? next.delete(dept) : next.add(dept);
          return next;
        }),
    []
  );

  /* ---------- Validation ---------- */
  function validateStep1(): boolean {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "Please enter your name.";
    if (!jobTitle.trim()) errs.jobTitle = "Please enter your job title.";
    if (!dept) errs.dept = "Please select your department.";
    if (!role) errs.role = "Please select your role.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Please enter a valid email.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  /* ---------- Step navigation ---------- */
  function goStep(n: number) {
    if (n === 2 && !validateStep1()) return;
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitForm() {
    setResponseId("TRN-" + Date.now().toString(36).toUpperCase());
    setStep(4);
  }

  function resetForm() {
    setName(""); setJobTitle(""); setDept(""); setRole(""); setEmail(""); setManager("");
    setLearnDepts(new Set()); setLearnTopics(""); setUrgency(null); setFormat(null); setLearnHrs(null);
    setTeachDepts(new Set()); setTeachTopics(""); setConfidence(null); setTeachHrs(null);
    setRecommend(""); setComments(""); setErrors({}); setResponseId(null);
    setStep(1);
  }

  /* ---------- Step metadata ---------- */
  const stepLabels = [
    "Step 1 of 3 — About you",
    "Step 2 of 3 — Training needs",
    "Step 3 of 3 — Training you can offer",
  ];
  const progressValues = [33, 66, 100];

  /* ---------- Render ---------- */
  return (
    <>
      <PageHeader
        title="Cross-Functional Training Survey"
        description="Help us plan smarter training across teams. This takes 3–5 minutes."
      />

      {/* Progress */}
      {step <= 3 && (
        <Progress value={progressValues[step - 1]} className="mb-6">
          <ProgressLabel>{stepLabels[step - 1]}</ProgressLabel>
          <ProgressValue />
        </Progress>
      )}

      {/* ===== STEP 1 ===== */}
      {step === 1 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Your information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required error={errors.name}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sarah Ahmed"
                    aria-invalid={!!errors.name}
                  />
                </Field>
                <Field label="Job title" required error={errors.jobTitle}>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Analyst"
                    aria-invalid={!!errors.jobTitle}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Department" required error={errors.dept}>
                  <NativeSelect value={dept} onChange={setDept} placeholder="Select department...">
                    {DEPARTMENTS_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                    <option value="Other">Other</option>
                  </NativeSelect>
                </Field>
                <Field label="Role level" required error={errors.role}>
                  <NativeSelect value={role} onChange={setRole} placeholder="Select role...">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </NativeSelect>
                </Field>
              </div>

              <Field label="Work email" required error={errors.email}>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@company.com"
                  aria-invalid={!!errors.email}
                />
              </Field>

              <Field label="Manager's name" hint="(optional — for reporting)">
                <Input
                  value={manager}
                  onChange={(e) => setManager(e.target.value)}
                  placeholder="e.g. James Park"
                />
              </Field>
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-end">
            <Button onClick={() => goStep(2)}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* ===== STEP 2 ===== */}
      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Training you want to receive
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Which departments would you like to learn from?" hint="(select all that apply)">
                <DeptGrid selected={learnDepts} onToggle={toggleSet(setLearnDepts)} />
              </Field>

              <hr className="border-border" />

              <Field label="What specific skills or topics do you want to learn?" hint="(optional)">
                <Textarea
                  value={learnTopics}
                  onChange={(e) => setLearnTopics(e.target.value)}
                  placeholder="e.g. data analytics basics, budgeting process, agile methodology..."
                />
              </Field>

              <Field label="How urgent is this training?">
                <PillSelect options={URGENCY_OPTIONS} value={urgency} onChange={setUrgency} />
              </Field>

              <Field label="Preferred training format">
                <PillSelect options={FORMAT_OPTIONS} value={format} onChange={setFormat} />
              </Field>

              <Field label="How many hours per month can you dedicate to learning?">
                <PillSelect options={HOUR_OPTIONS} value={learnHrs} onChange={setLearnHrs} />
              </Field>
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => goStep(1)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={() => goStep(3)}>
              Continue <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {/* ===== STEP 3 ===== */}
      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Training you can provide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Field label="Which departments are you willing to train?" hint="(select all that apply)">
                <DeptGrid selected={teachDepts} onToggle={toggleSet(setTeachDepts)} />
              </Field>

              <hr className="border-border" />

              <Field label="What topics or skills can you train others on?" hint="(if you selected departments above)">
                <Textarea
                  value={teachTopics}
                  onChange={(e) => setTeachTopics(e.target.value)}
                  placeholder="e.g. SQL and data visualization, campaign planning..."
                />
              </Field>

              <Field label="Your confidence level as a trainer">
                <PillSelect options={CONFIDENCE_OPTIONS} value={confidence} onChange={setConfidence} />
              </Field>

              <Field label="Hours per month you can dedicate to training others">
                <PillSelect options={HOUR_OPTIONS} value={teachHrs} onChange={setTeachHrs} />
              </Field>

              <Field label="Who would you recommend as a trainer in your department?" hint="(optional)">
                <Input
                  value={recommend}
                  onChange={(e) => setRecommend(e.target.value)}
                  placeholder="Name(s) and their area of expertise"
                />
              </Field>

              <hr className="border-border" />

              <Field label="Any additional comments, suggestions, or scheduling preferences?" hint="(optional)">
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="e.g. specific pairing preferences, goals for this quarter..."
                />
              </Field>
            </CardContent>
          </Card>

          <div className="mt-4 flex justify-between">
            <Button variant="outline" onClick={() => goStep(2)}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={submitForm}>
              Submit Survey ✓
            </Button>
          </div>
        </>
      )}

      {/* ===== SUCCESS ===== */}
      {step === 4 && (
        <Card className="mx-auto max-w-lg text-center">
          <CardContent className="py-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Survey submitted — thank you!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your responses have been recorded.<br />
              Your manager and the HR / L&amp;D team will follow up with next steps within 5 business days.
            </p>
            {responseId && (
              <p className="mt-4 text-xs text-muted-foreground/60">
                Response ID: {responseId}
              </p>
            )}
            <Button className="mt-6" variant="outline" onClick={resetForm}>
              Submit another response
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ---------- Helpers ---------- */

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
        {hint && (
          <span className="ml-1 font-normal text-muted-foreground">{hint}</span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !value && "text-muted-foreground"
      )}
    >
      <option value="" disabled>{placeholder}</option>
      {children}
    </select>
  );
}
