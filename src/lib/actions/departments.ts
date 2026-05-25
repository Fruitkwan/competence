"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" as const, supabase: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Unauthorized. HR/Admin access required." as const, supabase: null };
  }

  return { supabase, error: null as null };
}

export async function createDepartment(name: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Department name is required." };

  const { error } = await auth.supabase!.from("departments").insert({ name: trimmed });

  if (error) {
    if (error.code === "23505") return { error: "Department already exists." };
    return { error: error.message };
  }

  revalidatePath("/admin/departments");
  return { success: true };
}

export async function updateDepartment(id: string, name: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const trimmed = name.trim();
  if (!trimmed) return { error: "Department name is required." };

  const { error } = await auth.supabase!.from("departments").update({ name: trimmed }).eq("id", id);

  if (error) {
    if (error.code === "23505") return { error: "A department with this name already exists." };
    return { error: error.message };
  }

  revalidatePath("/admin/departments");
  return { success: true };
}

export async function deleteDepartment(id: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const [{ count: memberCount }, { count: childCount }] = await Promise.all([
    auth
      .supabase!.from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("department_id", id),
    auth
      .supabase!.from("departments")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", id),
  ]);

  if ((memberCount ?? 0) > 0) {
    return {
      error: `Cannot delete: ${memberCount} user(s) are assigned to this department. Reassign them first.`,
    };
  }

  if ((childCount ?? 0) > 0) {
    return {
      error: "Cannot delete: this department has sub-departments. Remove or reassign them first.",
    };
  }

  const { error } = await auth.supabase!.from("departments").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return { error: "Cannot delete: this department is referenced by KPIs or other records." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/departments");
  return { success: true };
}
