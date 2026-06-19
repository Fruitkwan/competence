"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createNotification } from "@/lib/notifications/create-notification";

export async function createObjective(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const cycleId = formData.get("cycle_id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const successCriteria = formData.get("success_criteria") as string;
  const weight = parseFloat(formData.get("weight") as string) || 0;
  const kpiId = formData.get("kpi_id") as string;

  if (!cycleId || !title) {
    return { error: "Cycle and title are required" };
  }

  const { error } = await supabase.from("cycle_objectives").insert({
    cycle_id: cycleId,
    employee_id: user.id,
    kpi_id: kpiId || null,
    title,
    description: description || null,
    success_criteria: successCriteria || null,
    weight,
    status: "draft",
  });

  if (error) return { error: error.message };

  revalidatePath("/objectives");
  return { success: true };
}

export async function updateObjective(objectiveId: string, formData: FormData) {
  const supabase = await createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const successCriteria = formData.get("success_criteria") as string;
  const weight = parseFloat(formData.get("weight") as string) || 0;
  const kpiId = formData.get("kpi_id") as string;

  const { error } = await supabase
    .from("cycle_objectives")
    .update({
      title,
      description: description || null,
      success_criteria: successCriteria || null,
      weight,
      kpi_id: kpiId || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", objectiveId);

  if (error) return { error: error.message };

  revalidatePath("/objectives");
  return { success: true };
}

export async function submitObjectives(cycleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Validate weights sum to 100
  const { data: objectives } = await supabase
    .from("cycle_objectives")
    .select("id, weight")
    .eq("cycle_id", cycleId)
    .eq("employee_id", user.id)
    .eq("status", "draft");

  if (!objectives || objectives.length === 0) {
    return { error: "No draft objectives to submit" };
  }

  const totalWeight = objectives.reduce((sum, o) => sum + Number(o.weight), 0);
  if (Math.abs(totalWeight - 100) > 0.01) {
    return { error: `Objective weights must sum to 100% (currently ${totalWeight}%)` };
  }

  // Update all draft objectives to submitted
  const { error } = await supabase
    .from("cycle_objectives")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("cycle_id", cycleId)
    .eq("employee_id", user.id)
    .eq("status", "draft");

  if (error) return { error: error.message };

  // Notify the employee's manager
  const { data: profile } = await supabase
    .from("profiles")
    .select("manager_id, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.manager_id) {
    await createNotification({
      user_id: profile.manager_id,
      type: NOTIFICATION_TYPES.OBJECTIVE_SUBMITTED,
      title: `${profile.full_name || "An employee"} submitted objectives for review`,
      body: `${objectives.length} objectives are waiting for your approval.`,
      link: "/objectives/review",
      metadata: { cycle_id: cycleId, employee_user_id: user.id },
    });
  }

  revalidatePath("/objectives");
  revalidatePath("/notifications");
  return { success: true };
}

export async function approveObjective(objectiveId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: objective } = await supabase
    .from("cycle_objectives")
    .select("employee_id, title")
    .eq("id", objectiveId)
    .single();

  if (!objective) return { error: "Objective not found" };

  const { error } = await supabase
    .from("cycle_objectives")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", objectiveId);

  if (error) return { error: error.message };

  // Notify employee
  await createNotification({
    user_id: objective.employee_id,
    type: NOTIFICATION_TYPES.OBJECTIVE_APPROVED,
    title: `Objective approved: "${objective.title}"`,
    link: "/objectives",
    metadata: { objective_id: objectiveId },
  });

  revalidatePath("/objectives/review");
  revalidatePath("/objectives");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { success: true };
}

export async function requestRevision(objectiveId: string, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!comment.trim()) return { error: "Comment is required" };

  const { data: objective } = await supabase
    .from("cycle_objectives")
    .select("employee_id, title")
    .eq("id", objectiveId)
    .single();

  if (!objective) return { error: "Objective not found" };

  // Update status
  const { error: updateErr } = await supabase
    .from("cycle_objectives")
    .update({
      status: "revision_requested",
      updated_at: new Date().toISOString(),
    })
    .eq("id", objectiveId);

  if (updateErr) return { error: updateErr.message };

  // Add comment
  await supabase.from("objective_comments").insert({
    objective_id: objectiveId,
    author_id: user.id,
    body: comment,
  });

  // Notify employee
  await createNotification({
    user_id: objective.employee_id,
    type: NOTIFICATION_TYPES.OBJECTIVE_REVISION_REQUESTED,
    title: `Revision requested for: "${objective.title}"`,
    body: comment,
    link: "/objectives",
    metadata: { objective_id: objectiveId },
  });

  revalidatePath("/objectives/review");
  revalidatePath("/objectives");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { success: true };
}

export async function rejectObjective(objectiveId: string, comment: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: objective } = await supabase
    .from("cycle_objectives")
    .select("employee_id, title")
    .eq("id", objectiveId)
    .single();

  if (!objective) return { error: "Objective not found" };

  const { error } = await supabase
    .from("cycle_objectives")
    .update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    })
    .eq("id", objectiveId);

  if (error) return { error: error.message };

  if (comment.trim()) {
    await supabase.from("objective_comments").insert({
      objective_id: objectiveId,
      author_id: user.id,
      body: comment,
    });
  }

  await createNotification({
    user_id: objective.employee_id,
    type: NOTIFICATION_TYPES.OBJECTIVE_REJECTED,
    title: `Objective rejected: "${objective.title}"`,
    body: comment || undefined,
    link: "/objectives",
    metadata: { objective_id: objectiveId },
  });

  revalidatePath("/objectives/review");
  revalidatePath("/objectives");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  return { success: true };
}

export async function deleteObjective(objectiveId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("cycle_objectives")
    .delete()
    .eq("id", objectiveId);

  if (error) return { error: error.message };

  revalidatePath("/objectives");
  return { success: true };
}
