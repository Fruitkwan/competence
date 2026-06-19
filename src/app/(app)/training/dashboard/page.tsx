import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrainingDashboardClient, type TrainingDashboardData } from "./training-dashboard-client";

type EmployeeRow = {
  employee_id: string;
  full_name: string;
  job_title: string;
  department?: string | null;
  active: boolean;
};

type ProfileRow = {
  employee_id: string | null;
  department_id: string | null;
  cluster: string | null;
};

type DepartmentRow = {
  id: string;
  name: string;
};

type CourseRow = {
  id: string;
  title: string;
  develops: string | null;
  cluster_fit: string[];
};

type CourseRuleRow = {
  course_id: string;
};

type JobProfileRow = {
  title: string;
  department: string | null;
};

type AssignmentRow = {
  id: string;
  employee_id: string;
  course_id: string;
  status: "Enrolled" | "In Progress" | "Completed" | "Dropped";
  enrolled_at: string;
  completed_at: string | null;
};

type SurveyResponseRow = {
  id: string;
  full_name: string;
  employee_id: string | null;
  job_title: string;
  department: string;
  learn_departments: string[];
  learn_topics: string | null;
  urgency: string | null;
  preferred_format: string | null;
  status: "submitted" | "reviewed" | "actioned" | "archived";
  created_at: string;
};

type DashboardAssignment = TrainingDashboardData["assignments"][number];
type DashboardSurveyResponse = TrainingDashboardData["surveyResponses"][number];

