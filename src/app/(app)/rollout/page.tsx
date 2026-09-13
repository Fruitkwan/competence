import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatDate, statusColor } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function RolloutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "manager"].includes(profile.role)) redirect("/dashboard");

  const { data: tasks } = await supabase
    .from("rollout_tasks")
    .select("*")
    .order("sort_order");

  const byPhase = new Map<number, typeof tasks>();
  (tasks ?? []).forEach((t) => {
    if (!byPhase.has(t.phase)) byPhase.set(t.phase, []);
    byPhase.get(t.phase)!.push(t);
  });

  const today = new Date();

  return (
    <>
      <PageHeader
        title="Rollout Plan"
        description="Phased implementation calendar."
      />

      <div className="space-y-6">
        {[...byPhase.entries()]
          .sort(([a], [b]) => a - b)
          .map(([phase, items]) => (
            <Card key={phase}>
              <CardHeader>
                <CardTitle>
                  Phase {phase} — {items?.[0]?.phase_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {items?.map((t) => {
                    const target = t.target_date ? new Date(t.target_date) : null;
                    const daysLeft = target
                      ? Math.ceil(
                          (target.getTime() - today.getTime()) / 86_400_000
                        )
                      : null;
                    return (
                      <div
                        key={t.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="min-w-[200px] flex-1">
                          <div className="font-medium">{t.action}</div>
                          <div className="text-xs text-muted-foreground">
                            {t.responsible} · {t.tool_notes ?? ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{formatDate(t.target_date)}</div>
                          {daysLeft != null && (
                            <div className="text-xs text-muted-foreground">
                              {daysLeft >= 0
                                ? `in ${daysLeft} days`
                                : `${-daysLeft} days ago`}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={statusColor[t.status]}>
                          {t.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>
    </>
  );
}
