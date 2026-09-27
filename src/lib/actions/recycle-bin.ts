"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRecyclableTable, type RecyclableTable } from "@/lib/recycle-bin";

function revalidateAffectedPages() {
  for (const path of [
    "/dashboard",
    "/objectives",
    "/objectives/review",
    "/admin/employees",
    "/employees",
    "/org-chart",
    "/assessments",
    "/assessments/assign",
    "/assessments/results",
    "/admin/assessments",
    "/training/assign",
    "/training/dashboard",
    "/admin/departments",
    "/roles",
    "/admin/recycle-bin",
  ]) {
    revalidatePath(path);
  }
}

export async function moveToRecycleBin(table: RecyclableTable, recordId: string) {
  if (!isRecyclableTable(table) || !recordId) return { error: "Invalid record." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_to_recycle_bin", { p_table: table, p_record_id: recordId });
  if (error) return { error: error.message };
  if (!data) return { error: "The record was not found or was already removed." };
  revalidateAffectedPages();
  return { success: true };
}

export async function restoreDeletedItem(table: RecyclableTable, recordId: string) {
  if (!isRecyclableTable(table) || !recordId) return { error: "Invalid record." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_deleted_item", { p_table: table, p_record_id: recordId });
  if (error) return { error: error.message };
  if (!data) return { error: "The record is no longer in the Recycle Bin." };
  revalidateAffectedPages();
  return { success: true };
}

export async function permanentlyDeleteItem(table: RecyclableTable, recordId: string) {
  if (!isRecyclableTable(table) || !recordId) return { error: "Invalid record." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("permanently_delete_item", { p_table: table, p_record_id: recordId });
  if (error) return { error: error.message };
  if (!data) return { error: "The record is no longer in the Recycle Bin." };
  revalidateAffectedPages();
  return { success: true };
}
