"use server";

import { revalidatePath } from "next/cache";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createNotification } from "@/lib/notifications/create-notification";
import { normalizeName } from "@/lib/assessments/match";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = new Set(["workplace", "management", "conduct", "harassment", "discrimination", "safety", "ethics", "other"]);
const STATUSES = new Set(["under_review", "resolved", "closed"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const EVIDENCE_BUCKET = "complaint-evidence";
const MAX_EVIDENCE_FILES = 3;
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;
const EVIDENCE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
type ComplaintCategory = "workplace" | "management" | "conduct" | "harassment" | "discrimination" | "safety" | "ethics" | "other";
type ComplaintStatus = "under_review" | "resolved" | "closed";
type ComplaintPriority = "low" | "normal" | "high" | "urgent";

function samePersonName(left: string | null | undefined, right: string | null | undefined) {
  const a = normalizeName(left ?? "").split(" ").filter(Boolean);
  const b = normalizeName(right ?? "").split(" ").filter(Boolean);
  if (!a.length || !b.length) return false;
  return a.join(" ") === b.join(" ") || (a[0] === b[0] && a.at(-1) === b.at(-1));
}

async function currentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, employee_id, manager_id")
    .eq("id", user.id)
    .single();
  return data;
}

async function notifyHr(title: string, body: string, link: string, metadata: Record<string, unknown>) {
  const supabase = createAdminClient() ?? (await createClient());
  const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin").eq("is_active", true);
  await Promise.all((admins ?? []).map((admin) => createNotification({
    user_id: admin.id,
    type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
    title,
    body,
    link,
    metadata,
  })));
}

function refreshComplaints(id?: string) {
  revalidatePath("/complaints");
  if (id) revalidatePath(`/complaints/${id}`);
  revalidatePath("/notifications");
}

export type SubmitComplaintInput = {
  subject_employee_id: string | null;
  category: string;
  title: string;
  description: string;
  requested_outcome: string | null;
};

export async function submitComplaint(input: SubmitComplaintInput) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated." };
  if (!(["employee", "manager"] as string[]).includes(profile.role)) return { error: "Only employees and managers can submit a complaint." };

  const title = input.title.trim();
  const description = input.description.trim();
  const requestedOutcome = input.requested_outcome?.trim() || null;
  if (!CATEGORIES.has(input.category)) return { error: "Choose a valid category." };
  if (title.length < 5 || title.length > 160) return { error: "Title must be between 5 and 160 characters." };
  if (description.length < 20 || description.length > 10_000) return { error: "Description must be between 20 and 10,000 characters." };
  if (requestedOutcome && requestedOutcome.length > 2_000) return { error: "Requested outcome must be 2,000 characters or fewer." };

  const supabase = await createClient();
  const { data: reporterEmployee } = profile.employee_id
    ? await supabase.from("employees").select("employee_id, manager_name").eq("employee_id", profile.employee_id).maybeSingle()
    : { data: null };

  let subject: { employee_id: string; full_name: string; manager_name: string | null; user_id: string | null } | null = null;
  if (input.subject_employee_id) {
    const { data } = await supabase
      .from("employees")
      .select("employee_id, full_name, manager_name, user_id")
      .eq("employee_id", input.subject_employee_id)
      .eq("active", true)
      .maybeSingle();
    if (!data) return { error: "Selected employee was not found." };
    subject = data;

    const isOwnManager =
      (!!profile.manager_id && subject.user_id === profile.manager_id) ||
      samePersonName(subject.full_name, reporterEmployee?.manager_name);
    const isDirectReport = profile.role === "manager" && samePersonName(subject.manager_name, profile.full_name);
    if (!isOwnManager && !isDirectReport) return { error: "You can only select your manager or one of your direct reports." };
  }

  const { data: complaint, error } = await supabase
    .from("complaints")
    .insert({
      reporter_id: profile.id,
      reporter_role: profile.role,
      reporter_name: profile.full_name ?? "Employee",
      reporter_employee_id: profile.employee_id,
      subject_employee_id: subject?.employee_id ?? null,
      subject_name: subject?.full_name ?? null,
      category: input.category as ComplaintCategory,
      title,
      description,
      requested_outcome: requestedOutcome,
    })
    .select("id, case_number")
    .single();
  if (error || !complaint) return { error: error?.message ?? "Could not submit complaint." };

  const reference = `CMP-${String(complaint.case_number).padStart(6, "0")}`;
  await notifyHr(
    `New confidential complaint: ${reference}`,
    `${profile.full_name ?? "An employee"} submitted a ${input.category} complaint.`,
    `/complaints/${complaint.id}`,
    { complaint_id: complaint.id, case_number: complaint.case_number }
  );
  refreshComplaints(complaint.id);
  return { success: true, id: complaint.id, reference };
}

