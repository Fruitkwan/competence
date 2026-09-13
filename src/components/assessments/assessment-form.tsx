"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Clock3, Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveRaterAssessment, saveSelfAssessment, type RaterAnswer, type SelfAnswer } from "@/lib/actions/assessments";
import { cn } from "@/lib/utils";

type Letter = "A" | "B" | "C" | "D";

export type FormItem = {
  id: string;
  sort_order: number;
  group_name: string | null;
  name: string;
  indicator: string;
  anchor_2: string | null;
  anchor_3: string | null;
  anchor_4: string | null;
  scenario: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
};

export type ExistingResponse = {
  item_id: string;
  rating: number | null;
  not_observed: boolean;
  scenario_answer: Letter | null;
  evidence: string | null;
};

const SCALE: { value: number; label: string; hint: string }[] = [
  { value: 1, label: "Not yet demonstrated", hint: "Looked for it and not seen it." },
  { value: 2, label: "Developing", hint: "Present but inconsistent, or only when prompted." },
  { value: 3, label: "Meets expectations", hint: "Reliable and unprompted, to the standard the role requires." },
  { value: 4, label: "Exceeds expectations", hint: "Reliable, and improves it, extends it to others, or anticipates." },
  { value: 5, label: "Role model", hint: "Others are sent to this person to learn it." },
];

type Mode = { kind: "self"; assignmentId: string; aspirationQuestions: string[]; aspiration: Record<string, string> } | { kind: "rater"; raterId: string; subjectName: string };

type Draft = { rating: number | null; not_observed: boolean; scenario_answer: Letter | null; evidence: string };

function AssessmentTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setSeconds(Math.floor((performance.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const time = [hours, minutes, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" title="Time spent in this session. Resets when you reload or leave the assessment.">
      <Clock3 aria-hidden="true" className="size-4" />
      <span>Time spent</span>
      <span role="timer" aria-label="Time spent in this assessment session" className="font-mono font-medium tabular-nums text-foreground">{time}</span>
    </div>
  );
}

export function AssessmentForm({
  title,
  intro,
  items,
  existing,
  mode,
}: {
  title: string;
  intro: string | null;
  items: FormItem[];
  existing: ExistingResponse[];
  mode: Mode;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLDivElement>(null);
  const hasAspiration = mode.kind === "self" && mode.aspirationQuestions.length > 0;
  const reviewStep = items.length + (hasAspiration ? 1 : 0);
  const goTo = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  };
  const complete = (item: FormItem) => {
    const d = drafts[item.id];
    return mode.kind === "self" ? d.rating != null && (!item.scenario || d.scenario_answer != null) : d.rating != null || d.not_observed;
  };
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const init: Record<string, Draft> = {};
    for (const item of items) {
      const e = existing.find((r) => r.item_id === item.id);
      init[item.id] = {
        rating: e?.rating ?? null,
        not_observed: e?.not_observed ?? false,
        scenario_answer: e?.scenario_answer ?? null,
        evidence: e?.evidence ?? "",
      };
    }
    return init;
  });
  const [aspiration, setAspiration] = useState<Record<string, string>>(mode.kind === "self" ? mode.aspiration : {});
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);

  const update = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const progress = { done: items.filter(complete).length, total: items.length };

  async function persist(submit: boolean) {
    if (submit && !confirm("Submit now? You will not be able to change your answers afterwards.")) return;
    setBusy(submit ? "submit" : "save");
    try {
      let result: { error?: string; success?: boolean };
      if (mode.kind === "self") {
        const answers: SelfAnswer[] = items.map((i) => ({
          item_id: i.id,
          rating: drafts[i.id].rating,
          scenario_answer: drafts[i.id].scenario_answer,
        }));
        result = await saveSelfAssessment(mode.assignmentId, answers, mode.aspirationQuestions.length ? aspiration : null, submit);
      } else {
        const answers: RaterAnswer[] = items.map((i) => ({
          item_id: i.id,
          rating: drafts[i.id].rating,
          not_observed: drafts[i.id].not_observed,
          evidence: drafts[i.id].evidence.trim() || null,
        }));
        result = await saveRaterAssessment(mode.raterId, answers, submit);
      }
      if (result.error) return toast.error(result.error);
      toast.success(submit ? "Submitted. Thank you." : "Draft saved.");
      if (submit) router.push("/assessments");
      router.refresh();
    } catch {
      toast.error("Could not save your answers. Please try again.");
    } finally {
      setBusy(null);
    }
  }


  const ratePrompt = mode.kind === "self" ? "Rate your ability" : `Rate ${mode.subjectName}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-4">
      <div className="rounded-2xl border border-teal-200/70 bg-teal-50/60 p-5 dark:border-teal-900 dark:bg-teal-950/20 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-teal-100 p-3 text-teal-700 dark:bg-teal-900 dark:text-teal-200"><ClipboardCheck className="size-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Your development starts here</p>
            <h2 className="mt-1 text-lg font-semibold">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{mode.kind === "self" ? "Take one skill at a time. Reflect on your experience, choose a rating, then work through the scenario." : `Share your observations of ${mode.subjectName}, one skill at a time.`}</p>
            <details className="mt-3 text-sm text-muted-foreground">
              <summary className="cursor-pointer font-medium text-foreground">How to complete this assessment{intro ? " & privacy" : ""}</summary>
              <p className="mt-3 max-w-2xl leading-relaxed">Use the full rating scale and choose the level that best reflects consistent performance. Each scenario has one best answer. You can revisit any section before submitting. Save a draft before leaving to continue later.{mode.kind === "rater" && ' Choose “Not observed” if you have not had enough visibility; it is excluded from the score.'}</p>
              {intro && <p className="mt-3 max-w-2xl whitespace-pre-line leading-relaxed">{intro}</p>}
            </details>
          </div>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-muted/20 p-4 lg:sticky lg:top-6">
          <div className="mb-3 flex items-center justify-between text-sm"><span className="font-semibold">Your progress</span><span className="text-muted-foreground">{progress.done}/{progress.total}</span></div>
          <progress aria-label="Skills completed" value={progress.done} max={progress.total || 1} className="mb-5 h-1.5 w-full overflow-hidden rounded-full accent-teal-600" />
          <nav aria-label="Assessment sections" className="flex gap-2 overflow-x-auto lg:max-h-[55vh] lg:flex-col lg:overflow-y-auto">
            {items.map((item, index) => (
              <button key={item.id} onClick={() => goTo(index)} aria-current={step === index ? "step" : undefined} className={cn("flex shrink-0 items-center gap-3 rounded-xl p-3 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-teal-600 lg:shrink", step === index && "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-200 dark:bg-teal-950 dark:text-teal-200")}>
                <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border text-xs", complete(item) && "border-teal-600 bg-teal-600 text-white")}>{complete(item) ? <Check className="size-3.5" /> : index + 1}</span>
                <span>{item.name}<span className="sr-only">{complete(item) ? ", complete" : ", incomplete"}</span></span>
              </button>
            ))}
            {hasAspiration && <button onClick={() => goTo(items.length)} aria-current={step === items.length ? "step" : undefined} className={cn("shrink-0 rounded-xl p-3 text-left text-sm hover:bg-muted", step === items.length && "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200")}>Your aspirations</button>}
            <button onClick={() => goTo(reviewStep)} aria-current={step === reviewStep ? "step" : undefined} className={cn("shrink-0 rounded-xl p-3 text-left text-sm hover:bg-muted", step === reviewStep && "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200")}>Review & submit</button>
          </nav>
          <p className="mt-4 hidden text-xs leading-relaxed text-muted-foreground lg:block">Move between sections freely. Your answers stay here while you work.</p>
        </aside>
        <div ref={heading} tabIndex={-1} className="min-w-0 scroll-mt-6 space-y-5 outline-none">
          {items.slice(step, step + 1).map((item) => {
              const d = drafts[item.id];
              return (
                <Card key={item.id} className="overflow-hidden rounded-2xl py-0 shadow-sm">
                  <CardHeader className="gap-3 border-b bg-muted/20 px-6 py-6 sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-widest text-teal-700 dark:text-teal-300">Skill {step + 1} of {items.length}{item.group_name ? ` · ${item.group_name}` : ""}</p>
                    <CardTitle className="text-2xl tracking-tight">
                      {item.name}
                    </CardTitle>
                    <CardDescription className="text-sm leading-relaxed">{item.indicator}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8 px-6 pb-8 sm:px-8">
                    <details className="rounded-xl border bg-muted/20 p-4 text-sm">
                      <summary className="cursor-pointer font-medium">What does each level look like?</summary>
                      <div className="mt-4 space-y-4 leading-relaxed">
                      {[
                        ["2", "Developing", item.anchor_2],
                        ["3", "Meets expectations", item.anchor_3],
                        ["4", "Exceeds expectations", item.anchor_4],
                      ].map(([lvl, label, text]) => (
                        <div key={lvl} className="grid grid-cols-[2.5rem_1fr] gap-2">
                          <span className="font-mono text-xs text-muted-foreground">L{lvl}</span>
                          <span>
                            <span className="font-medium">{label}.</span> {text}
                          </span>
                        </div>
                      ))}
                      </div>
                    </details>

                    <fieldset className="space-y-4">
                      <legend className="text-sm font-medium">{ratePrompt}</legend>
                      <div className="grid gap-2 sm:grid-cols-5">
                        {SCALE.map((s) => {
                          const on = d.rating === s.value && !d.not_observed;
                          return (
                            <label
                              key={s.value}
                              className={cn(
                                "flex cursor-pointer flex-col gap-2 rounded-xl border p-3 text-xs transition-colors hover:border-teal-400 hover:bg-teal-50/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600",
                                on && "border-teal-600 bg-teal-50 ring-1 ring-teal-600 dark:bg-teal-950"
                              )}
                            >
                              <span className="flex flex-wrap items-center gap-2">
                                <input
                                  type="radio"
                                  name={`rating-${item.id}`}
                                  checked={on}
                                  onChange={() => update(item.id, { rating: s.value, not_observed: false })}
                                />
                                <span className="font-semibold">{s.value}</span>
                                <span className="font-medium">{s.label}</span>
                              </span>
                              <span className="text-muted-foreground">{s.hint}</span>
                            </label>
                          );
                        })}
                      </div>
                      {mode.kind === "rater" && (
                        <label className="mt-1 flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={d.not_observed}
                            onChange={(e) => update(item.id, { not_observed: e.target.checked, rating: e.target.checked ? null : d.rating })}
                          />
                          Not observed - I have not had the visibility to judge
                        </label>
                      )}
                    </fieldset>

                    {mode.kind === "self" && item.scenario && (
                      <fieldset className="space-y-4">
                        <legend className="text-sm font-medium">Scenario check</legend>
                        <p className="rounded-xl bg-muted/40 p-5 text-sm leading-7">{item.scenario}</p>
                        <div className="grid gap-3">
                          {(
                            [
                              ["A", item.option_a],
                              ["B", item.option_b],
                              ["C", item.option_c],
                              ["D", item.option_d],
                            ] as [Letter, string | null][]
                          ).map(([letter, text]) => {
                            const on = d.scenario_answer === letter;
                            return (
                              <label
                                key={letter}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed transition-colors hover:border-teal-400 hover:bg-muted/30 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-600",
                                  on && "border-teal-600 bg-teal-50 ring-1 ring-teal-600 dark:bg-teal-950"
                                )}
                              >
                                <input
                                  type="radio"
                                  name={`scenario-${item.id}`}
                                  className="mt-1"
                                  checked={on}
                                  onChange={() => update(item.id, { scenario_answer: letter })}
                                />
                                <span className="font-mono text-xs text-muted-foreground">{letter}</span>
                                <span>{text}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    )}

                    {mode.kind === "rater" && (
                      <div className="grid gap-3">
                        <Label htmlFor={`ev-${item.id}`} className="text-sm">
                          Evidence (optional) - one example that supports your rating
                        </Label>
                        <Textarea
                          id={`ev-${item.id}`}
                          rows={2}
                          value={d.evidence}
                          onChange={(e) => update(item.id, { evidence: e.target.value })}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

      {mode.kind === "self" && hasAspiration && step === items.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aspiration and intent</CardTitle>
            <CardDescription>
              Completed by you only. Not rated, not scored, seen by HR and your line manager to build your development plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode.aspirationQuestions.map((q, i) => (
              <div key={q} className="grid gap-3">
                <Label htmlFor={`asp-${i}`} className="text-sm">
                  {q}
                </Label>
                <Textarea
                  id={`asp-${i}`}
                  rows={2}
                  value={aspiration[q] ?? ""}
                  onChange={(e) => setAspiration((a) => ({ ...a, [q]: e.target.value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

          {step === reviewStep && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-xl">Review your assessment</CardTitle><CardDescription>{progress.done === progress.total ? "All skills are complete. Take a moment to review before submitting." : "A few answers still need your attention. Choose a skill below to finish it."}</CardDescription></CardHeader>
              <CardContent className="space-y-3">
                {items.map((item, index) => <button key={item.id} onClick={() => goTo(index)} className="flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left text-sm hover:bg-muted/40"><span className="font-medium">{item.name}</span><span className={cn("text-right text-xs", complete(item) ? "text-teal-700 dark:text-teal-300" : "text-amber-700 dark:text-amber-300")}>{drafts[item.id].not_observed ? "Not observed" : drafts[item.id].rating ? `${drafts[item.id].rating} · ${SCALE.find(s => s.value === drafts[item.id].rating)?.label}` : "Rating needed"}{mode.kind === "self" && item.scenario && (drafts[item.id].scenario_answer ? ` · Scenario ${drafts[item.id].scenario_answer}` : " · Scenario needed")}</span></button>)}
                {hasAspiration && <Button variant="outline" onClick={() => goTo(items.length)}>Review your aspirations</Button>}
                <p className="pt-3 text-xs leading-relaxed text-muted-foreground">Once submitted, your answers cannot be changed.</p>
              </CardContent>
            </Card>
          )}
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 backdrop-blur sm:p-4">
            <div className="flex flex-wrap items-center gap-3">
            <AssessmentTimer />
            <Button variant="ghost" disabled={step === 0 || busy != null} onClick={() => goTo(step - 1)}><ArrowLeft className="size-4" /> Back</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy != null} onClick={() => persist(false)}>
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
              </Button>
              {step < reviewStep ? <Button disabled={busy != null} onClick={() => goTo(step + 1)}>{step + 1 === reviewStep ? "Review" : "Continue"}<ArrowRight className="size-4" /></Button> : <Button disabled={busy != null || progress.total === 0 || progress.done < progress.total} onClick={() => persist(true)}>{busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit</Button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
