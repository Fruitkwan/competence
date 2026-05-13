"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CycleStatus } from "@/lib/constants/roles";
import { CYCLE_STATUSES } from "@/lib/constants/roles";

export async function createCycle(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;
  const objectiveDeadline = formData.get("objective_deadline") as string;
  const selfAssessmentDeadline = formData.get("self_assessment_deadline") as string;
  const managerAssessmentDeadline = formData.get("manager_assessment_deadline") as string;
  const calibrationDeadline = formData.get("calibration_deadline") as string;

  if (!name || !startDate || !endDate) {
    return { error: "Name, start date, and end date are required" };
  }

  const { data, error } = await supabase
    .from("appraisal_cycles")
    .insert({
      name,
      type: type as "annual" | "bi_annual" | "quarterly" | "probation",
      start_date: startDate,
      end_date: endDate,
      objective_deadline: objectiveDeadline || null,
      self_assessment_deadline: selfAssessmentDeadline || null,
      manager_assessment_deadline: managerAssessmentDeadline || null,
      calibration_deadline: calibrationDeadline || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Notify all users about the new cycle
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (allUsers) {
    const notifications = allUsers.map((u) => ({
      user_id: u.id,
      type: "cycle_created",
      title: `New appraisal cycle: ${name}`,
      body: `A new ${type?.replace("_", "-")} cycle has been created.`,
      link: `/cycles/${data.id}`,
    }));
    await supabase.from("notifications").insert(notifications);
  }

  revalidatePath("/cycles");
  return { id: data.id };
}

export async function updateCycleStatus(cycleId: string, newStatus: CycleStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Validate status transition (must be sequential)
  const { data: cycle } = await supabase
    .from("appraisal_cycles")
    .select("status, name")
    .eq("id", cycleId)
    .single();

  if (!cycle) return { error: "Cycle not found" };

  const currentIdx = CYCLE_STATUSES.indexOf(cycle.status as CycleStatus);
  const newIdx = CYCLE_STATUSES.indexOf(newStatus);

  if (newIdx !== currentIdx + 1) {
    return { error: `Cannot transition from ${cycle.status} to ${newStatus}` };
  }

  const { error } = await supabase
    .from("appraisal_cycles")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", cycleId);

  if (error) return { error: error.message };

  // Notify all users about status change
  const { data: allUsers } = await supabase
    .from("profiles")
    .select("id")
    .eq("is_active", true);

  if (allUsers) {
    const notifications = allUsers.map((u) => ({
      user_id: u.id,
      type: "cycle_status_changed",
      title: `Cycle "${cycle.name}" moved to ${newStatus.replace("_", " ")}`,
      link: `/cycles/${cycleId}`,
    }));
    await supabase.from("notifications").insert(notifications);
  }

  revalidatePath(`/cycles/${cycleId}`);
  revalidatePath("/cycles");
  return { success: true };
}

export async function updateCycle(cycleId: string, formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = formData.get("end_date") as string;
  const objectiveDeadline = formData.get("objective_deadline") as string;
  const selfAssessmentDeadline = formData.get("self_assessment_deadline") as string;
  const managerAssessmentDeadline = formData.get("manager_assessment_deadline") as string;
  const calibrationDeadline = formData.get("calibration_deadline") as string;

  const { error } = await supabase
    .from("appraisal_cycles")
    .update({
      name,
      type: type as "annual" | "bi_annual" | "quarterly" | "probation",
      start_date: startDate,
      end_date: endDate,
      objective_deadline: objectiveDeadline || null,
      self_assessment_deadline: selfAssessmentDeadline || null,
      manager_assessment_deadline: managerAssessmentDeadline || null,
      calibration_deadline: calibrationDeadline || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cycleId);

  if (error) return { error: error.message };

  revalidatePath(`/cycles/${cycleId}`);
  revalidatePath("/cycles");
  return { success: true };
}