export async function addComplaintUpdate(input: { complaint_id: string; body: string; internal: boolean }) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated." };
  const body = input.body.trim();
  if (!body || body.length > 4_000) return { error: "Message must be between 1 and 4,000 characters." };

  const supabase = await createClient();
  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, reporter_id, case_number, status")
    .eq("id", input.complaint_id)
    .maybeSingle();
  if (!complaint) return { error: "Complaint not found or access denied." };

  const isReporter = complaint.reporter_id === profile.id;
  const isHr = profile.role === "admin";
  const isExecutive = profile.role === "executive" && complaint.status === "escalated";
  if (!isReporter && !isHr && !isExecutive) return { error: "Access denied." };
  const internal = isHr || isExecutive ? input.internal : false;

  const { error } = await supabase.from("complaint_updates").insert({
    complaint_id: complaint.id,
    author_id: profile.id,
    author_name: profile.full_name ?? "User",
    kind: "comment",
    visibility: internal ? "internal" : "reporter",
    body,
  });
  if (error) return { error: error.message };

  const reference = `CMP-${String(complaint.case_number).padStart(6, "0")}`;
  if (isReporter) {
    await notifyHr(`New message on ${reference}`, body.slice(0, 180), `/complaints/${complaint.id}`, { complaint_id: complaint.id });
  } else if (!internal) {
    await createNotification({
      user_id: complaint.reporter_id,
      type: NOTIFICATION_TYPES.COMPLAINT_UPDATED,
      title: `HR replied to ${reference}`,
      body: body.slice(0, 180),
      link: `/complaints/${complaint.id}`,
      metadata: { complaint_id: complaint.id },
    });
  }
  refreshComplaints(complaint.id);
  return { success: true };
}