export default async function TrainingDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role, employee_id, cluster")
    .eq("id", user.id)
    .single();
  if (!currentProfile || !["admin", "manager"].includes(currentProfile.role)) redirect("/dashboard");

  let employeesQuery = supabase
    .from("employees")
    .select("*")
    .eq("active", true)
    .order("full_name");

  let assignmentsQuery = supabase
    .from("employee_courses")
    .select("id, employee_id, course_id, status, enrolled_at, completed_at")
    .order("enrolled_at", { ascending: false });

  const surveyResponsesQuery = supabase
    .from("training_survey_responses")
    .select("id, full_name, employee_id, job_title, department, learn_departments, learn_topics, urgency, preferred_format, status, created_at")
    .order("created_at", { ascending: false });

  if (currentProfile?.role === "employee" && currentProfile.employee_id) {
    employeesQuery = employeesQuery.eq("employee_id", currentProfile.employee_id);
    assignmentsQuery = assignmentsQuery.eq("employee_id", currentProfile.employee_id);
  }

  const [employeesRes, profilesRes, departmentsRes, coursesRes, assignmentsRes, cyclesRes, courseRulesRes, jobProfilesRes, surveyResponsesRes] = await Promise.all([
    employeesQuery,
    supabase.from("profiles").select("employee_id, department_id, cluster"),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("courses").select("id, title, develops, cluster_fit").eq("active", true).order("title"),
    assignmentsQuery,
    supabase.from("appraisal_cycles").select("name, status, start_date").order("start_date", { ascending: false }),
    supabase.from("course_rules").select("course_id"),
    supabase.from("job_profiles").select("title, department"),
    surveyResponsesQuery,
  ]);

  const rawEmployees = (employeesRes.data ?? []) as EmployeeRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const departments = (departmentsRes.data ?? []) as DepartmentRow[];
  const courses = (coursesRes.data ?? []) as CourseRow[];
  const rawAssignments = (assignmentsRes.data ?? []) as AssignmentRow[];
  const courseRules = (courseRulesRes.data ?? []) as CourseRuleRow[];
  const jobProfiles = (jobProfilesRes.data ?? []) as JobProfileRow[];
  const rawSurveyResponses = (surveyResponsesRes.data ?? []) as SurveyResponseRow[];
  const cycles = (cyclesRes.data ?? []).map((cycle) => `${cycle.name} (${cycle.status})`);

  const managerDepartment = currentProfile?.role === "manager"
    ? rawEmployees.find((employee) => employee.employee_id === currentProfile.employee_id)?.department ?? currentProfile.cluster
    : null;
  const employees = managerDepartment
    ? rawEmployees.filter((employee) => employee.department === managerDepartment)
    : rawEmployees;
  const employeeIds = new Set(employees.map((employee) => employee.employee_id));
  const assignments = managerDepartment
    ? rawAssignments.filter((assignment) => employeeIds.has(assignment.employee_id))
    : rawAssignments;
  const surveyResponses = managerDepartment
    ? rawSurveyResponses.filter((response) => cleanDepartment(response.department) === managerDepartment)
    : rawSurveyResponses;

  const employeeById = new Map(employees.map((employee) => [employee.employee_id, employee]));
  const profileByEmployeeId = new Map(
    profiles
      .filter((profile): profile is ProfileRow & { employee_id: string } => Boolean(profile.employee_id))
      .map((profile) => [profile.employee_id, profile])
  );
  const departmentNameById = new Map(departments.map((department) => [department.id, department.name]));
  const courseById = new Map(courses.map((course) => [course.id, course]));
  const skillGapCourseIds = new Set(courseRules.map((rule) => rule.course_id));
  const jobProfileDepartmentByTitle = new Map(
    jobProfiles
      .filter((profile) => Boolean(profile.title && profile.department))
      .map((profile) => [profile.title, profile.department as string])
  );

  const departmentForEmployee = (employeeId: string) => {
    const employee = employeeById.get(employeeId);
    const profile = profileByEmployeeId.get(employeeId);
    return (
      cleanDepartment(employee?.department) ??
      (profile?.department_id ? departmentNameById.get(profile.department_id) : null) ??
      cleanDepartment(profile?.cluster) ??
      cleanDepartment(employee?.job_title ? jobProfileDepartmentByTitle.get(employee.job_title) : null) ??
      "Unassigned"
    );
  };

  const assignmentRows: DashboardAssignment[] = assignments.map((assignment, index) => {
    const employee = employeeById.get(assignment.employee_id);
    const course = courseById.get(assignment.course_id);
    const urgency = urgencyForAssignment(assignment);
    const status = statusForAssignment(assignment.status);

    return {
      id: assignment.id,
      initials: initials(employee?.full_name ?? assignment.employee_id),
      name: employee?.full_name ?? assignment.employee_id,
      role: employee?.job_title ?? "Unassigned role",
      dept: departmentForEmployee(assignment.employee_id),
      course: course?.title ?? "Unknown course",
      focus: courseFocus(course),
      urgency,
      status,
      trainingType: trainingTypeForCourse(course, skillGapCourseIds),
      enrolledAt: assignment.enrolled_at,
      completedAt: assignment.completed_at,
      avatarBg: avatarClass(index),
    };
  });

  const surveyRows: DashboardSurveyResponse[] = surveyResponses.map((response, index) => ({
    id: response.id,
    initials: initials(response.full_name),
    name: response.full_name,
    employeeId: response.employee_id,
    role: response.job_title,
    dept: cleanDepartment(response.department) ?? "Unassigned",
    wantsToLearnFrom: normalizeDepartments(response.learn_departments),
    topics: response.learn_topics,
    urgency: surveyUrgency(response.urgency),
    preferredFormat: response.preferred_format,
    status: response.status,
    createdAt: response.created_at,
    avatarBg: avatarClass(index + assignmentRows.length),
  }));

  const departmentsInUse = uniqueSorted([
    ...employees.map((employee) => departmentForEmployee(employee.employee_id)),
    ...departments.map((department) => department.name),
    ...surveyRows.map((response) => response.dept),
  ]);
  const heatmapDepartments = uniqueSorted([
    ...departmentsInUse,
    ...assignments.flatMap((assignment) => courseById.get(assignment.course_id)?.cluster_fit ?? []),
    ...surveyRows.flatMap((response) => response.wantsToLearnFrom),
  ]).slice(0, 8);
  const heatmapIndex = new Map(heatmapDepartments.map((department, index) => [department, index]));
  const heatmapRows: (number | null)[][] = heatmapDepartments.map((rowDept) =>
    heatmapDepartments.map((colDept) => (rowDept === colDept ? null : 0))
  );

  for (const assignment of assignments) {
    const employee = employeeById.get(assignment.employee_id);
    if (!employee) continue;

    const rowIndex = heatmapIndex.get(departmentForEmployee(employee.employee_id));
    const course = courseById.get(assignment.course_id);
    const targetDepartments = course?.cluster_fit.length ? course.cluster_fit : [];
    if (rowIndex == null) continue;

    for (const targetDepartment of targetDepartments) {
      const colIndex = heatmapIndex.get(targetDepartment);
      if (colIndex == null || rowIndex === colIndex) continue;
      heatmapRows[rowIndex][colIndex] = (heatmapRows[rowIndex][colIndex] ?? 0) + 1;
    }
  }

  for (const response of surveyRows) {
    const rowIndex = heatmapIndex.get(response.dept);
    if (rowIndex == null) continue;

    for (const targetDepartment of response.wantsToLearnFrom) {
      const colIndex = heatmapIndex.get(targetDepartment);
      if (colIndex == null || rowIndex === colIndex) continue;
      heatmapRows[rowIndex][colIndex] = (heatmapRows[rowIndex][colIndex] ?? 0) + 1;
    }
  }

  const assignedDepartments = new Set(assignmentRows.map((row) => row.dept));
  const openSurveyDemand = surveyRows.filter((row) => row.status === "submitted" || row.status === "reviewed").length;
  const activeDepartmentCount = departmentsInUse.filter((department) => department !== "Unassigned").length;

  const data: TrainingDashboardData = {
    cycles,
    trainingTypes: [
      { id: "cross_functional", label: "Cross functional" },
      { id: "skill_gap", label: "Skill gap training" },
      { id: "general", label: "General training" },
    ],
    filters: ["All departments", ...departmentsInUse],
    metrics: [
      { label: "Active employees", value: String(employees.length), sub: "from employee directory" },
      { label: "Survey responses", value: String(surveyRows.length), sub: "training feedback records" },
      { label: "Training assignments", value: String(assignments.length), sub: "employee course records" },
      {
        label: "Open demand",
        value: String(openSurveyDemand),
        sub: `across ${Math.max(assignedDepartments.size, activeDepartmentCount)} departments`,
      },
    ],
    heatmapDepartments,
    heatmapRows,
    assignments: assignmentRows,
    recentAssignments: assignmentRows.slice(0, 6),
    surveyResponses: surveyRows,
    recentSurveyResponses: surveyRows.slice(0, 6),
  };

  return <TrainingDashboardClient data={data} />;
}

