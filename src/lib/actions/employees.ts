"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EmployeeInput = {
  employee_id: string;
  full_name: string;
  job_title: string;
  department?: string;
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
  } catch (err: unknown) {
    console.error("Failed to upsert employee:", err);
    return { error: err instanceof Error ? err.message : "Failed to save employee" };
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
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to delete employee" };
  }
}

export async function resetEmployeeData() {
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

  const results = {
    skillGaps: 0,
    employeeCourses: 0,
    appraisals: 0,
    performanceAppraisals: 0,
    employees: 0,
    importBatches: 0,
  };

  const deleteSteps = [
    {
      label: "skill gaps",
      run: () => supabase.from("skill_gaps").delete({ count: "exact" }).neq("employee_id", ""),
      countKey: "skillGaps" as const,
    },
    {
      label: "employee courses",
      run: () => supabase.from("employee_courses").delete({ count: "exact" }).neq("employee_id", ""),
      countKey: "employeeCourses" as const,
    },
    {
      label: "competency appraisals",
      run: () => supabase.from("appraisals").delete({ count: "exact" }).neq("employee_id", ""),
      countKey: "appraisals" as const,
    },
    {
      label: "performance appraisals",
      run: () => supabase.from("performance_appraisals").delete({ count: "exact" }).neq("employee_id", ""),
      countKey: "performanceAppraisals" as const,
    },
  ];

  for (const step of deleteSteps) {
    const { error, count } = await step.run();
    if (error) return { error: `Could not clear ${step.label}: ${error.message}` };
    results[step.countKey] = count ?? 0;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      employee_id: null,
      department_id: null,
      job_title: null,
      country_code: null,
      cluster: null,
    })
    .or("employee_id.not.is.null,department_id.not.is.null,job_title.not.is.null,country_code.not.is.null,cluster.not.is.null");

  if (profileError) {
    return { error: `Could not unlink profiles from employees: ${profileError.message}` };
  }

  const { error: employeeError, count: employeeCount } = await supabase
    .from("employees")
    .delete({ count: "exact" })
    .neq("employee_id", "");

  if (employeeError) {
    return { error: `Could not clear employees: ${employeeError.message}` };
  }
  results.employees = employeeCount ?? 0;

  const { error: batchError, count: batchCount } = await supabase
    .from("employee_import_batches")
    .delete({ count: "exact" })
    .not("id", "is", null);

  if (batchError) {
    return { error: `Could not clear employee import history: ${batchError.message}` };
  }
  results.importBatches = batchCount ?? 0;

  revalidatePath("/admin/employees");
  revalidatePath("/admin/employees/import");
  revalidatePath("/employees");
  revalidatePath("/dashboard");
  revalidatePath("/appraisals");
  revalidatePath("/training/assign");
  revalidatePath("/training/dashboard");

  return { success: true, counts: results };
}
