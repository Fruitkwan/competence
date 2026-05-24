import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function RoleDetailPage({
  params,
}: {
  params: Promise<{ title: string }>;
}) {
  const { title: encodedTitle } = await params;
  const title = decodeURIComponent(encodedTitle);
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("job_profiles")
    .select("*")
    .eq("title", title)
    .single();

  if (!profile) notFound();

  const [{ data: roleCompetencies }, { data: kpis }] = await Promise.all([
    supabase
      .from("role_competencies")
      .select("competency_id, category, required_level, weight, sort_order")
      .eq("role_title", title)
      .eq("applicable", true)
      .order("sort_order"),
    supabase
      .from("role_kpi_templates")
      .select("title, measure, target, review_frequency, default_weight, sort_order")
      .eq("role_title", title)
      .eq("active", true)
      .order("sort_order"),
  ]);

  const competencyIds = roleCompetencies?.map((item) => item.competency_id) ?? [];
  const { data: competencies } = competencyIds.length
    ? await supabase
        .from("competencies")
        .select("id, name, description, behavioral_indicators")
        .in("id", competencyIds)
    : { data: [] };

  const competencyById = new Map((competencies ?? []).map((item) => [item.id, item]));

  return (
    <>
      <div className="mb-4">
        <Link href="/roles" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to roles
        </Link>
      </div>

      <PageHeader
        title={profile.title}
        description={profile.role_purpose ?? "Role benchmark details imported from the Dhofar Global documents."}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard label="Department" value={profile.department} />
        <InfoCard label="Reports To" value={profile.reports_to ?? "—"} />
        <InfoCard label="Geographic Scope" value={profile.geographic_scope ?? "—"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Role Competencies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {roleCompetencies?.length ? (
              roleCompetencies.map((link) => {
                const competency = competencyById.get(link.competency_id);
                return (
                  <div key={link.competency_id} className="rounded-lg border p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium">{competency?.name ?? "Unknown competency"}</h3>
                      <Badge variant="outline">{link.required_level ?? "Competent"}</Badge>
                    </div>
                    {competency?.description && (
                      <p className="text-sm text-muted-foreground">{competency.description}</p>
                    )}
                    {competency?.behavioral_indicators && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Indicator: {competency.behavioral_indicators}
                      </p>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No role competencies imported yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KPI Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KPI</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Frequency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis?.length ? (
                  kpis.map((kpi) => (
                    <TableRow key={kpi.title}>
                      <TableCell>
                        <div className="font-medium">{kpi.title}</div>
                        {kpi.measure && (
                          <div className="text-xs text-muted-foreground">{kpi.measure}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{kpi.target ?? "—"}</TableCell>
                      <TableCell>{kpi.review_frequency ?? "—"}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No KPI templates imported yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {(profile.responsibilities.length > 0 || Object.keys(profile.qualifications).length > 0) && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ListCard title="Responsibilities" items={profile.responsibilities} />
          <Card>
            <CardHeader>
              <CardTitle>Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {typeof profile.qualifications.experience === "string" && profile.qualifications.experience
                  ? profile.qualifications.experience
                  : "No detailed qualifications imported yet."}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 font-medium">{value}</div>
      </CardContent>
    </Card>
  );
}

function ListCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No details imported yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
