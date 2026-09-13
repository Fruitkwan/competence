"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" as const, supabase: null, userId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Unauthorized. HR/Admin access required." as const, supabase: null, userId: null };
  }

  return { supabase, userId: user.id, error: null as null };
}

function revalidateRolePaths(title: string) {
  revalidatePath("/roles");
  revalidatePath(`/roles/${encodeURIComponent(title)}`);
}

export type JobProfileInput = {
  title: string;
  department: string;
  reports_to?: string | null;
  role_purpose?: string | null;
  geographic_scope?: string | null;
  responsibilities?: string[];
  authority?: string[];
  qualifications?: Record<string, unknown>;
};

export async function createJobProfile(input: JobProfileInput) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const title = input.title.trim();
  const department = input.department.trim();
  if (!title || !department) return { error: "Title and department are required." };

  const { error } = await auth.supabase!.from("job_profiles").insert({
    title,
    department,
    reports_to: input.reports_to?.trim() || null,
    role_purpose: input.role_purpose?.trim() || null,
    geographic_scope: input.geographic_scope?.trim() || null,
    responsibilities: input.responsibilities ?? [],
    authority: input.authority ?? [],
    qualifications: input.qualifications ?? {},
    active: true,
  });

  if (error) return { error: error.message };

  revalidateRolePaths(title);
  return { success: true, title };
}

export async function updateJobProfile(title: string, input: Omit<JobProfileInput, "title">) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const department = input.department.trim();
  if (!department) return { error: "Department is required." };

  const { error } = await auth.supabase!
    .from("job_profiles")
    .update({
      department,
      reports_to: input.reports_to?.trim() || null,
      role_purpose: input.role_purpose?.trim() || null,
      geographic_scope: input.geographic_scope?.trim() || null,
      responsibilities: input.responsibilities ?? [],
      authority: input.authority ?? [],
      qualifications: input.qualifications ?? {},
    })
    .eq("title", title);

  if (error) return { error: error.message };

  revalidateRolePaths(title);
  return { success: true };
}

export async function deactivateJobProfile(title: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const { error } = await auth.supabase!
    .from("job_profiles")
    .update({ active: false })
    .eq("title", title);

  if (error) return { error: error.message };

  revalidatePath("/roles");
  revalidateRolePaths(title);
  return { success: true };
}

export type RoleCompetencyInput = {
  role_title: string;
  competency_id?: string;
  name?: string;
  category?: string;
  description?: string | null;
  behavioral_indicators?: string | null;
  required_level?: string | null;
  weight?: number;
  sort_order?: number;
};

export async function upsertRoleCompetency(input: RoleCompetencyInput) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const roleTitle = input.role_title.trim();
  if (!roleTitle) return { error: "Role title is required." };

  let competencyId = input.competency_id;

  if (!competencyId) {
    const name = input.name?.trim();
    if (!name) return { error: "Competency name is required." };

    const category = input.category?.trim() || "Core";
    const { data: existing } = await auth.supabase!
      .from("competencies")
      .select("id")
      .eq("name", name)
      .eq("category", category)
      .maybeSingle();

    if (existing) {
      competencyId = existing.id;
    } else {
      const { data: created, error: createError } = await auth.supabase!
        .from("competencies")
        .insert({
          name,
          category,
          description: input.description?.trim() || null,
          behavioral_indicators: input.behavioral_indicators?.trim() || null,
        })
        .select("id")
        .single();

      if (createError) return { error: createError.message };
      competencyId = created.id;
    }
  } else if (input.name) {
    const { error: updateError } = await auth.supabase!
      .from("competencies")
      .update({
        name: input.name.trim(),
        category: input.category?.trim() || "Core",
        description: input.description?.trim() || null,
        behavioral_indicators: input.behavioral_indicators?.trim() || null,
      })
      .eq("id", competencyId);

    if (updateError) return { error: updateError.message };
  }

  const { error } = await auth.supabase!.from("role_competencies").upsert(
    {
      role_title: roleTitle,
      competency_id: competencyId,
      category: input.category?.trim() || "Core",
      required_level: input.required_level || "Competent",
      weight: input.weight ?? 0,
      applicable: true,
      sort_order: input.sort_order ?? 0,
    },
    { onConflict: "role_title,competency_id" },
  );

  if (error) return { error: error.message };

  revalidateRolePaths(roleTitle);
  return { success: true, competency_id: competencyId };
}

export async function removeRoleCompetency(roleTitle: string, competencyId: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const { error } = await auth.supabase!
    .from("role_competencies")
    .delete()
    .eq("role_title", roleTitle)
    .eq("competency_id", competencyId);

  if (error) return { error: error.message };

  revalidateRolePaths(roleTitle);
  return { success: true };
}

export type RoleKpiInput = {
  id?: string;
  role_title: string;
  department: string;
  title: string;
  measure?: string | null;
  target?: string | null;
  review_frequency?: string | null;
  default_weight?: number;
  sort_order?: number;
};

export async function upsertRoleKpi(input: RoleKpiInput) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const roleTitle = input.role_title.trim();
  const kpiTitle = input.title.trim();
  const department = input.department.trim();

  if (!roleTitle || !kpiTitle || !department) {
    return { error: "Role, department, and KPI title are required." };
  }

  const payload = {
    role_title: roleTitle,
    department,
    title: kpiTitle,
    measure: input.measure?.trim() || null,
    target: input.target?.trim() || null,
    review_frequency: input.review_frequency?.trim() || null,
    default_weight: input.default_weight ?? 0,
    sort_order: input.sort_order ?? 0,
    active: true,
  };

  if (input.id) {
    const { error } = await auth.supabase!
      .from("role_kpi_templates")
      .update(payload)
      .eq("id", input.id);

    if (error) return { error: error.message };
  } else {
    const { error } = await auth.supabase!.from("role_kpi_templates").insert(payload);
    if (error) return { error: error.message };
  }

  revalidateRolePaths(roleTitle);
  return { success: true };
}

export async function deleteRoleKpi(id: string, roleTitle: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const { error } = await auth.supabase!.from("role_kpi_templates").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidateRolePaths(roleTitle);
  return { success: true };
}