function uniqueSorted(values: (string | null | undefined)[]) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function courseFocus(course: CourseRow | undefined) {
  if (!course) return "Not assigned";
  if (course.cluster_fit.length) return course.cluster_fit.join(", ");
  return course.develops ?? "General";
}

function trainingTypeForCourse(
  course: CourseRow | undefined,
  skillGapCourseIds: Set<string>
): DashboardAssignment["trainingType"] {
  if (course && skillGapCourseIds.has(course.id)) return "skill_gap";
  if (course?.cluster_fit.length) return "cross_functional";
  return "general";
}

function cleanDepartment(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function urgencyForAssignment(assignment: AssignmentRow): DashboardAssignment["urgency"] {
  if (assignment.status === "Dropped" || assignment.status === "Completed") return "Low";
  const enrolledAt = new Date(assignment.enrolled_at).getTime();
  const daysOpen = Number.isFinite(enrolledAt) ? (Date.now() - enrolledAt) / 86_400_000 : 0;
  if (daysOpen > 30) return "Critical";
  if (assignment.status === "Enrolled") return "High";
  return "Medium";
}

function statusForAssignment(status: AssignmentRow["status"]): DashboardAssignment["status"] {
  if (status === "Completed" || status === "In Progress") return "Matched";
  if (status === "Dropped") return "Unmatched";
  return "Pending";
}

function normalizeDepartments(values: string[] | null | undefined) {
  return uniqueSorted(values ?? []);
}

function surveyUrgency(value: string | null): DashboardSurveyResponse["urgency"] {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("critical")) return "Critical";
  if (normalized.includes("high")) return "High";
  if (normalized.includes("medium")) return "Medium";
  return "Low";
}

function avatarClass(index: number) {
  const classes = [
    "bg-blue-100 text-blue-700",
    "bg-amber-100 text-amber-700",
    "bg-emerald-100 text-emerald-700",
    "bg-violet-100 text-violet-700",
    "bg-pink-100 text-pink-700",
    "bg-orange-100 text-orange-700",
  ];
  return classes[index % classes.length];
}
