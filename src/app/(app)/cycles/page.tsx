import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CycleStatusBadge } from "@/components/cycles/cycle-status-badge";
import { CYCLE_TYPE_LABELS } from "@/lib/constants/roles";
import type { CycleStatus, CycleType } from "@/lib/constants/roles";
import { CalendarDays, ArrowRight } from "lucide-react";

export default async function CyclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const role = profile?.role ?? "employee";

  const { data: cycles } = await supabase
    .from("appraisal_cycles")
    .select("*")
    .order("start_date", { ascending: false });

  return (
    <>
      <PageHeader
        title="Appraisal Cycles"
        description="Manage performance appraisal cycles and timelines."
        actions={
          role === "admin" ? (
            <Link href="/cycles/new" className={buttonVariants()}>
              Create Cycle
            </Link>
          ) : undefined
        }
      />

      {!cycles || cycles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-medium">No cycles yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {role === "admin"
                ? "Create your first appraisal cycle to get started."
                : "No appraisal cycles have been created yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cycles.map((c) => (
            <Link key={c.id} href={`/cycles/${c.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{c.name}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {CYCLE_TYPE_LABELS[c.type as CycleType] ?? c.type}
                      </p>
                    </div>
                    <CycleStatusBadge status={c.status as CycleStatus} />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>
                      {new Date(c.start_date).toLocaleDateString()} –{" "}
                      {new Date(c.end_date).toLocaleDateString()}
                    </span>
                  </div>
                  {c.objective_deadline && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Objectives due:{" "}
                      {new Date(c.objective_deadline).toLocaleDateString()}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-end text-xs font-medium text-muted-foreground">
                    View details <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
