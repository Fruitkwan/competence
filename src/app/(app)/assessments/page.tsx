import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, string> = {
  assigned: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  submitted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
};

export default async function MyAssessmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, employee_id, full_name")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? "employee";

  const mineFilter = profile?.employee_id
    ? `employee_user_id.eq.${user.id},employee_id.eq.${profile.employee_id}`
    : `employee_user_id.eq.${user.id}`;

  const [{ data: mine, error }, { data: raterRows }] = await Promise.all([
    supabase
      .from("assessment_assignments")
      .select("id, template_id, wave, due_date, status, results_released, created_at")
      .or(mineFilter)
      .order("created_at", { ascending: false }),
    supabase
      .from("assessment_raters")
      .select("id, assignment_id, rater_type, status, submitted_at")
      .eq("rater_user_id", user.id)
      .neq("rater_type", "self")
      .order("created_at", { ascending: false }),
  ]);

  const raterAssignmentIds = (raterRows ?? []).map((r) => r.assignment_id);
  const { data: ratedAssignments } = raterAssignmentIds.length
    ? await supabase
        .from("assessment_assignments")
        .select("id, template_id, employee_id, wave, due_date, status")
        .in("id", raterAssignmentIds)
    : { data: [] };

  const templateIds = [...new Set([...(mine ?? []), ...(ratedAssignments ?? [])].map((a) => a.template_id))];
  const employeeIds = [...new Set((ratedAssignments ?? []).map((a) => a.employee_id))];
  const [{ data: templates }, { data: employees }] = await Promise.all([
    templateIds.length ? supabase.from("assessment_templates").select("id, kind, name, role_family").in("id", templateIds) : { data: [] },
    employeeIds.length ? supabase.from("employees").select("employee_id, full_name, job_title").in("employee_id", employeeIds) : { data: [] },
  ]);
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));
  const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));
  const asgById = new Map((ratedAssignments ?? []).map((a) => [a.id, a]));

  const ratingTasks = (raterRows ?? [])
    .map((r) => ({ rater: r, assignment: asgById.get(r.assignment_id) }))
    .filter((x) => x.assignment && x.assignment.status !== "closed");

  return (
    <>
      <PageHeader
        title="Assessments"
        description="Training-needs diagnostics. Results are used for development planning only, never for title, promotion or disciplinary decisions."
        actions={
          role !== "employee" ? (
            <>
              <Link href="/assessments/results" className={buttonVariants({ variant: "outline" })}>
                Results
              </Link>
              {role !== "executive" && (
                <Link href="/assessments/assign" className={buttonVariants()}>
                  Assign
                </Link>
              )}
            </>
          ) : null
        }
      />

      {error?.code === "42P01" && (
        <Card className="mb-6 border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Assessment tables are missing. Run scripts/migration-assessments.sql in Supabase.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" /> My assessments
            </CardTitle>
            <CardDescription>Rate yourself honestly and answer each scenario. Your self-rating carries 10% of the score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(mine ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing assigned to you yet.</p>}
            {(mine ?? []).map((a) => {
              const tpl = tplById.get(a.template_id);
              const done = a.status === "submitted" || a.status === "closed";
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{tpl?.role_family ?? tpl?.name ?? "Assessment"}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="capitalize">{tpl?.kind}</span>
                      {a.wave ? ` · ${a.wave}` : ""}
                      {a.due_date ? ` · due ${formatDate(a.due_date)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(STATUS_STYLE[a.status])}>
                      {a.status.replace("_", " ")}
                    </Badge>
                    {!done && (
                      <Link href={`/assessments/${a.id}/take`} className={buttonVariants({ size: "sm" })}>
                        {a.status === "in_progress" ? "Continue" : "Start"}
                      </Link>
                    )}
                    {done && a.results_released && (
                      <Link href={`/assessments/${a.id}/report`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        View report
                      </Link>
                    )}
                    {done && !a.results_released && (
                      <span className="text-xs text-muted-foreground">Results shared by your manager</span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" /> Rating requests
            </CardTitle>
            <CardDescription>
              Use the full scale and choose &quot;Not observed&quot; honestly. Your individual ratings are never shown to the person.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ratingTasks.length === 0 && <p className="text-sm text-muted-foreground">No rating requests.</p>}
            {ratingTasks.map(({ rater, assignment }) => {
              const tpl = tplById.get(assignment!.template_id);
              const emp = empById.get(assignment!.employee_id);
              return (
                <div key={rater.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                  <div>
                    <div className="font-medium">{emp?.full_name ?? assignment!.employee_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {tpl?.role_family ?? tpl?.name} · as {RATER_LABEL[rater.rater_type]}
                      {assignment!.due_date ? ` · due ${formatDate(assignment!.due_date)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(STATUS_STYLE[rater.status])}>
                      {rater.status}
                    </Badge>
                    {rater.status === "pending" && (
                      <Link href={`/assessments/rate/${rater.id}`} className={buttonVariants({ size: "sm" })}>
                        Rate
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

const RATER_LABEL: Record<string, string> = {
  line_manager: "line manager",
  cross_dept: "cross-departmental rater",
  peer: "peer",
  self: "self",
};
