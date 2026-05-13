import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiFormSection } from "./kpi-form-section";

export default async function CycleKpisPage({
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

  if (!profile || (profile.role !== "admin" && profile.role !== "executive")) {
    redirect("/cycles");
  }

  const { data: cycle } = await supabase
    .from("appraisal_cycles")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!cycle) notFound();

  const { data: kpis } = await supabase
    .from("org_kpis")
    .select("*")
    .eq("cycle_id", id)
    .order("created_at", { ascending: true });

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");

  const levelColors: Record<string, string> = {
    organization: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
    department: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    team: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  };

  return (
    <>
      <PageHeader
        title={`KPIs — ${cycle.name}`}
        description="Define organization, department, and team-level KPIs for this cycle."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!kpis || kpis.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No KPIs defined yet. Use the form to add your first KPI.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {kpis.map((k) => (
                <Card key={k.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium">{k.title}</h4>
                        {k.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground">{k.description}</p>
                        )}
                        {k.target_value && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Target: {k.target_value}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {k.weight}%
                        </span>
                        <Badge variant="outline" className={`border-0 ${levelColors[k.level] ?? ""}`}>
                          {k.level}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <KpiFormSection
            cycleId={id}
            departments={departments ?? []}
          />
        </div>
      </div>
    </>
  );
}
