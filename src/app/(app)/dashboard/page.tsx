import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { formatPct, priorityColor } from "@/lib/format";
import { DashboardCharts } from "./charts";

type AppraisalFullRow = {
  id: string;
  employee_id: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  gap: number;
  current_avg: number;
  cluster: string;
  country_code: string | null;
  status: string;
  overdue: boolean;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type ProfileDepartmentRow = {
  employee_id: string | null;
  department_id: string | null;
  cluster: string | null;
};

type EmployeeDirectoryRow = {
  employee_id: string;
  job_title: string | null;
  department?: string | null;
  country_code: string | null;
};

type JobProfileRow = {
  title: string;
  department: string | null;
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Determine logged-in user's role and employee_id
  const { data: { user } } = await supabase.auth.getUser();
  let role = "employee";
  let employeeId: string | null = null;
  let userDepartmentId: string | null = null;
  let userCluster: string | null = null;
  let userName = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, employee_id, full_name, department_id, cluster")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? "employee";
    employeeId = profile?.employee_id ?? null;
    userDepartmentId = profile?.department_id ?? null;
    userCluster = profile?.cluster ?? null;
    userName = profile?.full_name ?? "";
  }

  const isEmployee = role === "employee";

  // Fetch appraisals — employees only see their own
  let query = supabase
    .from("appraisal_full")
    .select("id,employee_id,priority,gap,current_avg,cluster,country_code,status,overdue");
  if (isEmployee && employeeId) {
    query = query.eq("employee_id", employeeId);
  }
  let employeeQuery = supabase
    .from("employees")
    .select("*")
    .eq("active", true);
  if (isEmployee && employeeId) {
    employeeQuery = employeeQuery.eq("employee_id", employeeId);
  }
  const [{ data: rows }, { data: departments }, { data: profiles }, { data: employees }, { data: jobProfiles }] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("profiles").select("employee_id, department_id, cluster"),
    employeeQuery,
    supabase.from("job_profiles").select("title, department"),
  ]);

  const all = (rows ?? []) as AppraisalFullRow[];
  const byEmp = new Map<string, AppraisalFullRow>();
  for (const r of all) byEmp.set(r.employee_id, r);
  const latest = Array.from(byEmp.values());
  const latestByEmployeeId = new Map(latest.map((r) => [r.employee_id, r]));
  const employeeRows = (employees ?? []) as EmployeeDirectoryRow[];
  const employeeById = new Map(employeeRows.map((employee) => [employee.employee_id, employee]));
  const employeeIds = new Set(employeeRows.map((employee) => employee.employee_id));

  const total = latest.length;
  const high = latest.filter((r) => r.priority === "HIGH").length;
  const medium = latest.filter((r) => r.priority === "MEDIUM").length;
  const low = latest.filter((r) => r.priority === "LOW").length;
  const overdue = latest.filter((r) => r.overdue).length;
  const completed = latest.filter((r) => r.status === "Completed").length;
  const completion = total > 0 ? completed / total : 0;

  const departmentRows = (departments ?? []) as DepartmentRow[];
  const departmentNameById = new Map(departmentRows.map((d) => [d.id, d.name]));
  const profileByEmployeeId = new Map(
    ((profiles ?? []) as ProfileDepartmentRow[])
      .filter((p): p is ProfileDepartmentRow & { employee_id: string } => Boolean(p.employee_id))
      .map((p) => [p.employee_id, p])
  );
  const jobProfileDepartmentByTitle = new Map(
    ((jobProfiles ?? []) as JobProfileRow[])
      .filter((profile) => Boolean(profile.title && profile.department))
      .map((profile) => [profile.title, profile.department as string])
  );
  const userDepartmentName = userDepartmentId ? departmentNameById.get(userDepartmentId) : null;
  const seededDepartmentNames = isEmployee
    ? [userDepartmentName ?? userCluster ?? (employeeId ? departmentForEmployee(employeeId) : null)].filter(
        (name): name is string => Boolean(name)
      )
    : departmentRows.map((d) => d.name);

  const clusterMap = new Map<
    string,
    { count: number; assessed: number; sumScore: number; sumGap: number; high: number; medium: number; low: number }
  >();
  for (const name of seededDepartmentNames) {
    clusterMap.set(name, { count: 0, assessed: 0, sumScore: 0, sumGap: 0, high: 0, medium: 0, low: 0 });
  }
  for (const employee of employeeRows) {
    const k = departmentForEmployee(employee.employee_id);
    const c = clusterMap.get(k) ?? { count: 0, assessed: 0, sumScore: 0, sumGap: 0, high: 0, medium: 0, low: 0 };
    c.count++;
    clusterMap.set(k, c);
  }
  for (const r of latest) {
    const k = departmentForEmployee(r.employee_id, r);
    const c = clusterMap.get(k) ?? { count: 0, assessed: 0, sumScore: 0, sumGap: 0, high: 0, medium: 0, low: 0 };
    if (!employeeIds.has(r.employee_id)) c.count++;
    c.assessed++;
    c.sumScore += Number(r.current_avg ?? 0);
    c.sumGap += Number(r.gap ?? 0);
    if (r.priority === "HIGH") c.high++;
    else if (r.priority === "MEDIUM") c.medium++;
    else c.low++;
    clusterMap.set(k, c);
  }
  const clusterRows = Array.from(clusterMap.entries()).map(([name, c]) => ({
    name,
    count: c.count,
    avgScore: c.assessed ? c.sumScore / c.assessed : 0,
    avgGap: c.assessed ? c.sumGap / c.assessed : 0,
    high: c.high,
    medium: c.medium,
    low: c.low,
  }));

  const countryMap = new Map<
    string,
    { count: number; assessed: number; sumGap: number; high: number; completed: number }
  >();
  for (const employee of employeeRows) {
    const appraisal = latestByEmployeeId.get(employee.employee_id);
    const k = employee.country_code ?? appraisal?.country_code ?? "—";
    const c = countryMap.get(k) ?? { count: 0, assessed: 0, sumGap: 0, high: 0, completed: 0 };
    c.count++;
    if (appraisal) {
      c.assessed++;
      c.sumGap += Number(appraisal.gap ?? 0);
      if (appraisal.priority === "HIGH") c.high++;
      if (appraisal.status === "Completed") c.completed++;
    }
    countryMap.set(k, c);
  }
  for (const r of latest) {
    if (employeeIds.has(r.employee_id)) continue;
    const k = r.country_code ?? "—";
    const c = countryMap.get(k) ?? { count: 0, assessed: 0, sumGap: 0, high: 0, completed: 0 };
    c.count++;
    c.assessed++;
    c.sumGap += Number(r.gap ?? 0);
    if (r.priority === "HIGH") c.high++;
    if (r.status === "Completed") c.completed++;
    countryMap.set(k, c);
  }
  const countryRows = Array.from(countryMap.entries()).map(([name, c]) => ({
    name,
    count: c.count,
    avgGap: c.assessed ? c.sumGap / c.assessed : 0,
    high: c.high,
    completion: c.count ? c.completed / c.count : 0,
  }));

  function departmentForEmployee(employeeIdValue: string, appraisal?: AppraisalFullRow) {
    const employee = employeeById.get(employeeIdValue);
    const profile = profileByEmployeeId.get(employeeIdValue);
    return (
      cleanDepartment(employee?.department) ??
      (profile?.department_id ? departmentNameById.get(profile.department_id) : null) ??
      cleanDepartment(profile?.cluster) ??
      cleanDepartment(employee?.job_title ? jobProfileDepartmentByTitle.get(employee.job_title) : null) ??
      cleanDepartment(appraisal?.cluster) ??
      "-"
    );
  }

  return (
    <>
      <PageHeader
        title={isEmployee ? `My Dashboard` : "Dashboard"}
        description={
          isEmployee
            ? `Personal competency overview for ${userName || "you"}.`
            : "Live view of gaps, priorities, and training progress."
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Assessed" value={total.toString()} />
        <StatCard label="High priority" value={high.toString()} tone="red" />
        <StatCard label="Medium priority" value={medium.toString()} tone="amber" />
        <StatCard label="Completion" value={formatPct(completion)} tone="green" />
        <StatCard label="Overdue" value={overdue.toString()} tone={overdue ? "red" : "neutral"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Priority breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Priority</th>
                  <th className="pb-2 font-medium">Count</th>
                  <th className="pb-2 font-medium">% of Total</th>
                  <th className="pb-2 font-medium">Action window</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { p: "HIGH", n: high, w: "Immediate (≤ 30 days)" },
                  { p: "MEDIUM", n: medium, w: "Current quarter" },
                  { p: "LOW", n: low, w: "Self-directed" },
                ].map((r) => (
                  <tr key={r.p} className="border-t">
                    <td className="py-2">
                      <Badge variant="outline" className={priorityColor[r.p]}>
                        {r.p}
                      </Badge>
                    </td>
                    <td>{r.n}</td>
                    <td>{total ? formatPct(r.n / total) : "—"}</td>
                    <td className="text-muted-foreground">{r.w}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <DashboardCharts clusterRows={clusterRows} countryRows={countryRows} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By department</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2">Department</th>
                  <th className="pb-2">Emp.</th>
                  <th className="pb-2">Avg score</th>
                  <th className="pb-2">Avg gap</th>
                  <th className="pb-2">H</th>
                  <th className="pb-2">M</th>
                  <th className="pb-2">L</th>
                </tr>
              </thead>
              <tbody>
                {clusterRows.map((r) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td>{r.count}</td>
                    <td>{r.avgScore.toFixed(2)}</td>
                    <td>{r.avgGap.toFixed(2)}</td>
                    <td>{r.high}</td>
                    <td>{r.medium}</td>
                    <td>{r.low}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By country</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="pb-2">Country</th>
                  <th className="pb-2">Emp.</th>
                  <th className="pb-2">Avg gap</th>
                  <th className="pb-2">High</th>
                  <th className="pb-2">Completion</th>
                </tr>
              </thead>
              <tbody>
                {countryRows.map((r) => (
                  <tr key={r.name} className="border-t">
                    <td className="py-2 font-medium">{r.name}</td>
                    <td>{r.count}</td>
                    <td>{r.avgGap.toFixed(2)}</td>
                    <td>{r.high}</td>
                    <td>{formatPct(r.completion)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "red" | "amber" | "green";
}) {
  const toneClass = {
    neutral: "text-foreground",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-emerald-600 dark:text-emerald-400",
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function cleanDepartment(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
