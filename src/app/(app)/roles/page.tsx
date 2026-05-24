import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function RolesPage() {
  const supabase = await createClient();
  const [{ data: jobProfiles }, { data: roles }, { data: competencies }, { data: kpis }] = await Promise.all([
    supabase
      .from("job_profiles")
      .select("title, department, reports_to, role_purpose, active")
      .eq("active", true)
      .order("department")
      .order("title"),
    supabase
      .from("roles")
      .select("title, cluster, kpi_linked, required_level, notes")
      .eq("active", true)
      .order("cluster")
      .order("title"),
    supabase.from("role_competencies").select("role_title"),
    supabase.from("role_kpi_templates").select("role_title").eq("active", true),
  ]);

  const competencyCounts = countByRole(competencies ?? []);
  const kpiCounts = countByRole(kpis ?? []);
  const hasJobProfiles = Boolean(jobProfiles?.length);

  return (
    <>
      <PageHeader
        title="Role Benchmark Library"
        description="Job profiles, role-specific competencies, and KPI templates imported from the Dhofar Global role documents."
      />

      {hasJobProfiles && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <MetricCard label="Job profiles" value={(jobProfiles ?? []).length} />
          <MetricCard label="Competency links" value={competencies?.length ?? 0} />
          <MetricCard label="KPI templates" value={kpis?.length ?? 0} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{hasJobProfiles ? "Imported Role Profiles" : "Legacy Role Benchmarks"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role / Job Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Reports To</TableHead>
                <TableHead>Competencies</TableHead>
                <TableHead>KPIs</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasJobProfiles
                ? (jobProfiles ?? []).map((profile) => (
                    <TableRow key={profile.title}>
                      <TableCell className="font-medium">{profile.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{profile.department}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{profile.reports_to ?? "—"}</TableCell>
                      <TableCell>{competencyCounts.get(profile.title) ?? 0}</TableCell>
                      <TableCell>{kpiCounts.get(profile.title) ?? 0}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/roles/${encodeURIComponent(profile.title)}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                : roles?.map((r) => (
                    <TableRow key={r.title}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.cluster}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell>{r.required_level}</TableCell>
                      <TableCell className="text-muted-foreground">{r.kpi_linked ?? "—"}</TableCell>
                      <TableCell className="text-right text-muted-foreground">Import docs to view</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function countByRole(rows: { role_title: string }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.role_title, (counts.get(row.role_title) ?? 0) + 1);
  }
  return counts;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
