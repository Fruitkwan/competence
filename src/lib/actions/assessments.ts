"use server";

import { revalidatePath } from "next/cache";
import { NOTIFICATION_TYPES } from "@/lib/constants/notification-types";
import { createNotification } from "@/lib/notifications/create-notification";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { parseAnnexeDocx, parseInstrumentDocx, type ParsedKey } from "@/lib/assessments/parse-docx";
import { matchSkillTemplate, normalizeName } from "@/lib/assessments/match";
import { defaultJobTitlesFor } from "@/lib/assessments/role-mapping";
import { DEFAULT_SCORING } from "@/lib/assessments/scoring";
import { isExpired, peerTiming } from "@/lib/assessments/time-limit";

type Letter = "A" | "B" | "C" | "D";
type RaterType = "self" | "line_manager" | "cross_dept" | "peer";

const MISSING_TABLE_HINT = "Assessment tables are missing. Run scripts/migration-assessments.sql in Supabase.";

function dbError(error: { code?: string; message: string }) {
  return error.code === "42P01" ? MISSING_TABLE_HINT : error.message;
}

async function currentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, role, full_name, employee_id, email")
    .eq("id", user.id)
    .single();
  return data;
}

async function requireAdmin() {
  const p = await currentProfile();
  if (!p) return { error: "Not authenticated" as const, profile: null };
  if (p.role !== "admin") return { error: "HR admin access required." as const, profile: null };
  return { error: null, profile: p };
}

async function requireStaff() {
  const p = await currentProfile();
  if (!p) return { error: "Not authenticated" as const, profile: null };
  if (p.role === "employee") return { error: "Manager or HR access required." as const, profile: null };
  return { error: null, profile: p };
}

function revalidateAll() {
  for (const p of ["/assessments", "/assessments/assign", "/assessments/results", "/admin/assessments", "/notifications"]) {
    revalidatePath(p);
  }
}

// ---------------------------------------------------------------------------
// Templates (HR)
// ---------------------------------------------------------------------------

