"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function seedCycleKpisFromRoleTemplates(cycleId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "executive"].includes(profile.role)) {
    return { error: "Only HR/Admin or C-Level users can seed KPIs." };
  }

  const roleTitle = String(formData.get("role_title") ?? "");
  if (!roleTitle) return { error: "Select a role to seed KPIs from." };

  const { data: templates, error: templateError } = await supabase
    .from("role_kpi_templates")
    .select("title, measure, target, default_weight")
    .eq("role_title", roleTitle)
    .eq("active", true)
    .order("sort_order");

  if (templateError) return { error: templateError.message };
  if (!templates?.length) return { error: "No KPI templates found for this role." };

  const { data: existing, error: existingError } = await supabase
    .from("org_kpis")
    .select("title")
    .eq("cycle_id", cycleId);

  if (existingError) return { error: existingError.message };

  const existingTitles = new Set((existing ?? []).map((item) => item.title.toLowerCase()));
  const payload = templates
    .filter((template) => !existingTitles.has(template.title.toLowerCase()))
    .map((template) => ({
      cycle_id: cycleId,
      title: template.title,
      description: template.measure ? `${template.measure}\n\nSource role: ${roleTitle}` : `Source role: ${roleTitle}`,
      level: "team" as const,
      department_id: null,
      weight: template.default_weight,
      target_value: template.target,
      created_by: user.id,
    }));

  if (!payload.length) {
    return { error: "All KPI templates for this role already exist in this cycle." };
  }

  const { error } = await supabase.from("org_kpis").insert(payload);
  if (error) return { error: error.message };

  revalidatePath(`/cycles/${cycleId}/kpis`);
  revalidatePath(`/cycles/${cycleId}`);
  return { success: true, inserted: payload.length };
}
