"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PerformanceAppraisalForm } from "@/lib/supabase/performance-appraisal-types";

export async function saveAppraisal(data: Partial<PerformanceAppraisalForm>) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
      created_by: user.id,
    };

    let result;

    if (data.id) {
      // Check if it's transitioning to Final to log to audit_log
      if (data.status === "Final") {
        const { data: existing } = await db
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

      result = await db
        .from("performance_appraisals")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
    } else {
      // New appraisal
      result = await db
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

    return { success: true, data: result.data };
  } catch (error: any) {
    console.error("Failed to save appraisal:", error);
    return { error: error.message || "Failed to save appraisal" };
  }
}
