import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Award, BookOpen, ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleTableRow } from "@/components/roles/role-table-row";
import { CreateRoleDialog } from "@/components/roles/role-edit-dialogs";
import { redirect } from "next/navigation";

export default async function RolesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };
  if (!userProfile || !["admin", "manager", "executive"].includes(userProfile.role)) redirect("/dashboard");

  const canEdit = userProfile?.role === "admin";

  const [
    { data: jobProfiles },
    { data: roles },
    { data: competencies },
    { data: kpis },
    { data: departments },
  ] = await Promise.all([
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
    supabase.from("departments").select("name").order("name"),
  ]);

  const departmentNames = [
    ...new Set([
      ...(departments ?? []).map((item) => item.name),
      ...(jobProfiles ?? []).map((profile) => profile.department),
    ]),
  ].sort((a, b) => a.localeCompare(b));

  const competencyCounts = countByRole(competencies ?? []);
  const kpiCounts = countByRole(kpis ?? []);
  const hasJobProfiles = Boolean(jobProfiles?.length);

  return (
    <>
      <PageHeader
        title="Role Benchmark Library"
        description="Browse job profiles, role competencies, and KPI templates imported from the Dhofar Global role documents."
        actions={
          canEdit && departmentNames.length > 0 ? (
            <CreateRoleDialog departments={departmentNames} />
          ) : canEdit ? (
            <CreateRoleDialog departments={["General"]} />
          ) : undefined
        }
      />

      {hasJobProfiles && (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={BookOpen}
            label="Job profiles"
            value={(jobProfiles ?? []).length}
            hint="Active roles in the library"
          />
          <MetricCard
            icon={Award}
            label="Competency links"
            value={competencies?.length ?? 0}
            hint="Mapped across all roles"
          />
          <MetricCard
            icon={Target}
            label="KPI templates"
            value={kpis?.length ?? 0}
            hint="Ready for cycle seeding"
          />
        </div>
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>{hasJobProfiles ? "Imported Role Profiles" : "Legacy Role Benchmarks"}</CardTitle>
          {hasJobProfiles && (
            <p className="text-sm text-muted-foreground">
              Click a row to open competencies, KPIs, and the full job profile.
            </p>
          )}
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
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasJobProfiles
                ? (jobProfiles ?? []).map((profile) => {
                    const competencyCount = competencyCounts.get(profile.title) ?? 0;
                    const kpiCount = kpiCounts.get(profile.title) ?? 0;
                    const href = `/roles/${encodeURIComponent(profile.title)}?tab=competencies`;

                    return (
                      <RoleTableRow key={profile.title} href={href}>
                        <TableCell>
                          <div className="font-medium">{profile.title}</div>
                          {profile.role_purpose && (
                            <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-muted-foreground">
                              {profile.role_purpose}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{profile.department}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {profile.reports_to ?? "—"}
                        </TableCell>
                        <TableCell>
                          <CountBadge count={competencyCount} />
                        </TableCell>
                        <TableCell>
                          <CountBadge count={kpiCount} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </TableCell>
                      </RoleTableRow>
                    );
                  })
                : roles?.map((r) => (
                    <TableRow key={r.title}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.cluster}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">—</TableCell>
                      <TableCell>{r.required_level}</TableCell>
                      <TableCell className="text-muted-foreground">{r.kpi_linked ?? "—"}</TableCell>
                      <TableCell />
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

function CountBadge({ count }: { count: number }) {
  return (
    <Badge
      variant={count > 0 ? "secondary" : "outline"}
      className={cn("min-w-8 justify-center tabular-nums", count === 0 && "text-muted-foreground")}
    >
      {count}
    </Badge>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}
