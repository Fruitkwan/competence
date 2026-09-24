import { CheckCircle2, Clock3, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminAnswer, AdminResponseSection } from "@/lib/assessments/admin-responses";

const RATER_LABEL = {
  self: "Employee",
  line_manager: "Line manager",
  cross_dept: "Cross-departmental",
  peer: "Peer",
} as const;

const RATING_LABEL: Record<number, string> = {
  1: "Not yet demonstrated",
  2: "Developing",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Role model",
};

export function AdminAssessmentResponses({ sections }: { sections: AdminResponseSection[] }) {
  if (sections.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="font-medium">No response details are available</div>
          <p className="mt-1 text-sm text-muted-foreground">This assessment has no questions or assigned raters.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <div>
          <div className="font-medium">Confidential admin view</div>
          <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/80">
            Named individual responses are visible only to HR administrators. Do not share this screen with the assessed employee.
          </p>
        </div>
      </div>

      {sections.map((section) => {
        const raters = section.questions[0]?.answers ?? [];
        const submitted = raters.filter((answer) => answer.status === "submitted").length;
        return (
          <Card key={section.assignmentId} className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{section.templateName}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {section.employeeName}{section.wave ? ` · ${section.wave}` : ""} · {section.questions.length} questions
                  </p>
                </div>
                <Badge variant="outline">{submitted}/{raters.length} raters submitted</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {raters.map((rater) => (
                  <div key={rater.raterId} className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
                    {rater.raterType === "self" ? <UserRound className="size-3.5" /> : <UsersRound className="size-3.5" />}
                    <span className="font-medium">{rater.raterName}</span>
                    <span className="text-muted-foreground">{RATER_LABEL[rater.raterType]}</span>
                    {rater.status === "submitted" ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Clock3 className="size-3.5 text-amber-600" />}
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent className="divide-y p-0">
              {section.questions.map((question) => {
                const employeeAnswer = question.answers.find((answer) => answer.raterType === "self") ?? null;
                const otherAnswers = question.answers.filter((answer) => answer.raterType !== "self");
                return (
                  <section key={question.id} className="p-5">
                    <div className="flex gap-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {question.sortOrder}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-medium">{question.name}</h3>
                          {question.groupName && <Badge variant="secondary" className="text-[10px]">{question.groupName}</Badge>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{question.indicator}</p>
                        {question.scenario && (
                          <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-xs leading-relaxed">
                            <span className="font-semibold">Scenario:</span> {question.scenario}
                          </div>
                        )}

                        <div className="mt-4 grid gap-3 lg:grid-cols-2">
                          <ResponseCard title="Employee answer" answer={employeeAnswer} />
                          <div className="rounded-lg border p-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peer and manager answers</div>
                            {otherAnswers.length ? (
                              <div className="space-y-2">
                                {otherAnswers.map((answer) => <NamedAnswer key={answer.raterId} answer={answer} />)}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">No peer or manager raters were assigned.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ResponseCard({ title, answer }: { title: string; answer: AdminAnswer | null }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      {answer ? <AnswerValue answer={answer} /> : <p className="text-sm text-muted-foreground">No employee response was assigned.</p>}
    </div>
  );
}

function NamedAnswer({ answer }: { answer: AdminAnswer }) {
  return (
    <div className="rounded-md bg-muted/30 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">{answer.raterName}</div>
        <Badge variant="outline" className="text-[10px]">{RATER_LABEL[answer.raterType]}</Badge>
      </div>
      <div className="mt-1.5"><AnswerValue answer={answer} /></div>
    </div>
  );
}

function AnswerValue({ answer }: { answer: AdminAnswer }) {
  if (answer.status !== "submitted") return <p className="text-sm text-amber-700 dark:text-amber-300">Pending response</p>;
  if (answer.notObserved) return <p className="text-sm text-muted-foreground">Not observed</p>;
  if (answer.rating == null && !answer.scenarioAnswer) return <p className="text-sm text-muted-foreground">No answer recorded</p>;

  return (
    <div className="space-y-1.5 text-sm">
      {answer.rating != null && (
        <div><span className="font-semibold">{answer.rating}/5</span><span className="ml-2 text-xs text-muted-foreground">{RATING_LABEL[answer.rating]}</span></div>
      )}
      {answer.scenarioAnswer && (
        <div className="text-xs"><span className="font-semibold">Scenario {answer.scenarioAnswer}</span>{answer.scenarioAnswerText ? ` — ${answer.scenarioAnswerText}` : ""}</div>
      )}
      {answer.evidence && <blockquote className="border-l-2 pl-2 text-xs italic text-muted-foreground">{answer.evidence}</blockquote>}
    </div>
  );
}
