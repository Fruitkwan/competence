"use server";

import { revalidatePath } from "next/cache";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createNotification } from "@/lib/notifications/create-notification";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type TrainingSurveyInput = {
  fullName: string;
  jobTitle: string;
  department: string;
  roleLevel: string;
  email: string;
  managerName?: string;
  learnDepartments: string[];
  learnTopics?: string;
  urgency?: string | null;
  preferredFormat?: string | null;
  learningHours?: string | null;
  teachDepartments: string[];
  teachTopics?: string;
  confidence?: string | null;
  teachingHours?: string | null;
  recommendedTrainers?: string;
  comments?: string;
};

export type TrainingSurveyStatus = "submitted" | "reviewed" | "actioned" | "archived";

type SurveyInsert = Database["public"]["Tables"]["training_survey_responses"]["Insert"];

const SURVEY_STATUSES = new Set<TrainingSurveyStatus>([
  "submitted",
  "reviewed",
  "actioned",
  "archived",
]);

export async function submitTrainingSurveyResponse(input: TrainingSurveyInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, employee_id, manager_id, job_title")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: profileError?.message ?? "Profile not found." };
  }

  const employee = await getCurrentEmployee(
    profile.employee_id,
    user.id,
    profile.email ?? user.email ?? null
  );

  const fullName = clean(input.fullName) || clean(employee?.full_name) || clean(profile.full_name);
  const jobTitle = clean(input.jobTitle) || clean(employee?.job_title) || clean(profile.job_title);
  const department = clean(input.department) || clean(employee?.department);
  const roleLevel = clean(input.roleLevel);
  const email = clean(input.email) || clean(employee?.email) || clean(profile.email);

  const missing = [
    !fullName && "full name",
    !jobTitle && "job title",
    !department && "department",
    !roleLevel && "role level",
    !email && "email",
  ].filter(Boolean);

  if (missing.length) {
    return { error: `Please provide ${missing.join(", ")}.` };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email." };
  }

  const payload: SurveyInsert = {
    user_id: user.id,
    employee_id: employee?.employee_id ?? profile.employee_id ?? null,
    full_name: fullName,
    job_title: jobTitle,
    department,
    role_level: roleLevel,
    email,
    manager_name: clean(input.managerName) || clean(employee?.manager_name) || null,
    learn_departments: normalizeList(input.learnDepartments),
    learn_topics: clean(input.learnTopics) || null,
    urgency: clean(input.urgency) || null,
    preferred_format: clean(input.preferredFormat) || null,
    learning_hours: clean(input.learningHours) || null,
    teach_departments: normalizeList(input.teachDepartments),
    teach_topics: clean(input.teachTopics) || null,
    confidence: clean(input.confidence) || null,
    teaching_hours: clean(input.teachingHours) || null,
    recommended_trainers: clean(input.recommendedTrainers) || null,
    comments: clean(input.comments) || null,
  };

  const { data, error } = await supabase
    .from("training_survey_responses")
    .insert(payload)
    .select("id, department")
    .single();

  if (error) return { error: error.message };

  await notifySurveySubmitted({
    responseId: data.id,
    employeeName: fullName,
    department: data.department,
    managerId: profile.manager_id,
    submittedBy: user.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath("/training/dashboard");
  revalidatePath("/training/survey");

  return { success: true, responseId: data.id };
}

export async function updateTrainingSurveyResponseStatus(
  responseId: string,
  status: TrainingSurveyStatus
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };
  if (!SURVEY_STATUSES.has(status)) return { error: "Invalid survey status." };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { error: profileError?.message ?? "Profile not found." };
  }

  if (profile.role !== "admin" && profile.role !== "manager") {
    return { error: "Only managers and admins can update survey status." };
  }

  const { error } = await supabase
    .from("training_survey_responses")
    .update({ status })
    .eq("id", responseId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/training/dashboard");
  revalidatePath("/training/survey/results");

  return { success: true };
}

function clean(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function normalizeList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

async function getCurrentEmployee(employeeId: string | null, userId: string, email: string | null) {
  const supabase = await createClient();
  const select = "employee_id, full_name, job_title, department, email, manager_name";

  if (employeeId) {
    const { data } = await supabase
      .from("employees")
      .select(select)
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (data) return data;
  }

  const { data: byUserId } = await supabase
    .from("employees")
    .select(select)
    .eq("user_id", userId)
    .maybeSingle();
  if (byUserId) return byUserId;

  if (!email) return null;
  const { data: byEmail } = await supabase
    .from("employees")
    .select(select)
    .ilike("email", email)
    .maybeSingle();
  return byEmail ?? null;
}

async function notifySurveySubmitted({
  responseId,
  employeeName,
  department,
  managerId,
  submittedBy,
}: {
  responseId: string;
  employeeName: string;
  department: string;
  managerId: string | null;
  submittedBy: string;
}) {
  const supabase = await createClient();
  const targetIds = new Set<string>();

  if (managerId && managerId !== submittedBy) targetIds.add(managerId);

  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .in("role", ["admin", "executive"])
    .eq("is_active", true);

  for (const admin of admins ?? []) {
    if (admin.id !== submittedBy) targetIds.add(admin.id);
  }

  await Promise.all(
    [...targetIds].map((userId) =>
      createNotification({
        user_id: userId,
        type: NOTIFICATION_TYPES.TRAINING_SURVEY_SUBMITTED,
        title: `${employeeName} submitted a training survey`,
        body: `${department} training feedback is ready for review.`,
        link: "/training/dashboard",
        metadata: { response_id: responseId, department },
      })
    )
  );
}
