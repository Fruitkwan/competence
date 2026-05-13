"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EmployeeInput = {
  employee_id: string;
  full_name: string;
  job_title: string;
  country_code?: string;
  manager_name?: string;
  email?: string;
  user_id?: string;
  active?: boolean;
};

export async function upsertEmployee(data: EmployeeInput, isEdit: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Double check HR role if we want, though RLS could handle it.
  // Actually, we can check their profile.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Unauthorized. HR Access required." };
  }

  try {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (!isEdit) {
      // Check if employee_id already exists since it's a text PK
      const { data: existing } = await supabase
        .from("employees")
        .select("employee_id")
        .eq("employee_id", data.employee_id)
        .single();
        
      if (existing) {
        return { error: "Employee ID already exists." };
      }
    }

    const { data: result, error } = await supabase
      .from("employees")
      .upsert(payload, { onConflict: 'employee_id' })
      .select()
      .single();

    if (error) {
      console.error("Error upserting employee:", error);
      return { error: error.message };
    }

    revalidatePath("/admin/employees");
    return { success: true, data: result };
  } catch (err: any) {
    console.error("Failed to upsert employee:", err);
    return { error: err.message || "Failed to save employee" };
  }
}

export async function deleteEmployee(employee_id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Unauthorized. HR Access required." };
  }

  try {
    const { error } = await supabase
      .from("employees")
      .delete()
      .eq("employee_id", employee_id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/employees");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Failed to delete employee" };
  }
}
