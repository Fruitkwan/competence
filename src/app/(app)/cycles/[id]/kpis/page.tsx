import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiFormSection } from "./kpi-form-section";
import { SeedKpisSection } from "./seed-kpis-section";

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

  const [{ data: roleProfiles }, { data: roleTemplates }] = await Promise.all([
    supabase
      .from("job_profiles")
      .select("title, department")
      .eq("active", true)
      .order("department")
      .order("title"),
    supabase
      .from("role_kpi_templates")
      .select("role_title")
      .eq("active", true),
  ]);

  const templateCounts = new Map<string, number>();
  for (const template of roleTemplates ?? []) {
    templateCounts.set(template.role_title, (templateCounts.get(template.role_title) ?? 0) + 1);
  }
  const roleOptions = (roleProfiles ?? [])
    .map((role) => ({
      title: role.title,
      department: role.department,
      template_count: templateCounts.get(role.title) ?? 0,
    }))
    .filter((role) => role.template_count > 0);

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
          <div className="space-y-4">
            <SeedKpisSection cycleId={id} roles={roleOptions} />
            <KpiFormSection
              cycleId={id}
              departments={departments ?? []}
            />
          </div>
        </div>
      </div>
    </>
  );
}
