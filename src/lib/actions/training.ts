"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";

type CourseStatus = "Enrolled" | "In Progress" | "Completed" | "Dropped";

const COURSE_STATUSES = new Set<CourseStatus>(["Enrolled", "In Progress", "Completed", "Dropped"]);

export async function assignCourseToEmployee(employeeId: string, courseId: string) {
  const supabase = await createClient();
  const authError = await requireTrainingManager();
  if (authError) return { error: authError };

  if (!employeeId || !courseId) return { error: "Select both an employee and a course." };

  const { data, error } = await supabase
    .from("employee_courses")
    .insert({ employee_id: employeeId, course_id: courseId, status: "Enrolled" })
    .select("id, employee_id, course_id, status, enrolled_at, started_at, completed_at, score")
    .single();

  if (error) {
    return {
      error: error.code === "23505" ? "This employee is already enrolled in this course." : error.message,
    };
  }

  await notifyCourseAssigned(employeeId, courseId);
  revalidateTrainingPaths();

  return { success: true, data };
}

export async function updateEmployeeCourseStatus(assignmentId: string, status: string) {
  const supabase = await createClient();
  const authError = await requireTrainingManager();
  if (authError) return { error: authError };

  if (!COURSE_STATUSES.has(status as CourseStatus)) return { error: "Invalid course status." };
  const nextStatus = status as CourseStatus;

  const { data: existing, error: existingError } = await supabase
    .from("employee_courses")
    .select("id, employee_id, course_id, status")
    .eq("id", assignmentId)
    .single();

  if (existingError || !existing) return { error: existingError?.message ?? "Assignment not found." };

  const updates: {
    status: CourseStatus;
    started_at?: string;
    completed_at?: string;
  } = { status: nextStatus };
  if (nextStatus === "In Progress") updates.started_at = new Date().toISOString();
  if (nextStatus === "Completed") updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from("employee_courses")
    .update(updates)
    .eq("id", assignmentId);

  if (error) return { error: error.message };

  if (nextStatus === "Completed" && existing.status !== "Completed") {
    await notifyCourseCompleted(existing.employee_id, existing.course_id);
  }

  revalidateTrainingPaths();
  return { success: true };
}

async function requireTrainingManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Not authenticated";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "employee") return "Unauthorized. Manager access required.";
  return null;
}

async function notifyCourseAssigned(employeeId: string, courseId: string) {
  const supabase = await createClient();
  const [employee, course] = await Promise.all([
    getEmployeeNotificationContext(employeeId),
    getCourseTitle(courseId),
  ]);

  if (!employee.employeeUserId) return;

  await supabase.from("notifications").insert({
    user_id: employee.employeeUserId,
    type: NOTIFICATION_TYPES.COURSE_ASSIGNED,
    title: `New course assigned: ${course}`,
    body: "A training course has been assigned to you.",
    link: "/training/my-courses",
    metadata: { employee_id: employeeId, course_id: courseId },
  });
}

async function notifyCourseCompleted(employeeId: string, courseId: string) {
  const supabase = await createClient();
  const [employee, course] = await Promise.all([
    getEmployeeNotificationContext(employeeId),
    getCourseTitle(courseId),
  ]);

  if (!employee.managerUserId) return;

  await supabase.from("notifications").insert({
    user_id: employee.managerUserId,
    type: NOTIFICATION_TYPES.COURSE_COMPLETED,
    title: `${employee.fullName} completed ${course}`,
    body: "Review the employee's training progress.",
    link: "/training/my-courses",
    metadata: { employee_id: employeeId, course_id: courseId },
  });
}

async function getEmployeeNotificationContext(employeeId: string) {
  const supabase = await createClient();
  const [{ data: employee }, { data: profile }] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_id, full_name, user_id, manager_name")
      .eq("employee_id", employeeId)
      .single(),
    supabase
      .from("profiles")
      .select("id, full_name, employee_id, manager_id")
      .eq("employee_id", employeeId)
      .maybeSingle(),
  ]);

  let managerUserId = profile?.manager_id ?? null;
  if (!managerUserId && employee?.manager_name) {
    const { data: managerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("full_name", employee.manager_name)
      .maybeSingle();
    managerUserId = managerProfile?.id ?? null;
  }

  return {
    employeeUserId: employee?.user_id ?? profile?.id ?? null,
    managerUserId,
    fullName: employee?.full_name ?? profile?.full_name ?? employeeId,
  };
}

async function getCourseTitle(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();

  return data?.title ?? "training course";
}

function revalidateTrainingPaths() {
  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath("/training/assign");
  revalidatePath("/training/my-courses");
  revalidatePath("/training/dashboard");
}