export async function uploadAssessmentDocx(formData: FormData) {
  const { error: authError, profile } = await requireAdmin();
  if (authError) return { error: authError };

  const instrument = formData.get("instrument");
  const annexe = formData.get("annexe");
  const hasInstrument = instrument instanceof File && instrument.size > 0;
  const hasAnnexe = annexe instanceof File && annexe.size > 0;
  if (!hasInstrument && !hasAnnexe) return { error: "Choose an instrument (.docx) and/or a scoring annexe (.docx)." };

  const supabase = await createClient();
  const created: { id: string; name: string; items: number }[] = [];
  const keysApplied: string[] = [];

  try {
    if (hasInstrument) {
      const parsed = await parseInstrumentDocx(Buffer.from(await instrument.arrayBuffer()));
      for (const tpl of parsed) {
        const { data: row, error } = await supabase
          .from("assessment_templates")
          .insert({
            kind: tpl.kind,
            name: tpl.name,
            role_family: tpl.role_family,
            department: tpl.department,
            job_titles: defaultJobTitlesFor(tpl.role_family),
            version: tpl.version,
            status: "draft",
            scoring: DEFAULT_SCORING[tpl.kind],
            aspiration_questions: tpl.aspiration_questions,
            privacy_notice: tpl.privacy_notice,
            source_file_name: instrument.name,
            created_by: profile.id,
          })
          .select("id")
          .single();
        if (error || !row) return { error: dbError(error ?? { message: "Insert failed" }) };

        const { error: itemsError } = await supabase.from("assessment_items").insert(
          tpl.items.map((it) => ({ ...it, template_id: row.id }))
        );
        if (itemsError) return { error: itemsError.message };
        created.push({ id: row.id, name: tpl.name, items: tpl.items.length });
      }
    }

    if (hasAnnexe) {
      const keys = await parseAnnexeDocx(Buffer.from(await annexe.arrayBuffer()));
      const result = await applyAnswerKeys(keys);
      if (result.error) return { error: result.error };
      keysApplied.push(...result.applied);
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not parse the document." };
  }

  revalidateAll();
  return { success: true, created, keysApplied: keysApplied.length };
}

async function applyAnswerKeys(keys: ParsedKey[]) {
  const supabase = await createClient();
  const { data: templates, error } = await supabase
    .from("assessment_templates")
    .select("id, kind, role_family, status")
    .neq("status", "archived");
  if (error) return { error: dbError(error), applied: [] };

  const templateIds = (templates ?? []).map((t) => t.id);
  const { data: items } = templateIds.length
    ? await supabase.from("assessment_items").select("id, template_id, name").in("template_id", templateIds)
    : { data: [] };

  const rows: { item_id: string; answer_key: Letter; rationale: string | null; diagnostic: string | null }[] = [];
  const applied: string[] = [];
  for (const key of keys) {
    const matchingTemplates = (templates ?? []).filter(
      (t) => t.kind === key.kind && (key.kind === "behaviour" || normalizeName(t.role_family ?? "") === normalizeName(key.role_family ?? ""))
    );
    for (const tpl of matchingTemplates) {
      const item = (items ?? []).find((i) => i.template_id === tpl.id && normalizeName(i.name) === normalizeName(key.item_name));
      if (!item) continue;
      rows.push({ item_id: item.id, answer_key: key.answer_key, rationale: key.rationale, diagnostic: key.diagnostic });
      applied.push(item.id);
    }
  }
  if (!rows.length) return { error: "No answer keys matched existing templates. Upload the instrument first.", applied: [] };

  const { error: upsertError } = await supabase.from("assessment_item_keys").upsert(rows, { onConflict: "item_id" });
  if (upsertError) return { error: upsertError.message, applied: [] };
  return { error: null, applied };
}

export async function setTemplateStatus(templateId: string, status: "draft" | "published" | "archived") {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const supabase = await createClient();

  if (status === "published") {
    const { data: tpl } = await supabase
      .from("assessment_templates")
      .select("id, kind, role_family")
      .eq("id", templateId)
      .single();
    if (!tpl) return { error: "Template not found." };

    const { data: items } = await supabase.from("assessment_items").select("id").eq("template_id", templateId);
    const ids = (items ?? []).map((i) => i.id);
    const { data: keys } = ids.length
      ? await supabase.from("assessment_item_keys").select("item_id").in("item_id", ids).not("answer_key", "is", null)
      : { data: [] };
    const missing = ids.length - (keys?.length ?? 0);
    if (missing > 0) return { error: `${missing} item(s) have no answer key. Upload the scoring annexe or set the keys before publishing.` };

    // Only one published template per kind + role family.
    let q = supabase
      .from("assessment_templates")
      .update({ status: "archived" })
      .eq("kind", tpl.kind)
      .eq("status", "published")
      .neq("id", templateId);
    q = tpl.role_family == null ? q.is("role_family", null) : q.eq("role_family", tpl.role_family);
    await q;
  }

  const { error } = await supabase
    .from("assessment_templates")
    .update({ status, published_at: status === "published" ? new Date().toISOString() : null })
    .eq("id", templateId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function updateTemplateJobTitles(templateId: string, jobTitles: string[]) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const supabase = await createClient();
  const titles = [...new Set(jobTitles.map((t) => t.trim()).filter(Boolean))];
  const { error } = await supabase.from("assessment_templates").update({ job_titles: titles }).eq("id", templateId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function updateItemAnswerKey(itemId: string, answerKey: Letter) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const supabase = await createClient();
  const { error } = await supabase
    .from("assessment_item_keys")
    .upsert({ item_id: itemId, answer_key: answerKey }, { onConflict: "item_id" });
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteTemplate(templateId: string) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const supabase = await createClient();
  const { error } = await supabase.from("assessment_templates").delete().eq("id", templateId);
  if (error) {
    return { error: error.code === "23503" ? "This template has assignments. Archive it instead." : error.message };
  }
  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Assignment (HR / manager)
// ---------------------------------------------------------------------------

export type AssignInput = {
  employee_id: string;
  template_ids: string[];
  wave: string | null;
  due_date: string | null;
  include_line_manager: boolean;
  cross_dept_user_ids: string[];
  peer_user_ids: string[];
};

type EmployeeRow = { employee_id: string; full_name: string; job_title: string; manager_name: string | null; user_id: string | null };
type TemplateRow = { id: string; kind: "skill" | "behaviour"; name: string; role_family: string | null; job_titles: string[] };
type ProfileRow = { id: string; employee_id: string | null; full_name: string | null; manager_id: string | null };

function resolveEmployeeUsers(employee: EmployeeRow, profiles: ProfileRow[]) {
  const own = profiles.find((p) => p.employee_id === employee.employee_id) ?? null;
  const employeeUserId = employee.user_id ?? own?.id ?? null;
  const managerUserId =
    own?.manager_id ?? (employee.manager_name ? profiles.find((p) => p.full_name === employee.manager_name)?.id ?? null : null);
  return { employeeUserId, managerUserId };
}

async function createAssignmentsForEmployee(opts: {
  employee: EmployeeRow;
  employeeUserId: string | null;
  managerUserId: string | null;
  templates: TemplateRow[];
  wave: string | null;
  due_date: string | null;
  include_line_manager: boolean;
  cross_dept_user_ids: string[];
  peer_user_ids: string[];
  assignedBy: string;
}) {
  const supabase = await createClient();
  const { employee, employeeUserId, managerUserId } = opts;
  const created: string[] = [];
  const skipped: string[] = [];

  for (const tpl of opts.templates) {
    const { data: assignment, error } = await supabase
      .from("assessment_assignments")
      .insert({
        template_id: tpl.id,
        employee_id: employee.employee_id,
        employee_user_id: employeeUserId,
        wave: opts.wave,
        due_date: opts.due_date,
        assigned_by: opts.assignedBy,
      })
      .select("id")
      .single();
    if (error || !assignment) {
      skipped.push(error?.code === "23505" ? `${tpl.name} (already assigned)` : `${tpl.name} (${dbError(error ?? { message: "failed" })})`);
      continue;
    }
    created.push(tpl.name);

    const raters: { rater_user_id: string; rater_type: RaterType }[] = [];
    if (employeeUserId) raters.push({ rater_user_id: employeeUserId, rater_type: "self" });
    if (opts.include_line_manager && managerUserId && managerUserId !== employeeUserId) {
      raters.push({ rater_user_id: managerUserId, rater_type: "line_manager" });
    }
    const others = tpl.kind === "skill" ? opts.cross_dept_user_ids : opts.peer_user_ids;
    const otherType: RaterType = tpl.kind === "skill" ? "cross_dept" : "peer";
    for (const uid of new Set(others)) {
      if (uid && uid !== employeeUserId && uid !== managerUserId) raters.push({ rater_user_id: uid, rater_type: otherType });
    }
    if (raters.length) {
      await supabase.from("assessment_raters").insert(raters.map((r) => ({ ...r, assignment_id: assignment.id })));
    }

    const due = opts.due_date ? ` Due ${opts.due_date}.` : "";
    const notifications: Promise<unknown>[] = [];
    if (employeeUserId) {
      notifications.push(
        createNotification({
          user_id: employeeUserId,
          type: NOTIFICATION_TYPES.ASSESSMENT_ASSIGNED,
          title: `New assessment: ${tpl.name}`,
          body: `You have been asked to complete the ${tpl.kind === "skill" ? "skill" : "behaviour"} assessment.${due}`,
          link: "/assessments",
          metadata: { assignment_id: assignment.id, template_id: tpl.id, employee_id: employee.employee_id },
        })
      );
    }
    for (const r of raters.filter((r) => r.rater_type !== "self")) {
      notifications.push(
        createNotification({
          user_id: r.rater_user_id,
          type: NOTIFICATION_TYPES.ASSESSMENT_RATING_REQUESTED,
          title: `Please rate ${employee.full_name}`,
          body: `${tpl.name} - your input as ${RATER_LABELS[r.rater_type]} is requested.${due}`,
          link: "/assessments",
          metadata: { assignment_id: assignment.id, template_id: tpl.id, employee_id: employee.employee_id, rater_type: r.rater_type },
        })
      );
    }
    await Promise.all(notifications);
  }

  return { created, skipped };
}

export async function assignAssessments(input: AssignInput) {
  const { error: authError, profile } = await requireStaff();
  if (authError) return { error: authError };
  if (!input.employee_id) return { error: "Select an employee." };
  if (!input.template_ids.length) return { error: "Select at least one assessment." };

  const supabase = await createClient();
  const [{ data: employee }, { data: templates }, { data: profiles }] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title, manager_name, user_id")
      .eq("employee_id", input.employee_id)
      .single(),
    supabase
      .from("assessment_templates")
      .select("id, kind, name, role_family, job_titles")
      .in("id", input.template_ids)
      .eq("status", "published"),
    supabase.from("profiles").select("id, employee_id, full_name, manager_id"),
  ]);
  if (!employee) return { error: "Employee not found." };
  if (!templates?.length) return { error: "No published assessments selected." };

  const { employeeUserId, managerUserId } = resolveEmployeeUsers(employee, profiles ?? []);
  const { created, skipped } = await createAssignmentsForEmployee({
    employee,
    employeeUserId,
    managerUserId,
    templates,
    wave: input.wave,
    due_date: input.due_date,
    include_line_manager: input.include_line_manager,
    cross_dept_user_ids: input.cross_dept_user_ids,
    peer_user_ids: input.peer_user_ids,
    assignedBy: profile.id,
  });

  revalidateAll();
  return {
    success: true,
    created,
    skipped,
    warning: employeeUserId ? null : `${employee.full_name} has no user account yet; they will see the assessment once their account is linked.`,
  };
}

export type DepartmentAssignInput = {
  department: string;
  wave: string | null;
  due_date: string | null;
  include_skill: boolean;
  include_behaviour: boolean;
  include_line_manager: boolean;
  /** Nominate up to 3 peers per person from the same department (behaviour assessment). */
  auto_peers: boolean;
  /** Cross-departmental rater(s) applied to every skill assignment. */
  cross_dept_user_ids: string[];
};

const AUTO_PEER_COUNT = 3;

export async function assignAssessmentsToDepartment(input: DepartmentAssignInput) {
  const { error: authError, profile } = await requireAdmin();
  if (authError) return { error: authError };
  if (!input.department) return { error: "Select a department." };
  if (!input.include_skill && !input.include_behaviour) return { error: "Include at least one assessment type." };

  const supabase = await createClient();
  const [{ data: employees, error: empError }, { data: templates }, { data: profiles }] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_id, full_name, job_title, manager_name, user_id")
      .eq("active", true)
      .eq("department", input.department)
      .order("full_name"),
    supabase.from("assessment_templates").select("id, kind, name, role_family, job_titles").eq("status", "published"),
    supabase.from("profiles").select("id, employee_id, full_name, manager_id"),
  ]);
  if (empError) return { error: dbError(empError) };
  if (!employees?.length) return { error: `No active employees in ${input.department}.` };

  const published = templates ?? [];
  const behaviour = published.find((t) => t.kind === "behaviour") ?? null;
  if (input.include_behaviour && !behaviour) return { error: "No published behaviour assessment. Publish it in the library first." };

  const resolved = employees.map((e) => ({ employee: e, ...resolveEmployeeUsers(e, profiles ?? []) }));
  const peerPool = resolved.map((r) => r.employeeUserId);

  let created = 0;
  const skipped: string[] = [];
  const unmatched: string[] = [];
  const noAccount: string[] = [];

  for (let i = 0; i < resolved.length; i++) {
    const { employee, employeeUserId, managerUserId } = resolved[i];
    const tpls: TemplateRow[] = [];
    if (input.include_skill) {
      const match = matchSkillTemplate(employee.job_title, published);
      if (match) tpls.push(match);
      else unmatched.push(`${employee.full_name} (${employee.job_title})`);
    }
    if (input.include_behaviour && behaviour) tpls.push(behaviour);
    if (!tpls.length) continue;
    if (!employeeUserId) noAccount.push(employee.full_name);

    let peers: string[] = [];
    if (input.auto_peers) {
      const candidates = peerPool
        .map((uid, j) => ({ uid, j }))
        .filter(({ uid, j }) => uid && j !== i && uid !== managerUserId)
        .map(({ uid }) => uid as string);
      // Rotate the start so peer load spreads evenly across the department.
      const start = candidates.length ? i % candidates.length : 0;
      peers = [...candidates.slice(start), ...candidates.slice(0, start)].slice(0, AUTO_PEER_COUNT);
    }

    const result = await createAssignmentsForEmployee({
      employee,
      employeeUserId,
      managerUserId,
      templates: tpls,
      wave: input.wave,
      due_date: input.due_date,
      include_line_manager: input.include_line_manager,
      cross_dept_user_ids: input.cross_dept_user_ids,
      peer_user_ids: peers,
      assignedBy: profile.id,
    });
    created += result.created.length;
    skipped.push(...result.skipped.map((s) => `${employee.full_name}: ${s}`));
  }

  revalidateAll();
  return { success: true, total: employees.length, created, skipped, unmatched, noAccount };
}

