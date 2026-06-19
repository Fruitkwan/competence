import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatPct, priorityColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookOpen, ClipboardCheck, Target, Bell, AlertTriangle } from "lucide-react";
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

type EmployeeProfileRow = {
  employee_id: string;
  full_name: string;
  job_title: string | null;
  department?: string | null;
  country_code: string | null;
  manager_name: string | null;
};

type EmployeeCourseSummaryRow = {
  id: string;
  status: "Enrolled" | "In Progress" | "Completed" | "Dropped";
  enrolled_at: string;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  certificate_url: string | null;
  courses: {
    title: string;
    develops: string | null;
    link: string | null;
  } | null;
};

type ObjectiveSummaryRow = {
  id: string;
  title: string;
  status: "draft" | "submitted" | "revision_requested" | "approved" | "rejected";
  weight: number;
  updated_at: string;
  appraisal_cycles: {
    name: string;
    status: string;
  } | null;
};

type PerformanceSummaryRow = {
  id: string;
  appraisal_period: string | null;
  appraisal_type: string | null;
  status: "Draft" | "N1 Complete" | "N2 Complete" | "Final" | "Archived";
  total_weighted_score: number | null;
  final_rating: number | null;
  overall_label: string | null;
  employee_signed_at: string | null;
  manager_signed_at: string | null;
  hr_signed_at: string | null;
  updated_at: string;
};

type SkillGapSummaryRow = {
  id: string;
  competency_name: string;
  section: string;
  gap: number | null;
  severity: "low" | "medium" | "high" | null;
  recommended_action: string | null;
  created_at: string;
};

