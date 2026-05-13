import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CycleStatusBadge } from "@/components/cycles/cycle-status-badge";
import { CycleAdvanceButton } from "./advance-button";
import { CYCLE_TYPE_LABELS, CYCLE_STATUSES } from "@/lib/constants/roles";
import type { CycleStatus, CycleType } from "@/lib/constants/roles";
import { CalendarDays, Target, Users } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function CycleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "employee";

  const { data: cycle } = await supabase
    .from("appraisal_cycles")
    .select("*")
    .eq("id", id)
    .single();

  if (!cycle) notFound();

  // Get objective stats for this cycle
  const { data: objectives } = await supabase
    .from("cycle_objectives")
    .select("status")
    .eq("cycle_id", id);

  const objStats = {
    total: objectives?.length ?? 0,
    draft: objectives?.filter((o) => o.status === "draft").length ?? 0,
    submitted: objectives?.filter((o) => o.status === "submitted").length ?? 0,
    approved: objectives?.filter((o) => o.status === "approved").length ?? 0,
    revision_requested: objectives?.filter((o) => o.status === "revision_requested").length ?? 0,
    rejected: objectives?.filter((o) => o.status === "rejected").length ?? 0,
  };

  // Get KPI count
  const { count: kpiCount } = await supabase
    .from("org_kpis")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", id);

  const currentStatusIdx = CYCLE_STATUSES.indexOf(cycle.status as CycleStatus);
  const nextStatus = currentStatusIdx < CYCLE_STATUSES.length - 1
    ? CYCLE_STATUSES[currentStatusIdx + 1]
    : null;

  const deadlines = [
    { label: "Objective Deadline", date: cycle.objective_deadline },
    { label: "Self-Assessment", date: cycle.self_assessment_deadline },
    { label: "Manager Assessment", date: cycle.manager_assessment_deadline },
    { label: "Calibration", date: cycle.calibration_deadline },
  ].filter((d) => d.date);

  return (
    <>
      <PageHeader
        title={cycle.name}
        description={`${CYCLE_TYPE_LABELS[cycle.type as CycleType] ?? cycle.type} cycle`}
        actions={
          <div className="flex items-center gap-2">
            <CycleStatusBadge status={cycle.status as CycleStatus} />
            {role === "admin" && (
              <Link href={`/cycles/${id}/kpis`} className={buttonVariants({ variant: "outline" })}>
                <Target className="mr-1.5 h-3.5 w-3.5" /> KPIs ({kpiCount ?? 0})
              </Link>
            )}
          </div>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" /> Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start</span>
              <span className="font-medium">{new Date(cycle.start_date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">End</span>
              <span className="font-medium">{new Date(cycle.end_date).toLocaleDateString()}</span>
            </div>
            {deadlines.map((d) => (
              <div key={d.label} className="flex justify-between">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-medium">
                  {new Date(d.date!).toLocaleDateString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Objective Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" /> Objectives
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">{objStats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Approved</span>
              <span className="font-semibold text-emerald-600">{objStats.approved}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending Review</span>
              <span className="font-semibold text-blue-600">{objStats.submitted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revision Requested</span>
              <span className="font-semibold text-amber-600">{objStats.revision_requested}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Drafts</span>
              <span className="font-semibold text-slate-500">{objStats.draft}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status Progression */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Cycle Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {CYCLE_STATUSES.map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                    i < currentStatusIdx
                      ? "text-muted-foreground line-through"
                      : i === currentStatusIdx
                        ? "bg-accent font-medium"
                        : "text-muted-foreground/50"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${
                    i < currentStatusIdx
                      ? "bg-emerald-500"
                      : i === currentStatusIdx
                        ? "bg-blue-500"
                        : "bg-muted"
                  }`} />
                  {s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </div>
              ))}
            </div>

            {role === "admin" && nextStatus && (
              <div className="mt-4 border-t pt-4">
                <CycleAdvanceButton cycleId={id} nextStatus={nextStatus} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
