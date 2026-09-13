"use server";

import { revalidatePath } from "next/cache";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createNotification } from "@/lib/notifications/create-notification";
import { createClient } from "@/lib/supabase/server";

export async function submitTrainingRequest(formData: FormData) {
  const courseId = String(formData.get("course_id") ?? "");
  const courseTitle = String(formData.get("course_title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const budgetText = String(formData.get("budget_amount") ?? "").trim();
  const budgetCurrency = String(formData.get("budget_currency") ?? "AED").trim() || "AED";
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const endDate = String(formData.get("end_date") ?? "").trim() || null;
  const durationDaysText = String(formData.get("duration_days") ?? "").trim();
  const certificationRequired = String(formData.get("certification_required") ?? "false") === "true";
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!courseTitle) return { error: "Enter a training course." };
  if (startDate && endDate && startDate > endDate) return { error: "End date must be after start date." };

  const budgetAmount = budgetText ? Number(budgetText) : null;
  if (budgetAmount !== null && (!Number.isFinite(budgetAmount) || budgetAmount < 0)) {
    return { error: "Enter a valid budget." };
  }

  const durationDays = durationDaysText ? Number(durationDaysText) : null;
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1)) {
    return { error: "Enter a valid number of days." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, employee_id, manager_id")
    .eq("id", user.id)
    .single();

  if (!profile) return { error: "Profile not found." };
  if (profile.role !== "employee") return { error: "Only employees can submit training requests." };

  const [employee, course] = await Promise.all([
    getCurrentEmployee(profile.employee_id, user.id, profile.email ?? user.email ?? null),
    courseId ? getCourse(courseId) : Promise.resolve(null),
  ]);
  if (courseId && !course) return { error: "Course not found." };

  const managerUserId = await resolveManagerUserId(profile.manager_id, employee?.manager_name);
  if (!managerUserId) return { error: "No manager is linked to your employee profile." };

  const employeeName = employee?.full_name ?? profile.full_name ?? user.email ?? "Employee";
  const { error } = await supabase.from("training_requests").insert({
    user_id: user.id,
    employee_id: employee?.employee_id ?? profile.employee_id ?? null,
    employee_name: employeeName,
    manager_user_id: managerUserId,
    course_id: course?.id ?? null,
    course_title: course?.title ?? courseTitle,
    location,
    budget_amount: budgetAmount,
    budget_currency: budgetCurrency,
    start_date: startDate,
    end_date: endDate,
    duration_days: durationDays,
    certification_required: certificationRequired,
    reason,
  });

  if (error) {
    return {
      error: error.code === "42P01"
        ? "Training requests table is missing. Run scripts/migration-training-requests.sql in Supabase."
        : error.message,
    };
  }

  await createNotification({
    user_id: managerUserId,
    type: NOTIFICATION_TYPES.TRAINING_REQUEST_SUBMITTED,
    title: `${employeeName} requested training`,
    body: [
      course?.title ?? courseTitle,
      location,
      budgetAmount !== null ? `${budgetCurrency} ${budgetAmount}` : null,
      startDate && endDate ? `${startDate} to ${endDate}` : startDate,
      certificationRequired ? "Certification requested" : null,
    ].filter(Boolean).join(" - "),
    link: "/training/dashboard",
    metadata: {
      employee_id: employee?.employee_id ?? profile.employee_id,
      course_id: course?.id ?? null,
      course_title: course?.title ?? courseTitle,
      location,
      budget_amount: budgetAmount,
      budget_currency: budgetCurrency,
      start_date: startDate,
      end_date: endDate,
      duration_days: durationDays,
      certification_required: certificationRequired,
    },
  });

  revalidatePath("/notifications");
  revalidatePath("/training/request");
  return { success: true };
}

async function getCurrentEmployee(employeeId: string | null, userId: string, email: string | null) {
  const supabase = await createClient();
  const select = "employee_id, full_name, email, manager_name";

  if (employeeId) {
    const { data } = await supabase.from("employees").select(select).eq("employee_id", employeeId).maybeSingle();
    if (data) return data;
  }

  const { data: byUserId } = await supabase.from("employees").select(select).eq("user_id", userId).maybeSingle();
  if (byUserId) return byUserId;

  if (!email) return null;
  const { data } = await supabase.from("employees").select(select).ilike("email", email).maybeSingle();
  return data ?? null;
}

async function getCourse(courseId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .eq("active", true)
    .maybeSingle();
  return data;
}

async function resolveManagerUserId(managerId: string | null, managerName?: string | null) {
  if (managerId) return managerId;
  if (!managerName) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("full_name", managerName)
    .maybeSingle();
  return data?.id ?? null;
}