type NotificationSummaryRow = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
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
  const isManager = role === "manager";

  if (isEmployee) {
    const employeeFilter = employeeId ?? "";
    const [
      { data: employee },
      { data: latestAppraisal },
      { data: employeeCourses },
      { data: objectives },
      { data: performanceAppraisals },
      { data: skillGaps },
      { data: notifications },
    ] = await Promise.all([
      supabase
        .from("employees")
        .select("employee_id, full_name, job_title, department, country_code, manager_name")
        .eq("employee_id", employeeFilter)
        .maybeSingle(),
      supabase
        .from("appraisal_full")
        .select("id,employee_id,priority,gap,current_avg,cluster,country_code,status,overdue")
        .eq("employee_id", employeeFilter)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("employee_courses")
        .select("id, status, enrolled_at, started_at, completed_at, score, certificate_url, courses(title, develops, link)")
        .eq("employee_id", employeeFilter)
        .order("enrolled_at", { ascending: false })
        .limit(5),
      supabase
        .from("cycle_objectives")
        .select("id, title, status, weight, updated_at, appraisal_cycles(name, status)")
        .eq("employee_id", user?.id ?? "")
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("performance_appraisals")
        .select(
          "id, appraisal_period, appraisal_type, status, total_weighted_score, final_rating, overall_label, employee_signed_at, manager_signed_at, hr_signed_at, updated_at"
        )
        .eq("employee_id", employeeFilter)
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("skill_gaps")
        .select("id, competency_name, section, gap, severity, recommended_action, created_at")
        .eq("employee_id", employeeFilter)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("notifications")
        .select("id, title, body, link, read, created_at")
        .eq("user_id", user?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return (
      <EmployeeDashboard
        employee={employee as EmployeeProfileRow | null}
        userName={userName}
        employeeId={employeeId}
        latestAppraisal={latestAppraisal as AppraisalFullRow | null}
        courses={(employeeCourses ?? []) as unknown as EmployeeCourseSummaryRow[]}
        objectives={(objectives ?? []) as unknown as ObjectiveSummaryRow[]}
        performanceAppraisals={(performanceAppraisals ?? []) as PerformanceSummaryRow[]}
        skillGaps={(skillGaps ?? []) as SkillGapSummaryRow[]}
        notifications={(notifications ?? []) as NotificationSummaryRow[]}
      />
    );
  }

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
  const allLatest = Array.from(byEmp.values());
  const allEmployeeRows = (employees ?? []) as EmployeeDirectoryRow[];
  const employeeById = new Map(allEmployeeRows.map((employee) => [employee.employee_id, employee]));

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
  const managerDepartmentName = isManager && employeeId
    ? userDepartmentName ?? cleanDepartment(userCluster) ?? departmentForEmployee(employeeId)
    : null;
  const employeeRows = managerDepartmentName
    ? allEmployeeRows.filter((employee) => departmentForEmployee(employee.employee_id) === managerDepartmentName)
    : allEmployeeRows;
  const employeeIds = new Set(employeeRows.map((employee) => employee.employee_id));
  const latest = managerDepartmentName
    ? allLatest.filter((row) => employeeIds.has(row.employee_id) || departmentForEmployee(row.employee_id, row) === managerDepartmentName)
    : allLatest;
  const latestByEmployeeId = new Map(latest.map((r) => [r.employee_id, r]));
  const total = latest.length;
  const high = latest.filter((r) => r.priority === "HIGH").length;
  const medium = latest.filter((r) => r.priority === "MEDIUM").length;
  const low = latest.filter((r) => r.priority === "LOW").length;
  const overdue = latest.filter((r) => r.overdue).length;
  const completed = latest.filter((r) => r.status === "Completed").length;
  const completion = total > 0 ? completed / total : 0;
  const seededDepartmentNames = isEmployee || managerDepartmentName
    ? [managerDepartmentName ?? userDepartmentName ?? userCluster ?? (employeeId ? departmentForEmployee(employeeId) : null)].filter(
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

function EmployeeDashboard({
  employee,
  userName,
  employeeId,
  latestAppraisal,
  courses,
  objectives,
  performanceAppraisals,
  skillGaps,
  notifications,
}: {
  employee: EmployeeProfileRow | null;
  userName: string;
  employeeId: string | null;
  latestAppraisal: AppraisalFullRow | null;
  courses: EmployeeCourseSummaryRow[];
  objectives: ObjectiveSummaryRow[];
  performanceAppraisals: PerformanceSummaryRow[];
  skillGaps: SkillGapSummaryRow[];
  notifications: NotificationSummaryRow[];
}) {
  const displayName = employee?.full_name ?? userName ?? "Employee";
  const activeCourses = courses.filter((course) => !["Completed", "Dropped"].includes(course.status));
  const completedCourses = courses.filter((course) => course.status === "Completed");
  const objectivesNeedingWork = objectives.filter((objective) =>
    ["draft", "revision_requested"].includes(objective.status)
  );
  const unreadNotifications = notifications.filter((notification) => !notification.read);
  const highSkillGaps = skillGaps.filter((gap) => gap.severity === "high");
  const latestPerformance = performanceAppraisals[0] ?? null;

  return (
    <>
      <PageHeader
        title="My Dashboard"
        description={`${displayName}${employeeId ? ` (${employeeId})` : ""}`}
      />

      {!employeeId ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <h2 className="font-semibold">Employee profile is not linked</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This account does not have an employee ID in the user profile.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <EmployeeStatCard label="Active courses" value={activeCourses.length.toString()} icon={BookOpen} tone="blue" />
            <EmployeeStatCard label="Completed" value={completedCourses.length.toString()} icon={ClipboardCheck} tone="green" />
            <EmployeeStatCard label="Objectives" value={objectivesNeedingWork.length.toString()} icon={Target} tone="amber" />
            <EmployeeStatCard label="High gaps" value={highSkillGaps.length.toString()} icon={AlertTriangle} tone="red" />
            <EmployeeStatCard label="Unread" value={unreadNotifications.length.toString()} icon={Bell} tone="neutral" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Next actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <ActionRow
                    title={activeCourses[0]?.courses?.title ?? "No active course"}
                    detail={
                      activeCourses[0]
                        ? `${activeCourses[0].status} since ${fmtShortDate(activeCourses[0].enrolled_at)}`
                        : "Assigned courses will appear here."
                    }
                    href="/training/my-courses"
                    label="Courses"
                  />
                  <ActionRow
                    title={
                      objectivesNeedingWork[0]?.title ??
                      (objectives.length ? "Objectives submitted" : "No objectives started")
                    }
                    detail={
                      objectivesNeedingWork[0]
                        ? objectiveStatusLabel(objectivesNeedingWork[0].status)
                        : objectives.length
                          ? `${objectives.length} objective${objectives.length === 1 ? "" : "s"} on record`
                          : "Draft objectives will appear here."
                    }
                    href="/objectives"
                    label="Objectives"
                  />
                  <ActionRow
                    title={latestPerformance?.appraisal_period ?? "No performance appraisal"}
                    detail={
                      latestPerformance
                        ? `${latestPerformance.status}${latestPerformance.employee_signed_at ? " - signed" : " - signature pending"}`
                        : "Performance records will appear here."
                    }
                    href="/appraisals/performance"
                    label="Performance"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <ProfileRow label="Job title" value={employee?.job_title} />
                  <ProfileRow label="Department" value={employee?.department} />
                  <ProfileRow label="Country" value={employee?.country_code} />
                  <ProfileRow label="Manager" value={employee?.manager_name} />
                  <ProfileRow
                    label="Latest score"
                    value={latestAppraisal ? Number(latestAppraisal.current_avg).toFixed(2) : null}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <CourseList courses={courses} />
            <ObjectiveList objectives={objectives} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <PerformanceList appraisals={performanceAppraisals} latestAppraisal={latestAppraisal} />
            <SkillGapList gaps={skillGaps} />
          </div>

          <NotificationList notifications={notifications} />
        </div>
      )}
    </>
  );
}

function EmployeeStatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "neutral" | "red" | "amber" | "green" | "blue";
}) {
  const toneClass = {
    neutral: "text-foreground",
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    green: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
  }[tone];

  return (
    <Card>
      <CardContent className="flex min-h-24 items-center gap-3 p-4">
        <Icon className={cn("h-7 w-7", toneClass)} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn("mt-1 text-2xl font-semibold", toneClass)}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRow({
  title,
  detail,
  href,
  label,
}: {
  title: string;
  detail: string;
  href: string;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border p-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
      </div>
      <Link href={href} className={buttonVariants({ variant: "outline", size: "sm" })}>
        {label}
      </Link>
    </div>
  );
}

function CourseList({ courses }: { courses: EmployeeCourseSummaryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My courses</CardTitle>
      </CardHeader>
      <CardContent>
        {courses.length ? (
          <div className="space-y-3">
            {courses.map((course) => (
              <div key={course.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{course.courses?.title ?? "Untitled course"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">Enrolled {fmtShortDate(course.enrolled_at)}</div>
                </div>
                <Badge variant="outline" className={courseStatusClass(course.status)}>
                  {course.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock text="No assigned courses." />
        )}
      </CardContent>
    </Card>
  );
}

function ObjectiveList({ objectives }: { objectives: ObjectiveSummaryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My objectives</CardTitle>
      </CardHeader>
      <CardContent>
        {objectives.length ? (
          <div className="space-y-3">
            {objectives.map((objective) => (
              <div key={objective.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{objective.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {objective.appraisal_cycles?.name ?? "Cycle"} - {objective.weight}%
                  </div>
                </div>
                <Badge variant="outline" className={objectiveStatusClass(objective.status)}>
                  {objectiveStatusLabel(objective.status)}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock text="No objectives recorded." />
        )}
      </CardContent>
    </Card>
  );
}

function PerformanceList({
  appraisals,
  latestAppraisal,
}: {
  appraisals: PerformanceSummaryRow[];
  latestAppraisal: AppraisalFullRow | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
      </CardHeader>
      <CardContent>
        {latestAppraisal && (
          <div className="mb-4 rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium">Latest competency score</span>
              <Badge variant="outline" className={priorityColor[latestAppraisal.priority]}>
                {latestAppraisal.priority}
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-muted-foreground">
              <Metric label="Score" value={Number(latestAppraisal.current_avg).toFixed(2)} />
              <Metric label="Gap" value={Number(latestAppraisal.gap).toFixed(2)} />
              <Metric label="Status" value={latestAppraisal.status} />
            </div>
          </div>
        )}

        {appraisals.length ? (
          <div className="space-y-3">
            {appraisals.map((appraisal) => (
              <div key={appraisal.id} className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/appraisals/performance/${appraisal.id}`} className="truncate text-sm font-medium hover:underline">
                    {appraisal.appraisal_period ?? appraisal.appraisal_type ?? "Performance appraisal"}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Updated {fmtShortDate(appraisal.updated_at)}
                  </div>
                </div>
                <Badge variant="outline">{appraisal.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock text="No performance appraisals recorded." />
        )}
      </CardContent>
    </Card>
  );
}

function SkillGapList({ gaps }: { gaps: SkillGapSummaryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Skill gaps</CardTitle>
      </CardHeader>
      <CardContent>
        {gaps.length ? (
          <div className="space-y-3">
            {gaps.map((gap) => (
              <div key={gap.id} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{gap.competency_name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{gap.section}</div>
                  </div>
                  <Badge variant="outline" className={skillGapClass(gap.severity)}>
                    {gap.severity ?? "gap"}
                  </Badge>
                </div>
                {gap.recommended_action && (
                  <p className="mt-2 text-xs text-muted-foreground">{gap.recommended_action}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyBlock text="No skill gaps recorded." />
        )}
      </CardContent>
    </Card>
  );
}

function NotificationList({ notifications }: { notifications: NotificationSummaryRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent notifications</CardTitle>
      </CardHeader>
      <CardContent>
        {notifications.length ? (
          <div className="space-y-3">
            {notifications.map((notification) => {
              const content = (
                <div className={cn("rounded-md border p-3", !notification.read && "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{notification.title}</div>
                      {notification.body && <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtShortDate(notification.created_at)}</span>
                  </div>
                </div>
              );

              return notification.link ? (
                <Link key={notification.id} href={notification.link} className="block">
                  {content}
                </Link>
              ) : (
                <div key={notification.id}>{content}</div>
              );
            })}
          </div>
        ) : (
          <EmptyBlock text="No notifications." />
        )}
      </CardContent>
    </Card>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value?.trim() || "-"}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="uppercase tracking-wide">{label}</div>
      <div className="mt-1 font-semibold text-foreground">{value}</div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

function courseStatusClass(status: EmployeeCourseSummaryRow["status"]) {
  return {
    Completed: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    "In Progress": "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    Enrolled: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    Dropped: "border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  }[status];
}

function objectiveStatusClass(status: ObjectiveSummaryRow["status"]) {
  return {
    draft: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300",
    submitted: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    revision_requested: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    rejected: "border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  }[status];
}

function objectiveStatusLabel(status: ObjectiveSummaryRow["status"]) {
  return {
    draft: "Draft",
    submitted: "Submitted",
    revision_requested: "Revision",
    approved: "Approved",
    rejected: "Rejected",
  }[status];
}

function skillGapClass(severity: SkillGapSummaryRow["severity"]) {
  if (severity === "high") return "border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  if (severity === "medium") return "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300";
}

function fmtShortDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
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