const RATER_LABELS: Record<RaterType, string> = {
  self: "yourself",
  line_manager: "line manager",
  cross_dept: "cross-departmental rater",
  peer: "peer",
};

export async function releaseResults(assignmentId: string, released: boolean) {
  const { error: authError } = await requireStaff();
  if (authError) return { error: authError };
  const supabase = await createClient();
  const { data: assignment, error } = await supabase
    .from("assessment_assignments")
    .update({ results_released: released })
    .eq("id", assignmentId)
    .select("id, employee_user_id, template_id")
    .single();
  if (error || !assignment) return { error: error?.message ?? "Assignment not found." };

  if (released && assignment.employee_user_id) {
    const { data: tpl } = await supabase.from("assessment_templates").select("name").eq("id", assignment.template_id).single();
    await createNotification({
      user_id: assignment.employee_user_id,
      type: NOTIFICATION_TYPES.ASSESSMENT_RESULTS_RELEASED,
      title: `Your results are ready: ${tpl?.name ?? "assessment"}`,
      body: "Your line manager will walk you through them. You can review the report now.",
      link: `/assessments/${assignment.id}/report`,
      metadata: { assignment_id: assignment.id },
    });
  }
  revalidateAll();
  return { success: true };
}

export async function closeAssignment(assignmentId: string) {
  const { error: authError } = await requireStaff();
  if (authError) return { error: authError };
  const supabase = await createClient();
  const { error } = await supabase.from("assessment_assignments").update({ status: "closed" }).eq("id", assignmentId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

export async function deleteAssignment(assignmentId: string) {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  const supabase = await createClient();
  const { error } = await supabase.from("assessment_assignments").delete().eq("id", assignmentId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Taking the assessment (employee / raters)
// ---------------------------------------------------------------------------

export type SelfAnswer = { item_id: string; rating: number | null; scenario_answer: Letter | null };
export type RaterAnswer = { item_id: string; rating: number | null; not_observed: boolean; evidence: string | null };

async function ownSelfAssignment(assignmentId: string) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated" as const };
  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assessment_assignments")
    .select("id, employee_id, employee_user_id, status, assigned_by, template_id, started_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return { error: "Assessment not found." as const };
  const isMine = assignment.employee_user_id === profile.id || (profile.employee_id != null && assignment.employee_id === profile.employee_id);
  if (!isMine) return { error: "This assessment is not assigned to you." as const };
  if (assignment.status === "submitted" || assignment.status === "closed") return { error: "This assessment has already been submitted." as const };
  return { profile, supabase, assignment };
}

/** Starts the 30-minute clock. Idempotent: a second call returns the original start time. */
export async function startSelfAssessment(assignmentId: string) {
  const ctx = await ownSelfAssignment(assignmentId);
  if ("error" in ctx) return { error: ctx.error };
  const { profile, supabase, assignment } = ctx;
  if (assignment.started_at) return { success: true, started_at: assignment.started_at, server_now: Date.now() };

  const started_at = new Date().toISOString();
  const { error } = await supabase
    .from("assessment_assignments")
    .update({ started_at, status: "in_progress", employee_user_id: assignment.employee_user_id ?? profile.id })
    .eq("id", assignmentId);
  if (error) return { error: error.message };
  revalidateAll();
  return { success: true, started_at, server_now: Date.now() };
}

export async function saveSelfAssessment(
  assignmentId: string,
  answers: SelfAnswer[],
  aspiration: Record<string, string> | null,
  submit: boolean
) {
  const ctx = await ownSelfAssignment(assignmentId);
  if ("error" in ctx) return { error: ctx.error };
  const { profile, supabase, assignment } = ctx;
  if (!assignment.started_at) return { error: "Press Start to begin the assessment." };

  let { data: rater } = await supabase
    .from("assessment_raters")
    .select("id, status")
    .eq("assignment_id", assignmentId)
    .eq("rater_user_id", profile.id)
    .eq("rater_type", "self")
    .maybeSingle();
  if (!rater) {
    const { data: inserted, error } = await supabase
      .from("assessment_raters")
      .insert({ assignment_id: assignmentId, rater_user_id: profile.id, rater_type: "self" })
      .select("id, status")
      .single();
    if (error || !inserted) return { error: error?.message ?? "Could not start the assessment." };
    rater = inserted;
  }
  if (rater.status === "submitted") return { error: "Already submitted." };

  // Once the time limit has passed, any save finalises whatever has been answered.
  const timedOut = isExpired(assignment.started_at);
  const finalise = submit || timedOut;
  if (submit && !timedOut) {
    const incomplete = answers.filter((a) => a.rating == null || a.scenario_answer == null);
    if (incomplete.length) return { error: `Answer every rating and scenario before submitting (${incomplete.length} remaining).` };
  }

  if (answers.length) {
    const { error } = await supabase.from("assessment_responses").upsert(
      answers.map((a) => ({ rater_id: rater.id, item_id: a.item_id, rating: a.rating, scenario_answer: a.scenario_answer })),
      { onConflict: "rater_id,item_id" }
    );
    if (error) return { error: error.message };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("assessment_assignments")
    .update({
      aspiration: aspiration ?? undefined,
      status: finalise ? "submitted" : "in_progress",
      submitted_at: finalise ? now : null,
      employee_user_id: assignment.employee_user_id ?? profile.id,
    })
    .eq("id", assignmentId);
  if (updateError) return { error: updateError.message };

  if (finalise) {
    await supabase.from("assessment_raters").update({ status: "submitted", submitted_at: now }).eq("id", rater.id);
    if (assignment.assigned_by && assignment.assigned_by !== profile.id) {
      const { data: tpl } = await supabase.from("assessment_templates").select("name").eq("id", assignment.template_id).single();
      await createNotification({
        user_id: assignment.assigned_by,
        type: NOTIFICATION_TYPES.ASSESSMENT_SUBMITTED,
        title: `${profile.full_name ?? profile.email} submitted ${tpl?.name ?? "an assessment"}`,
        body: timedOut
          ? "Time limit reached; the self-assessment was submitted automatically. Rater inputs may still be pending."
          : "Self-assessment complete. Rater inputs may still be pending.",
        link: `/assessments/${assignmentId}/report`,
        metadata: { assignment_id: assignmentId },
      });
    }
  }

  revalidateAll();
  return { success: true, finalised: finalise, timedOut };
}

export async function startPeerAssessment(raterId: string) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated" };
  const supabase = await createClient();
  const { data: rater, error } = await supabase.from("assessment_raters")
    .select("id, assignment_id, status, started_at")
    .eq("id", raterId).eq("rater_user_id", profile.id).eq("rater_type", "peer").maybeSingle();
  if (error) return { error: error.message };
  if (!rater || rater.status === "submitted") return { error: "Peer assessment is unavailable." };
  const { data: assignment } = await supabase.from("assessment_assignments")
    .select("status").eq("id", rater.assignment_id).maybeSingle();
  if (!assignment || assignment.status === "closed") return { error: "Assessment is closed." };
  if (rater.started_at) return { started_at: rater.started_at, server_now: Date.now() };
  // Compare-and-set keeps simultaneous tabs from restarting the clock.
  const { error: startError } = await supabase.from("assessment_raters")
    .update({ started_at: new Date().toISOString() })
    .eq("id", raterId).eq("rater_user_id", profile.id).eq("status", "pending").is("started_at", null);
  if (startError) return { error: startError.message };
  const { data: started, error: readError } = await supabase.from("assessment_raters")
    .select("started_at").eq("id", raterId).eq("rater_user_id", profile.id).single();
  if (readError || !started?.started_at) return { error: "Could not start the assessment." };
  return { started_at: started.started_at, server_now: Date.now() };
}

export async function saveRaterAssessment(raterId: string, answers: RaterAnswer[], submit: boolean) {
  const profile = await currentProfile();
  if (!profile) return { error: "Not authenticated" };
  const supabase = await createClient();

  const { data: rater } = await supabase
    .from("assessment_raters")
    .select("id, status, rater_type, assignment_id, started_at")
    .eq("id", raterId)
    .eq("rater_user_id", profile.id)
    .maybeSingle();
  if (!rater) return { error: "Rating request not found." };
  if (rater.status === "submitted") return { error: "Already submitted." };
  if (rater.rater_type === "self") return { error: "Use the self-assessment form." };
  const { data: assignment } = await supabase.from("assessment_assignments")
    .select("status").eq("id", rater.assignment_id).maybeSingle();
  if (!assignment || assignment.status === "closed") return { error: "Assessment is closed." };
  const peer = rater.rater_type === "peer";
  if (peer && !rater.started_at) return { error: "Press Start to begin the peer assessment." };
  const { timedOut, acceptAnswers } = peer && rater.started_at
    ? peerTiming(rater.started_at)
    : { timedOut: false, acceptAnswers: true };
  const finalised = submit || timedOut;

  if (submit && !timedOut) {
    const incomplete = answers.filter((a) => a.rating == null && !a.not_observed);
    if (incomplete.length) return { error: `Rate every item or mark it "Not observed" (${incomplete.length} remaining).` };
  }

  // After the delivery grace period, finalise the saved draft without accepting late edits.
  if (answers.length && acceptAnswers) {
    const { error } = await supabase.from("assessment_responses").upsert(
      answers.map((a) => ({
        rater_id: rater.id,
        item_id: a.item_id,
        rating: a.not_observed ? null : a.rating,
        not_observed: a.not_observed,
        evidence: a.evidence,
      })),
      { onConflict: "rater_id,item_id" }
    );
    if (error) return { error: error.message };
  }

  if (finalised) {
    const { error } = await supabase
      .from("assessment_raters")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", rater.id);
    if (error) return { error: error.message };
  }

  revalidateAll();
  return { success: true, finalised, timedOut };
}

/** Suggests published templates for an employee based on their job title. */
export async function suggestTemplatesForEmployee(employeeId: string) {
  const supabase = await createClient();
  const [{ data: employee }, { data: templates }] = await Promise.all([
    supabase.from("employees").select("job_title").eq("employee_id", employeeId).single(),
    supabase.from("assessment_templates").select("id, kind, role_family, job_titles").eq("status", "published"),
  ]);
  const skill = matchSkillTemplate(employee?.job_title, templates ?? []);
  return (templates ?? []).filter((t) => t.kind === "behaviour" || t.id === skill?.id).map((t) => t.id);
}

export async function isAdminClientConfigured() {
  return createAdminClient() != null;
}

/** Records a report acknowledgement signature for the given role slot. */
export async function signAssessmentReport(assignmentId: string, slot: "employee" | "manager" | "hr", date?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase.from("profiles").select("role, employee_id, full_name").eq("id", user.id).single();
  if (!profile) return { error: "Profile not found." };

  const { data: assignment } = await supabase
    .from("assessment_assignments")
    .select("id, employee_id, employee_user_id, report_signatures")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!assignment) return { error: "Assessment not found." };

  const isSelf =
    assignment.employee_user_id === user.id || (profile.employee_id != null && assignment.employee_id === profile.employee_id);
  const allowed =
    (slot === "employee" && isSelf) || (slot === "hr" && profile.role === "admin") || (slot === "manager" && profile.role !== "employee");
  if (!allowed) return { error: "You cannot sign this section." };

  const at = date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : new Date().toISOString();
  const report_signatures = {
    ...((assignment.report_signatures ?? {}) as Record<string, unknown>),
    [slot]: { name: profile.full_name ?? user.email ?? "Signed", at },
  };
  const { error } = await supabase.from("assessment_assignments").update({ report_signatures }).eq("id", assignmentId);
  if (error) return { error: error.message };
  revalidatePath(`/assessments/${assignmentId}/report`);
  return { success: true };
}
