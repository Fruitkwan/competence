"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createNotification } from "@/lib/notifications/create-notification";
import { CompetencyEntry, GoalRow, PerformanceAppraisalForm } from "@/lib/supabase/performance-appraisal-types";
import type { Database } from "@/lib/supabase/types";

type PerformanceAppraisalInsert = Database["public"]["Tables"]["performance_appraisals"]["Insert"];
type PerformanceAppraisalUpdate = Database["public"]["Tables"]["performance_appraisals"]["Update"];

export async function saveAppraisal(data: Partial<PerformanceAppraisalForm>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    if (!data.employee_id) {
      return { error: "Employee is required" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, employee_id, email")
      .eq("id", user.id)
      .single();

    const { data: existing } = data.id
      ? await supabase
          .from("performance_appraisals")
          .select("*")
          .eq("id", data.id)
          .maybeSingle()
      : { data: null };

    let payloadData = data;

    if (profile?.role === "employee") {
      const employeeId = await resolveEmployeeIdForUser(
        profile.employee_id,
        user.id,
        profile.email ?? user.email ?? null
      );
      if (!employeeId) return { error: "Your user is not linked to an employee record." };
      if (data.employee_id !== employeeId) return { error: "Employees can only save their own appraisal." };
      payloadData = employeeWritableData(data, existing as unknown as PerformanceAppraisalForm | null);
    } else if (profile?.role === "manager" || profile?.role === "executive") {
      const appraisal = (existing ?? data) as unknown as PerformanceAppraisalForm;
      const managerUserId = await resolveManagerUserId(appraisal);
      const isAssignedManager =
        managerUserId === user.id ||
        Boolean(profile.employee_id && data.manager_id === profile.employee_id) ||
        Boolean(profile.employee_id && existing?.manager_id === profile.employee_id);
      if (!isAssignedManager) return { error: "Managers can only save appraisals assigned to them." };
      if (data.manager_signed_at && !existing?.employee_signed_at) {
        return { error: "Employee sign-off is required before manager sign-off." };
      }
      payloadData = managerWritableData(data, existing as unknown as PerformanceAppraisalForm | null);
    } else if (data.hr_signed_at && !(existing?.employee_signed_at && existing?.manager_signed_at)) {
      return { error: "Employee and manager sign-off are required before HR sign-off." };
    }

    const payload = {
      ...payloadData,
      employee_id: payloadData.employee_id,
      appraisal_type: payloadData.appraisal_type || null,
      manager_id: payloadData.manager_id || null,
      department: payloadData.department || null,
      business_unit: payloadData.business_unit || null,
      location: payloadData.location || null,
      appraisal_period: payloadData.appraisal_period || null,
      document_ref: payloadData.document_ref || null,
      updated_at: new Date().toISOString(),
      created_by: user.id,
    } as unknown as PerformanceAppraisalInsert;

    let result;

    if (data.id) {
      // Check if it's transitioning to Final to log to audit_log
      if (payloadData.status === "Final") {
        if (existing?.status !== "Final") {
          await supabase.from("audit_log").insert({
            actor: user.id,
            actor_email: user.email,
            table_name: "performance_appraisals",
            row_pk: data.id,
            action: "UPDATE",
            after: { status: "Final", hr_signed_at: payloadData.hr_signed_at },
          });
        }
      }

      result = await supabase
        .from("performance_appraisals")
        .update(payload as PerformanceAppraisalUpdate)
        .eq("id", data.id)
        .select()
        .single();
    } else {
      // New appraisal
      result = await supabase
        .from("performance_appraisals")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      console.error("Supabase Error saving appraisal:", result.error);
      return { error: result.error.message };
    }

    revalidatePath("/appraisals/performance");
    revalidatePath(`/appraisals/performance/${result.data.id}`);

    await syncSkillGaps(result.data.id, payloadData);
    await notifyAppraisalSignoff(
      result.data as unknown as PerformanceAppraisalForm,
      existing as unknown as PerformanceAppraisalForm | null,
      user.id
    );

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to save appraisal:", error);
    return { error: error instanceof Error ? error.message : "Failed to save appraisal" };
  }
}

function employeeWritableData(
  next: Partial<PerformanceAppraisalForm>,
  existing: PerformanceAppraisalForm | null
) {
  const employeeSignedAt = next.employee_signed_at ?? existing?.employee_signed_at ?? null;
  const preservedStatus = existing?.status === "Final" || existing?.manager_signed_at;

  return {
    ...next,
    ...(existing
      ? {
          employee_id: existing.employee_id,
          manager_id: existing.manager_id,
          department: existing.department,
          business_unit: existing.business_unit,
          location: existing.location,
          appraisal_period: existing.appraisal_period,
          appraisal_type: existing.appraisal_type,
          document_ref: existing.document_ref,
          goals: mergeEmployeeGoals(next.goals, existing.goals),
        }
      : { goals: (next.goals ?? []).map((goal) => ({ ...goal, rating_n2: null })) }),
    core_competencies: mergeEmployeeCompetencies(next.core_competencies, existing?.core_competencies),
    leadership: mergeEmployeeCompetencies(next.leadership, existing?.leadership),
    values_culture: mergeEmployeeCompetencies(next.values_culture, existing?.values_culture),
    feedback_n2: existing?.feedback_n2 ?? next.feedback_n2,
    manager_signed_at: existing?.manager_signed_at ?? null,
    hr_signed_at: existing?.hr_signed_at ?? null,
    hr_representative: existing?.hr_representative ?? "",
    calibrated_rating: existing?.calibrated_rating ?? null,
    calibration_rationale: existing?.calibration_rationale ?? "",
    overall_label: existing?.overall_label ?? "",
    recommended_action: existing?.recommended_action ?? "",
    employee_signed_at: employeeSignedAt,
    status: preservedStatus ? existing!.status : employeeSignedAt ? "N1 Complete" : "Draft",
  };
}

function managerWritableData(
  next: Partial<PerformanceAppraisalForm>,
  existing: PerformanceAppraisalForm | null
): Partial<PerformanceAppraisalForm> {
  const employeeSignedAt = existing?.employee_signed_at ?? null;
  const managerSignedAt = next.manager_signed_at ?? existing?.manager_signed_at ?? null;

  return {
    ...next,
    ...(existing
      ? {
          employee_id: existing.employee_id,
          manager_id: existing.manager_id,
          department: existing.department,
          business_unit: existing.business_unit,
          location: existing.location,
          appraisal_period: existing.appraisal_period,
          appraisal_type: existing.appraisal_type,
          document_ref: existing.document_ref,
        }
      : {}),
    goals: mergeManagerGoals(next.goals, existing?.goals),
    core_competencies: mergeManagerCompetencies(next.core_competencies, existing?.core_competencies),
    leadership: mergeManagerCompetencies(next.leadership, existing?.leadership),
    values_culture: mergeManagerCompetencies(next.values_culture, existing?.values_culture),
    feedback_n1: existing?.feedback_n1 ?? next.feedback_n1,
    employee_comments: existing?.employee_comments ?? "",
    employee_signed_at: employeeSignedAt,
    manager_signed_at: managerSignedAt,
    hr_signed_at: existing?.hr_signed_at ?? null,
    hr_representative: existing?.hr_representative ?? "",
    calibrated_rating: existing?.calibrated_rating ?? null,
    calibration_rationale: existing?.calibration_rationale ?? "",
    overall_label: existing?.overall_label ?? "",
    recommended_action: existing?.recommended_action ?? "",
    status: existing?.hr_signed_at ? "Final" : managerSignedAt && employeeSignedAt ? "N2 Complete" : employeeSignedAt ? "N1 Complete" : "Draft",
  };
}

function mergeEmployeeGoals(next: GoalRow[] | undefined, existing: GoalRow[] = []) {
  if (!existing.length) return (next ?? []).map((goal) => ({ ...goal, rating_n2: null }));
  return existing.map((goal, index) => ({
    ...goal,
    rating_n1: next?.[index]?.rating_n1 ?? goal.rating_n1,
  }));
}

function mergeEmployeeCompetencies(
  next: Record<string, CompetencyEntry> | undefined,
  existing: Record<string, CompetencyEntry> = {}
) {
  const keys = new Set([...Object.keys(existing), ...Object.keys(next ?? {})]);
  return Object.fromEntries(
    [...keys].map((key) => {
      const oldEntry = existing[key];
      const newEntry = next?.[key];
      return [
        key,
        {
          ...oldEntry,
          rating_n1: newEntry?.rating_n1 ?? oldEntry?.rating_n1 ?? null,
          comments_n1: newEntry?.comments_n1 ?? oldEntry?.comments_n1 ?? "",
          evidence: newEntry?.evidence ?? oldEntry?.evidence ?? "",
          rating_n2: oldEntry?.rating_n2 ?? null,
          comments_n2: oldEntry?.comments_n2 ?? "",
        },
      ];
    })
  );
}

function mergeManagerGoals(next: GoalRow[] | undefined, existing: GoalRow[] = []) {
  const source = next?.length ? next : existing;
  return source.map((goal, index) => ({
    ...goal,
    rating_n1: existing[index]?.rating_n1 ?? goal.rating_n1,
  }));
}

function mergeManagerCompetencies(
  next: Record<string, CompetencyEntry> | undefined,
  existing: Record<string, CompetencyEntry> = {}
) {
  const keys = new Set([...Object.keys(existing), ...Object.keys(next ?? {})]);
  return Object.fromEntries(
    [...keys].map((key) => {
      const oldEntry = existing[key];
      const newEntry = next?.[key];
      return [
        key,
        {
          ...newEntry,
          rating_n1: oldEntry?.rating_n1 ?? newEntry?.rating_n1 ?? null,
          comments_n1: oldEntry?.comments_n1 ?? newEntry?.comments_n1 ?? "",
          rating_n2: newEntry?.rating_n2 ?? oldEntry?.rating_n2 ?? null,
          comments_n2: newEntry?.comments_n2 ?? oldEntry?.comments_n2 ?? "",
          evidence: newEntry?.evidence ?? oldEntry?.evidence ?? "",
        },
      ];
    })
  );
}

async function resolveEmployeeIdForUser(employeeId: string | null, userId: string, email: string | null) {
  const supabase = await createClient();

  if (employeeId) {
    const { data } = await supabase
      .from("employees")
      .select("employee_id")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (data?.employee_id) return data.employee_id;
  }

  const { data: byUserId } = await supabase
    .from("employees")
    .select("employee_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (byUserId?.employee_id) return byUserId.employee_id;

  if (!email) return null;
  const { data: byEmail } = await supabase
    .from("employees")
    .select("employee_id")
    .ilike("email", email)
    .maybeSingle();
  return byEmail?.employee_id ?? null;
}

async function notifyAppraisalSignoff(
  saved: PerformanceAppraisalForm,
  previous: PerformanceAppraisalForm | null,
  actorId: string
) {
  if (!saved.id) return;
  const name = await employeeName(saved.employee_id);

  if (saved.employee_signed_at && !previous?.employee_signed_at) {
    const managerUserId = await resolveManagerUserId(saved);
    if (managerUserId && managerUserId !== actorId) {
      await createNotification({
        user_id: managerUserId,
        type: NOTIFICATION_TYPES.APPRAISAL_SIGNED,
        title: "Employee signed performance appraisal",
        body: `${name} completed the employee sign-off.`,
        link: `/appraisals/performance/${saved.id}`,
        metadata: { appraisal_id: saved.id, employee_id: saved.employee_id },
      });
    }
  }

  const bothSignedNow = Boolean(saved.employee_signed_at && saved.manager_signed_at);
  const bothSignedBefore = Boolean(previous?.employee_signed_at && previous?.manager_signed_at);
  if (bothSignedNow && !bothSignedBefore) {
    const supabase = await createClient();
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .eq("is_active", true);

    await Promise.all(
      (admins ?? [])
        .filter((admin) => admin.id !== actorId)
        .map((admin) =>
          createNotification({
            user_id: admin.id,
            type: NOTIFICATION_TYPES.APPRAISAL_SIGNED,
            title: "HR sign-off required",
            body: `${name} and their manager signed the appraisal.`,
            link: `/appraisals/performance/${saved.id}`,
            metadata: { appraisal_id: saved.id, employee_id: saved.employee_id },
          })
        )
    );
  }

  revalidatePath("/notifications");
}

async function resolveManagerUserId(appraisal: PerformanceAppraisalForm) {
  const supabase = await createClient();

  if (appraisal.manager_id) {
    const { data: managerEmployee } = await supabase
      .from("employees")
      .select("user_id")
      .eq("employee_id", appraisal.manager_id)
      .maybeSingle();
    if (managerEmployee?.user_id) return managerEmployee.user_id;

    const { data: managerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("employee_id", appraisal.manager_id)
      .maybeSingle();
    if (managerProfile?.id) return managerProfile.id;
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("manager_name")
    .eq("employee_id", appraisal.employee_id)
    .maybeSingle();

  if (!employee?.manager_name) return null;

  const { data: byName } = await supabase
    .from("employees")
    .select("user_id")
    .eq("full_name", employee.manager_name)
    .maybeSingle();
  if (byName?.user_id) return byName.user_id;

  const { data: profileByName } = await supabase
    .from("profiles")
    .select("id")
    .eq("full_name", employee.manager_name)
    .maybeSingle();
  return profileByName?.id ?? null;
}

async function employeeName(employeeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("full_name")
    .eq("employee_id", employeeId)
    .maybeSingle();
  return data?.full_name ?? employeeId;
}

async function syncSkillGaps(appraisalId: string, data: Partial<PerformanceAppraisalForm>) {
  if (!data.employee_id) return;

  const supabase = await createClient();
  const { data: employee } = await supabase
    .from("employees")
    .select("employee_id, job_title")
    .eq("employee_id", data.employee_id)
    .single();

  const roleTitle = employee?.job_title ?? null;
  const { data: roleProfile } = roleTitle
    ? await supabase
        .from("job_profiles")
        .select("department")
        .eq("title", roleTitle)
        .single()
    : { data: null };

  const { data: courses } = roleProfile?.department
    ? await supabase
        .from("courses")
        .select("title")
        .contains("cluster_fit", [roleProfile.department])
        .eq("active", true)
        .limit(3)
    : { data: [] };

  const suggestedCourses = (courses ?? []).map((course) => course.title).join(", ");
  const rows = collectGaps(data, roleTitle, suggestedCourses).map((gap) => ({
    ...gap,
    appraisal_id: appraisalId,
    employee_id: data.employee_id!,
  }));

  await supabase.from("skill_gaps").delete().eq("appraisal_id", appraisalId);
  if (rows.length) {
    await supabase.from("skill_gaps").insert(rows);
  }
}

function collectGaps(
  data: Partial<PerformanceAppraisalForm>,
  roleTitle: string | null,
  suggestedCourses: string
) {
  const sections: { section: string; entries?: Record<string, CompetencyEntry> }[] = [
    { section: "core_competencies", entries: data.core_competencies },
    { section: "leadership", entries: data.leadership },
    { section: "values_culture", entries: data.values_culture },
  ];

  const rows = [];
  for (const section of sections) {
    for (const [competencyName, entry] of Object.entries(section.entries ?? {})) {
      const actualRating = entry.rating_n2 ?? entry.rating_n1;
      if (!actualRating) continue;

      const requiredRating = 3;
      const gap = requiredRating - actualRating;
      if (gap <= 0) continue;

      rows.push({
        role_title: roleTitle,
        competency_name: competencyName,
        section: section.section,
        required_rating: requiredRating,
        actual_rating: actualRating,
        gap,
        severity: gap >= 2 ? "high" as const : "medium" as const,
        recommended_action: suggestedCourses
          ? `Add to IDP and consider: ${suggestedCourses}`
          : "Add to IDP and assign a relevant development activity.",
      });
    }
  }
  return rows;
}
