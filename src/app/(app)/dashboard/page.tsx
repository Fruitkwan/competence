import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { formatPct, priorityColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardCheck, ClipboardList, Clock3, Target, UserCheck, UsersRound } from "lucide-react";
import { DashboardCharts } from "./charts";
import { CountUp } from "@/components/count-up";
import { CompanyHighlights } from "@/components/company/company-highlights";
import type { CompanyPost } from "@/lib/company-engagement";

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
  full_name: string;
  job_title: string | null;
  department?: string | null;
  country_code: string | null;
};

type AssessmentDashboardAssignment = {
  id: string;
  employee_id: string;
  status: string;
  due_date: string | null;
  created_at: string;
};

type AssessmentDashboardRater = {
  assignment_id: string;
  rater_type: "self" | "line_manager" | "cross_dept" | "peer";
  status: "pending" | "submitted";
};

type AssessmentProgressRow = {
  name: string;
  employees: number;
  assigned: number;
  submitted: number;
  pending: number;
  overdue: number;
  completion: number;
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
      { count: pendingAssessmentCount, error: pendingAssessmentCountError },
      { count: completedAssessmentCount, error: completedAssessmentCountError },
      { count: pendingPeerRatingCount, error: pendingPeerRatingCountError },
      { data: companyPosts },
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
      supabase
        .from("assessment_assignments")
        .select("id", { count: "exact", head: true })
        .or(employeeId
          ? `employee_user_id.eq.${user?.id},employee_id.eq.${employeeId}`
          : `employee_user_id.eq.${user?.id}`)
        .in("status", ["assigned", "in_progress"]),
      supabase
        .from("assessment_assignments")
        .select("id", { count: "exact", head: true })
        .or(employeeId
          ? `employee_user_id.eq.${user?.id},employee_id.eq.${employeeId}`
          : `employee_user_id.eq.${user?.id}`)
        .in("status", ["submitted", "closed"]),
      supabase
        .from("assessment_raters")
        .select("id", { count: "exact", head: true })
        .eq("rater_user_id", user?.id ?? "")
        .neq("rater_type", "self")
        .eq("status", "pending"),
      supabase
        .from("company_engagement_posts")
        .select("id, kind, title, summary, details, recipient_name, starts_on, ends_on, cta_label, cta_url, published, created_at, updated_at")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(12),
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
        pendingAssessmentCount={pendingAssessmentCountError ? null : pendingAssessmentCount ?? 0}
        completedAssessmentCount={completedAssessmentCountError ? null : completedAssessmentCount ?? 0}
        pendingPeerRatingCount={pendingPeerRatingCountError ? null : pendingPeerRatingCount ?? 0}
        companyPosts={(companyPosts ?? []) as CompanyPost[]}
      />
    );
  }

  const [
    { data: assignments },
    { data: assignmentRaters },
    { data: departments },
    { data: profiles },
    { data: employees },
    { data: jobProfiles },
  ] = await Promise.all([
    supabase
      .from("assessment_assignments")
      .select("id, employee_id, status, due_date, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("assessment_raters").select("assignment_id, rater_type, status"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("profiles").select("employee_id, department_id, cluster"),
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title, department, country_code")
      .eq("active", true),
    supabase.from("job_profiles").select("title, department"),
  ]);

  const allEmployeeRows = (employees ?? []) as EmployeeDirectoryRow[];
  const employeeById = new Map(allEmployeeRows.map((employee) => [employee.employee_id, employee]));
  const departmentRows = (departments ?? []) as DepartmentRow[];
  const departmentNameById = new Map(departmentRows.map((department) => [department.id, department.name]));
  const profileByEmployeeId = new Map(
    ((profiles ?? []) as ProfileDepartmentRow[])
      .filter((profile): profile is ProfileDepartmentRow & { employee_id: string } => Boolean(profile.employee_id))
      .map((profile) => [profile.employee_id, profile]),
  );
  const jobProfileDepartmentByTitle = new Map(
    ((jobProfiles ?? []) as JobProfileRow[])
      .filter((profile) => Boolean(profile.title && profile.department))
      .map((profile) => [profile.title, profile.department as string]),
  );

  function departmentForEmployee(employeeIdValue: string) {
    const employee = employeeById.get(employeeIdValue);
    const profile = profileByEmployeeId.get(employeeIdValue);
    return (
      cleanDepartment(employee?.department) ??
      (profile?.department_id ? departmentNameById.get(profile.department_id) : null) ??
      cleanDepartment(profile?.cluster) ??
      cleanDepartment(employee?.job_title ? jobProfileDepartmentByTitle.get(employee.job_title) : null) ??
      "Unassigned"
    );
  }

  const userDepartmentName = userDepartmentId ? departmentNameById.get(userDepartmentId) : null;
  const managerDepartmentName = isManager && employeeId
    ? userDepartmentName ?? cleanDepartment(userCluster) ?? departmentForEmployee(employeeId)
    : null;
  const employeeRows = managerDepartmentName
    ? allEmployeeRows.filter((employee) => departmentForEmployee(employee.employee_id) === managerDepartmentName)
    : allEmployeeRows;
  const employeeIds = new Set(employeeRows.map((employee) => employee.employee_id));
  const scopedAssignments = ((assignments ?? []) as AssessmentDashboardAssignment[]).filter((assignment) => employeeIds.has(assignment.employee_id));
  const assignmentIds = new Set(scopedAssignments.map((assignment) => assignment.id));
  const scopedRaters = ((assignmentRaters ?? []) as AssessmentDashboardRater[]).filter((rater) => assignmentIds.has(rater.assignment_id));
  const today = new Date().toISOString().slice(0, 10);
  const isSubmitted = (assignment: AssessmentDashboardAssignment) => assignment.status === "submitted" || assignment.status === "closed";
  const isPending = (assignment: AssessmentDashboardAssignment) => assignment.status === "assigned" || assignment.status === "in_progress";
  const isOverdue = (assignment: AssessmentDashboardAssignment) => isPending(assignment) && Boolean(assignment.due_date && assignment.due_date < today);

  const submittedAssignments = scopedAssignments.filter(isSubmitted);
  const pendingAssignments = scopedAssignments.filter(isPending);
  const overdueAssignments = pendingAssignments.filter(isOverdue);
  const assignedEmployeeIds = new Set(scopedAssignments.map((assignment) => assignment.employee_id));
  const assessedEmployeeIds = new Set(submittedAssignments.map((assignment) => assignment.employee_id));
  const nonSelfRaters = scopedRaters.filter((rater) => rater.rater_type !== "self");
  const submittedRaters = nonSelfRaters.filter((rater) => rater.status === "submitted");
  const pendingRaters = nonSelfRaters.filter((rater) => rater.status === "pending");
  const assignmentCompletion = scopedAssignments.length ? submittedAssignments.length / scopedAssignments.length : 0;
  const raterCompletion = nonSelfRaters.length ? submittedRaters.length / nonSelfRaters.length : 0;

  function progressRows(groupForEmployee: (employee: EmployeeDirectoryRow) => string): AssessmentProgressRow[] {
    const groups = new Map<string, { employees: number; assigned: number; submitted: number; pending: number; overdue: number }>();
    for (const employee of employeeRows) {
      const name = groupForEmployee(employee);
      const group = groups.get(name) ?? { employees: 0, assigned: 0, submitted: 0, pending: 0, overdue: 0 };
      group.employees += 1;
      groups.set(name, group);
    }
    for (const assignment of scopedAssignments) {
      const employee = employeeById.get(assignment.employee_id);
      if (!employee) continue;
      const name = groupForEmployee(employee);
      const group = groups.get(name) ?? { employees: 0, assigned: 0, submitted: 0, pending: 0, overdue: 0 };
      group.assigned += 1;
      if (isSubmitted(assignment)) group.submitted += 1;
      if (isPending(assignment)) group.pending += 1;
      if (isOverdue(assignment)) group.overdue += 1;
      groups.set(name, group);
    }
    return [...groups.entries()]
      .map(([name, group]) => ({ ...group, name, completion: group.assigned ? group.submitted / group.assigned : 0 }))
      .filter((row) => row.assigned > 0 || row.employees > 0)
      .sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));
  }

  const departmentProgress = progressRows((employee) => departmentForEmployee(employee.employee_id));
  const countryProgress = progressRows((employee) => employee.country_code?.trim() || "Unassigned");
  const recentOverdue = overdueAssignments
    .slice()
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Assessment Dashboard"
        description={managerDepartmentName ? `Live assessment progress for ${managerDepartmentName}.` : "Live assessment completion, rating progress, and overdue work."}
        actions={<Link href="/assessments/results" className={buttonVariants({ variant: "outline" })}>Open assessment results</Link>}
      />

      <div className="t-dash-stagger grid grid-cols-2 gap-4 lg:grid-cols-5">
        <OperationsStatCard icon={UserCheck} label="Assessed employees" value={assessedEmployeeIds.size.toString()} detail={`${assignedEmployeeIds.size} employees assigned`} tone="blue" />
        <OperationsStatCard icon={CheckCircle2} label="Assignment completion" value={formatPct(assignmentCompletion)} detail={`${submittedAssignments.length} of ${scopedAssignments.length} submitted`} tone="green" />
        <OperationsStatCard icon={ClipboardList} label="Pending assignments" value={pendingAssignments.length.toString()} detail="Employee responses outstanding" tone="amber" />
        <OperationsStatCard icon={UsersRound} label="Pending ratings" value={pendingRaters.length.toString()} detail={`${formatPct(raterCompletion)} rater completion`} tone="violet" />
        <OperationsStatCard icon={Clock3} label="Overdue" value={overdueAssignments.length.toString()} detail="Past due and still pending" tone={overdueAssignments.length ? "red" : "green"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardCharts
          submitted={submittedAssignments.length}
          pending={pendingAssignments.length}
          countryRows={countryProgress}
          className="t-dash-rise t-dash-lift"
          style={{ animationDelay: "240ms" }}
        />

        <Card
          className={cn("t-dash-rise t-dash-lift", overdueAssignments.length && "border-red-200 dark:border-red-900")}
          style={{ animationDelay: "300ms" }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock3 className="size-5 text-red-600" /> Attention required</CardTitle>
          </CardHeader>
          <CardContent>
            {recentOverdue.length ? (
              <div className="space-y-3">
                {recentOverdue.map((assignment) => {
                  const employee = employeeById.get(assignment.employee_id);
                  return <div key={assignment.id} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{employee?.full_name ?? assignment.employee_id}</p><p className="text-xs text-muted-foreground">{departmentForEmployee(assignment.employee_id)}</p></div>
                    <div className="shrink-0 text-right"><Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Overdue</Badge><p className="mt-1 text-xs text-muted-foreground">Due {fmtShortDate(assignment.due_date)}</p></div>
                  </div>;
                })}
                <Link href="/assessments/results" className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>View tracker</Link>
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed text-center"><CheckCircle2 className="mb-3 size-9 text-emerald-600" /><p className="font-medium">Nothing overdue</p><p className="mt-1 text-sm text-muted-foreground">All active assignments are within their due dates.</p></div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ProgressTable title="Progress by department" firstColumn="Department" rows={departmentProgress} className="t-dash-rise t-dash-lift" style={{ animationDelay: "360ms" }} />
        <ProgressTable title="Progress by country" firstColumn="Country" rows={countryProgress} className="t-dash-rise t-dash-lift" style={{ animationDelay: "420ms" }} />
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
  pendingAssessmentCount,
  completedAssessmentCount,
  pendingPeerRatingCount,
  companyPosts,
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
  pendingAssessmentCount: number | null;
  completedAssessmentCount: number | null;
  pendingPeerRatingCount: number | null;
  companyPosts: CompanyPost[];
}) {
  const displayName = userName || employee?.full_name || "Employee";
  const activeCourses = courses.filter((course) => !["Completed", "Dropped"].includes(course.status));
  const objectivesNeedingWork = objectives.filter((objective) =>
    ["draft", "revision_requested"].includes(objective.status)
  );
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
          <div className="t-dash-stagger grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <EmployeeStatCard label="Active courses" value={activeCourses.length.toString()} icon={BookOpen} tone="blue" />
            <Link href="/assessments" className="t-dash-lift rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={completedAssessmentCount == null ? "View my completed assessments. Count unavailable." : `View my completed assessments: ${completedAssessmentCount}`}>
              <EmployeeStatCard label="Completed assessments" value={completedAssessmentCount?.toString() ?? "—"} icon={ClipboardCheck} tone="green" />
            </Link>
            <EmployeeStatCard label="Objectives" value={objectivesNeedingWork.length.toString()} icon={Target} tone="amber" />
            <EmployeeStatCard label="High gaps" value={highSkillGaps.length.toString()} icon={AlertTriangle} tone="red" />
            <Link href="/assessments" className="t-dash-lift rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={pendingAssessmentCount == null ? "View my assessments. Count unavailable." : `View my assessments: ${pendingAssessmentCount} pending`}>
              <EmployeeStatCard label="Pending assessments" value={pendingAssessmentCount?.toString() ?? "—"} icon={ClipboardList} tone="blue" />
            </Link>
            <Link href="/assessments" className="t-dash-lift rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" aria-label={pendingPeerRatingCount == null ? "View pending peer ratings. Count unavailable." : `View pending peer ratings: ${pendingPeerRatingCount}`}>
              <EmployeeStatCard label="Pending peer ratings" value={pendingPeerRatingCount?.toString() ?? "—"} icon={UsersRound} tone="amber" />
            </Link>
          </div>

          <div className="t-dash-rise" style={{ animationDelay: "240ms" }}>
            <CompanyHighlights posts={companyPosts} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="t-dash-rise t-dash-lift" style={{ animationDelay: "300ms" }}>
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

            <Card className="t-dash-rise t-dash-lift" style={{ animationDelay: "360ms" }}>
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
            <div className="t-dash-rise" style={{ animationDelay: "400ms" }}><CourseList courses={courses} /></div>
            <div className="t-dash-rise" style={{ animationDelay: "460ms" }}><ObjectiveList objectives={objectives} /></div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="t-dash-rise" style={{ animationDelay: "520ms" }}><PerformanceList appraisals={performanceAppraisals} latestAppraisal={latestAppraisal} /></div>
            <div className="t-dash-rise" style={{ animationDelay: "580ms" }}><SkillGapList gaps={skillGaps} /></div>
          </div>

          <div className="t-dash-rise" style={{ animationDelay: "640ms" }}>
            <NotificationList notifications={notifications} />
          </div>
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
    <Card className="t-dash-lift h-full">
      <CardContent className="flex min-h-24 items-center gap-3 p-4">
        <Icon className={cn("h-7 w-7", toneClass)} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn("mt-1 text-2xl font-semibold", toneClass)}><CountUp value={value} /></div>
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

function OperationsStatCard({ icon: Icon, label, value, detail, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  tone: "red" | "amber" | "green" | "blue" | "violet";
}) {
  const toneClass = {
    red: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
  }[tone];
  return (
    <Card className="t-dash-lift overflow-hidden">
      <CardContent className="p-4">
        <div className={cn("mb-4 flex size-10 items-center justify-center rounded-xl", toneClass)}><Icon className="size-5" /></div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold"><CountUp value={value} /></p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ProgressTable({ title, firstColumn, rows, className, style }: { title: string; firstColumn: string; rows: AssessmentProgressRow[]; className?: string; style?: React.CSSProperties }) {
  return <Card className={className} style={style}>
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="text-left text-muted-foreground"><tr><th className="pb-3 font-medium">{firstColumn}</th><th className="pb-3 font-medium">Employees</th><th className="pb-3 font-medium">Assigned</th><th className="pb-3 font-medium">Submitted</th><th className="pb-3 font-medium">Pending</th><th className="pb-3 font-medium">Overdue</th><th className="pb-3 text-right font-medium">Completion</th></tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.name} className="border-t"><td className="py-3 font-medium">{row.name}</td><td>{row.employees}</td><td>{row.assigned}</td><td className="text-emerald-700 dark:text-emerald-300">{row.submitted}</td><td>{row.pending}</td><td className={row.overdue ? "font-medium text-red-600" : undefined}>{row.overdue}</td><td className="text-right"><div className="flex items-center justify-end gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><div className="t-dash-bar h-full rounded-full bg-emerald-500" style={{ width: `${Math.round(row.completion * 100)}%`, animationDelay: `${500 + index * 40}ms` }} /></div><span className="w-10 tabular-nums">{formatPct(row.completion)}</span></div></td></tr>)}</tbody>
      </table>
    </CardContent>
  </Card>;
}

function cleanDepartment(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
