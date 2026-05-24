"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CompetencyEntry, PerformanceAppraisalForm } from "@/lib/supabase/performance-appraisal-types";
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

    const payload = {
      ...data,
      employee_id: data.employee_id,
      appraisal_type: data.appraisal_type || null,
      manager_id: data.manager_id || null,
      department: data.department || null,
      business_unit: data.business_unit || null,
      location: data.location || null,
      appraisal_period: data.appraisal_period || null,
      document_ref: data.document_ref || null,
      updated_at: new Date().toISOString(),
      created_by: user.id,
    } as unknown as PerformanceAppraisalInsert;

    let result;

    if (data.id) {
      // Check if it's transitioning to Final to log to audit_log
      if (data.status === "Final") {
        const { data: existing } = await supabase
          .from("performance_appraisals")
          .select("status")
          .eq("id", data.id)
          .single();

        if (existing?.status !== "Final") {
          await supabase.from("audit_log").insert({
            actor: user.id,
            actor_email: user.email,
            table_name: "performance_appraisals",
            row_pk: data.id,
            action: "UPDATE",
            after: { status: "Final", hr_signed_at: data.hr_signed_at },
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

    await syncSkillGaps(result.data.id, data);

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to save appraisal:", error);
    return { error: error instanceof Error ? error.message : "Failed to save appraisal" };
  }
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