export async function updateComplaint(input: {
  complaint_id: string;
  status: string;
  priority: string;
  resolution_summary: string | null;
}) {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") return { error: "HR access required." };
  if (!STATUSES.has(input.status)) return { error: "Choose a valid status." };
  if (!PRIORITIES.has(input.priority)) return { error: "Choose a valid priority." };
  const resolution = input.resolution_summary?.trim() || null;
  if (input.status === "resolved" && (!resolution || resolution.length < 10)) return { error: "Add a resolution summary before resolving the case." };
  if (resolution && resolution.length > 4_000) return { error: "Resolution summary must be 4,000 characters or fewer." };

  const supabase = await createClient();
  const { data: complaint, error } = await supabase
    .from("complaints")
    .update({
      status: input.status as ComplaintStatus,
      priority: input.priority as ComplaintPriority,
      hr_owner_id: profile.id,
      resolution_summary: resolution,
      resolved_at: input.status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", input.complaint_id)
    .select("id, reporter_id, case_number")
    .single();
  if (error || !complaint) return { error: error?.message ?? "Could not update complaint." };

  const label = input.status.replace("_", " ");
  await supabase.from("complaint_updates").insert({
    complaint_id: complaint.id,
    author_id: profile.id,
    author_name: profile.full_name ?? "HR",
    kind: input.status === "resolved" ? "resolution" : "status",
    visibility: "reporter",
    body: input.status === "resolved" ? `Case resolved. ${resolution}` : `Status changed to ${label}.`,
  });
  await createNotification({
    user_id: complaint.reporter_id,
    type: NOTIFICATION_TYPES.COMPLAINT_UPDATED,
    title: `Complaint CMP-${String(complaint.case_number).padStart(6, "0")} updated`,
    body: `HR changed the status to ${label}.`,
    link: `/complaints/${complaint.id}`,
    metadata: { complaint_id: complaint.id },
  });
  refreshComplaints(complaint.id);
  return { success: true };
}

export async function escalateComplaint(complaintId: string) {
  const profile = await currentProfile();
  if (!profile || profile.role !== "admin") return { error: "HR access required." };
  const supabase = await createClient();
  const { data: executive } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("is_active", true)
    .ilike("full_name", "%faleh%")
    .limit(1)
    .maybeSingle();

  const { data: complaint, error } = await supabase
    .from("complaints")
    .update({
      status: "escalated",
      priority: "urgent",
      hr_owner_id: profile.id,
      escalated_to: executive?.id ?? null,
      escalated_to_name: executive?.full_name ?? "Executive reviewer",
      escalated_at: new Date().toISOString(),
    })
    .eq("id", complaintId)
    .select("id, reporter_id, case_number")
    .single();
  if (error || !complaint) return { error: error?.message ?? "Could not escalate complaint." };

  await supabase.from("complaint_updates").insert({
    complaint_id: complaint.id,
    author_id: profile.id,
    author_name: profile.full_name ?? "HR",
    kind: "escalation",
    visibility: "reporter",
    body: "HR escalated this case for executive review.",
  });
  await createNotification({
    user_id: complaint.reporter_id,
    type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
    title: `Complaint CMP-${String(complaint.case_number).padStart(6, "0")} escalated`,
    body: "HR escalated your complaint for executive review.",
    link: `/complaints/${complaint.id}`,
    metadata: { complaint_id: complaint.id },
  });
  if (executive) {
    await createNotification({
      user_id: executive.id,
      type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
      title: `Confidential escalation: CMP-${String(complaint.case_number).padStart(6, "0")}`,
      body: "HR escalated a confidential complaint for your review.",
      link: `/complaints/${complaint.id}`,
      metadata: { complaint_id: complaint.id },
    });
  }
  refreshComplaints(complaint.id);
  return { success: true, warning: executive ? null : "Escalation was recorded, but the executive reviewer does not yet have an active portal account. HR must follow up outside the portal." };
}

async function ensureEvidenceBucket() {
  const admin = createAdminClient();
  if (!admin) return { error: "Evidence storage is not configured." as const, admin: null };
  const { data } = await admin.storage.getBucket(EVIDENCE_BUCKET);
  if (!data) {
    const { error } = await admin.storage.createBucket(EVIDENCE_BUCKET, {
      public: false,
      fileSizeLimit: MAX_EVIDENCE_SIZE,
      allowedMimeTypes: [...new Set(Object.values(EVIDENCE_TYPES))],
    });
    if (error && !error.message.toLowerCase().includes("already exists")) return { error: error.message, admin: null };
  }
  return { error: null, admin };
}

export async function uploadComplaintEvidence(complaintId: string, formData: FormData) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated." };
  const supabase = await createClient();
  const { data: complaint } = await supabase
    .from("complaints")
    .select("id, reporter_id, case_number, status")
    .eq("id", complaintId)
    .maybeSingle();
  if (!complaint) return { error: "Complaint not found or access denied." };
  if (complaint.status === "closed") return { error: "Evidence cannot be added to a closed case." };

  const files = formData.getAll("evidence").filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length) return { error: "Choose at least one evidence file." };
  if (files.length > MAX_EVIDENCE_FILES) return { error: `Upload no more than ${MAX_EVIDENCE_FILES} files at a time.` };

  const checked = files.map((file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mimeType = EVIDENCE_TYPES[extension];
    if (!mimeType) return { error: `${file.name}: unsupported file type.` as string, file, mimeType: "" };
    if (file.size > MAX_EVIDENCE_SIZE) return { error: `${file.name}: file exceeds 10 MB.` as string, file, mimeType };
    return { error: null, file, mimeType };
  });
  const invalid = checked.find((item) => item.error);
  if (invalid?.error) return { error: invalid.error };

  const storage = await ensureEvidenceBucket();
  if (storage.error || !storage.admin) return { error: storage.error ?? "Evidence storage is unavailable." };
  const { count } = await storage.admin
    .from("complaint_attachments")
    .select("id", { count: "exact", head: true })
    .eq("complaint_id", complaint.id);
  if ((count ?? 0) + files.length > 10) return { error: "A complaint can contain no more than 10 evidence files." };

  const uploaded: string[] = [];
  for (const item of checked) {
    const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const path = `${complaint.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await storage.admin.storage
      .from(EVIDENCE_BUCKET)
      .upload(path, Buffer.from(await item.file.arrayBuffer()), { contentType: item.mimeType, upsert: false });
    if (uploadError) return { error: `${item.file.name}: ${uploadError.message}` };

    const { error: metadataError } = await storage.admin.from("complaint_attachments").insert({
      complaint_id: complaint.id,
      uploaded_by: profile.id,
      file_name: item.file.name.slice(0, 255),
      storage_path: path,
      mime_type: item.mimeType,
      size_bytes: item.file.size,
    });
    if (metadataError) {
      await storage.admin.storage.from(EVIDENCE_BUCKET).remove([path]);
      return { error: `${item.file.name}: ${metadataError.message}` };
    }
    uploaded.push(item.file.name);
  }

  if (complaint.reporter_id === profile.id) {
    await notifyHr(
      `Evidence added to CMP-${String(complaint.case_number).padStart(6, "0")}`,
      `${profile.full_name ?? "The reporter"} added ${uploaded.length} evidence file${uploaded.length === 1 ? "" : "s"}.`,
      `/complaints/${complaint.id}`,
      { complaint_id: complaint.id }
    );
  }
  refreshComplaints(complaint.id);
  return { success: true, uploaded };
}

export async function getComplaintEvidenceUrl(attachmentId: string) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated." };
  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("complaint_attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) return { error: "Evidence file not found or access denied." };
  const admin = createAdminClient();
  if (!admin) return { error: "Evidence storage is not configured." };
  const { data, error } = await admin.storage.from(EVIDENCE_BUCKET).createSignedUrl(attachment.storage_path, 60);
  if (error || !data?.signedUrl) return { error: error?.message ?? "Could not open evidence file." };
  return { success: true, url: data.signedUrl };
}
