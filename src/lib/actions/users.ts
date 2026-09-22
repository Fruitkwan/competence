"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/constants/roles";
import { ROLES } from "@/lib/constants/roles";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase, userId: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "HR admin access required." as const, supabase, userId: null };
  return { error: null, supabase, userId: user.id };
}

export async function setUserActive(userId: string, active: boolean) {
  const { error: authError, supabase, userId: me } = await requireAdmin();
  if (authError) return { error: authError };
  if (userId === me) return { error: "You cannot deactivate your own account." };

  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

export type UserUpdate = {
  full_name: string;
  role: AppRole;
  job_title: string | null;
  department_id: string | null;
  country_code: string | null;
  manager_id: string | null;
  employee_id: string | null;
};

export async function updateUser(userId: string, fields: UserUpdate) {
  const { error: authError, supabase, userId: me } = await requireAdmin();
  if (authError) return { error: authError };
  if (!Object.values(ROLES).includes(fields.role)) return { error: "Invalid role." };
  if (userId === me && fields.role !== "admin") return { error: "You cannot remove your own admin role." };
  if (userId === me && fields.manager_id === me) return { error: "A user cannot be their own manager." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fields.full_name.trim() || null,
      role: fields.role,
      job_title: fields.job_title?.trim() || null,
      department_id: fields.department_id || null,
      country_code: fields.country_code?.trim() || null,
      manager_id: fields.manager_id || null,
      employee_id: fields.employee_id?.trim() || null,
    })
    .eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}

export async function deleteUser(userId: string) {
  const { error: authError, supabase, userId: me } = await requireAdmin();
  if (authError) return { error: authError };
  if (userId === me) return { error: "You cannot delete your own account." };

  const admin = createAdminClient();
  if (!admin) return { error: "Service role key not configured — cannot delete auth accounts." };

  // Remove the auth account first (profiles row cascades if the FK allows it).
  const { error: authDelete } = await admin.auth.admin.deleteUser(userId);
  if (authDelete) return { error: authDelete.message };

  const { error } = await supabase.from("profiles").delete().eq("id", userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/users");
  return { error: null };
}
