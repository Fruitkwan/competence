import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ObjectiveForm } from "@/components/objectives/objective-form";
import { SubmitObjectivesButton } from "./submit-button";
import { DeleteObjectiveButton } from "./delete-button";
import { OBJECTIVE_STATUS_LABELS, type ObjectiveStatus } from "@/lib/constants/roles";
import { cn } from "@/lib/utils";
import { Target } from "lucide-react";

const statusColor: Record<ObjectiveStatus, string> = {
  draft: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  revision_requested: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default async function ObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const { cycle: selectedCycleId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get available cycles (only open ones)
  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("id, name, status")
    .in("status", ["draft", "objective_setting", "assessment"])
    .order("start_date", { ascending: false });

  // Default to the first cycle in objective_setting, or just the first one
  const activeCycle = cycles?.find((c) => c.id === selectedCycleId)
    ?? cycles?.find((c) => c.status === "objective_setting")
    ?? cycles?.[0];

  // Get objectives for this cycle
  type ObjectiveRow = {
    id: string;
    cycle_id: string;
    employee_id: string;
    kpi_id: string | null;
    title: string;
    description: string | null;
    success_criteria: string | null;
    weight: number;
    status: string;
    approved_by: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
    objective_comments?: { id: string; body: string; created_at: string; author_id: string }[];
  };

  let objectives: ObjectiveRow[] | null = null;
  if (activeCycle) {
    const { data } = await supabase
      .from("cycle_objectives")
      .select("*")
      .eq("cycle_id", activeCycle.id)
      .eq("employee_id", user!.id)
      .order("created_at", { ascending: true });
    objectives = data as ObjectiveRow[] | null;

    // Fetch comments separately
    if (objectives && objectives.length > 0) {
      const objIds = objectives.map((o) => o.id);
      const { data: comments } = await supabase
        .from("objective_comments")
        .select("id, body, created_at, author_id, objective_id")
        .in("objective_id", objIds);

      if (comments) {
        for (const o of objectives) {
          o.objective_comments = comments.filter(
            (c) => (c as unknown as { objective_id: string }).objective_id === o.id
          );
        }
      }
    }
  }

  // Get KPIs for the cycle (for the form)
  const { data: kpis } = activeCycle
    ? await supabase
        .from("org_kpis")
        .select("id, title, level")
        .eq("cycle_id", activeCycle.id)
    : { data: null };

  const totalWeight = objectives?.reduce((sum, o) => sum + Number(o.weight), 0) ?? 0;
  const hasDrafts = objectives?.some((o) => o.status === "draft" || o.status === "revision_requested");
  const canEdit = activeCycle?.status === "objective_setting" || activeCycle?.status === "draft";

  return (
    <>
      <PageHeader
        title="My Objectives"
        description="Draft and submit your performance objectives for the current cycle."
      />

      {!activeCycle ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-medium">No active cycle</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              There are no appraisal cycles open for objective setting.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Cycle selector */}
          {cycles && cycles.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Cycle:</span>
              <form>
                <Select name="cycle" defaultValue={activeCycle.id}>
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cycles.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </form>
            </div>
          )}

          {/* Weight summary */}
          <div className="flex items-center gap-4 text-sm">
            <div>
              Total Weight:{" "}
              <span className={cn("font-bold", totalWeight === 100 ? "text-emerald-600" : "text-amber-600")}>
                {totalWeight}%
              </span>
              <span className="text-muted-foreground"> / 100%</span>
            </div>
            <div className="text-muted-foreground">
              {objectives?.length ?? 0} objective{objectives?.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Existing objectives */}
          {objectives && objectives.length > 0 && (
            <div className="space-y-3">
              {objectives.map((o) => (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{o.title}</h4>
                        {o.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground">{o.description}</p>
                        )}
                        {o.success_criteria && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-medium">Success:</span> {o.success_criteria}
                          </p>
                        )}
                        {/* Show comments if any */}
                        {o.objective_comments && o.objective_comments.length > 0 && (
                          <div className="mt-2 rounded bg-muted/50 p-2 text-sm">
                            {o.objective_comments.map((c: { id: string; body: string; created_at: string }) => (
                              <p key={c.id} className="text-muted-foreground">
                                💬 {c.body}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">{o.weight}%</span>
                        <Badge variant="outline" className={cn("border-0", statusColor[o.status as ObjectiveStatus])}>
                          {OBJECTIVE_STATUS_LABELS[o.status as ObjectiveStatus]}
                        </Badge>
                        {(o.status === "draft" || o.status === "revision_requested") && canEdit && (
                          <DeleteObjectiveButton objectiveId={o.id} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Submit button */}
          {hasDrafts && canEdit && totalWeight === 100 && (
            <SubmitObjectivesButton cycleId={activeCycle.id} />
          )}

          {/* Add new objective form */}
          {canEdit && (
            <div className="pt-2">
              <h3 className="mb-3 text-lg font-semibold">Add Objective</h3>
              <ObjectiveForm cycleId={activeCycle.id} kpis={kpis ?? []} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
