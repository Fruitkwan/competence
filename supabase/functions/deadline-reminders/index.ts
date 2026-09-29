// supabase/functions/deadline-reminders/index.ts
//
// Daily cron job (pg_cron → net.http_post). Emails employees whose assessments
// are due soon (T-7 / T-3 / T-1 / overdue weekly) and chases outstanding raters
// once the employee has started. Sends via Microsoft Graph sendMail (app-only).
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (injected by runtime)
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET   (app registration)
//   MAIL_SENDER            mailbox to send from, e.g. performance@…
//   APP_URL                base URL for links, e.g. https://app.example.com
//   CRON_SECRET            bearer token required on every request
//   DRY_RUN                "1" → resolve + log only, skip Graph calls

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const TENANT = Deno.env.get("AZURE_TENANT_ID") ?? "";
const CLIENT_ID = Deno.env.get("AZURE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("AZURE_CLIENT_SECRET") ?? "";
const SENDER = Deno.env.get("MAIL_SENDER") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const DRY_RUN = ["1", "true"].includes((Deno.env.get("DRY_RUN") ?? "").toLowerCase());

const DAY = 86_400_000;

function stageFor(daysUntil: number): string | null {
  if (daysUntil === 7) return "t_minus_7";
  if (daysUntil === 3) return "t_minus_3";
  if (daysUntil === 1) return "t_minus_1";
  if (daysUntil <= 0) {
    // ISO-ish week bucket → overdue reminders resend at most weekly.
    const d = new Date();
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - jan1.getTime()) / DAY + jan1.getUTCDay() + 1) / 7);
    return `overdue_w${d.getUTCFullYear()}_${week}`;
  }
  return null;
}

function stageLabel(stage: string): string {
  if (stage === "t_minus_7") return "due in 7 days";
  if (stage === "t_minus_3") return "due in 3 days";
  if (stage === "t_minus_1") return "due tomorrow";
  return "overdue";
}

interface DueItem {
  assignmentId: string;
  raterId: string | null;
  employeeName: string;
  assessmentName: string;
  dueDate: string;
  stage: string;
  link: string;
}

let cachedToken: { token: string; exp: number } | null = null;

async function graphToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) return cachedToken.token;
  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  if (!resp.ok) throw new Error(`Token request failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  cachedToken = { token: json.access_token, exp: now + Number(json.expires_in ?? 3600) };
  return cachedToken.token;
}

function renderEmail(recipientName: string, items: DueItem[]): { subject: string; html: string } {
  const anyOverdue = items.some((i) => i.stage.startsWith("overdue"));
  const subject = anyOverdue
    ? `Overdue: ${items.length} assessment${items.length > 1 ? "s" : ""} need${items.length > 1 ? "" : "s"} your attention`
    : `Reminder: assessment deadline approaching`;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = items
    .map((i) => {
      const overdue = i.stage.startsWith("overdue");
      return `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #eee">${esc(i.assessmentName)}<br><span style="color:#64748b;font-size:12px">${esc(i.employeeName)}</span></td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:nowrap;${overdue ? "color:#dc2626;font-weight:600" : ""}">${esc(i.dueDate)}<br><span style="font-size:12px;color:#64748b">${stageLabel(i.stage)}</span></td>
        <td style="padding:10px 12px;border-bottom:1px solid #eee"><a href="${i.link}" style="color:#2563eb">Open</a></td>
      </tr>`;
    })
    .join("");
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:560px;color:#0f172a">
    <h2 style="margin:0 0 8px">Assessment deadline${items.length > 1 ? "s" : ""}</h2>
    <p style="margin:0 0 16px;color:#475569">Hi ${esc(recipientName)}, the following assessment${items.length > 1 ? "s are" : " is"} waiting on you:</p>
    <table style="border-collapse:collapse;width:100%;font-size:14px">
      <tr style="text-align:left;color:#64748b;font-size:12px">
        <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">Assessment</th>
        <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0">Due</th>
        <th style="padding:8px 12px;border-bottom:2px solid #e2e8f0"></th>
      </tr>${rows}
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
      You are receiving this because you have an outstanding assessment in the Competence Hub.
    </p>
  </div>`;
  return { subject, html };
}

async function sendMail(to: string, name: string, items: DueItem[]): Promise<string> {
  const { subject, html } = renderEmail(name, items);
  const token = await graphToken();
  const resp = await fetch(`https://graph.microsoft.com/v1.0/users/${SENDER}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: to, name } }],
      },
      saveToSentItems: true,
    }),
  });
  if (!resp.ok) return `graph_${resp.status}`;
  return "sent";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const auth = req.headers.get("Authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!TENANT || !CLIENT_ID || !CLIENT_SECRET || !SENDER) {
    return new Response("Mail secrets not configured", { status: 500 });
  }

  // 1. Open assignments with a due date.
  const { data: assignments, error: aErr } = await supabase
    .from("assessment_assignments")
    .select("id, employee_id, employee_user_id, template_id, due_date, status")
    .is("deleted_at", null)
    .in("status", ["assigned", "in_progress"])
    .not("due_date", "is", null);
  if (aErr) return new Response(aErr.message, { status: 500 });

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const due = (assignments ?? [])
    .map((a) => {
      const dueDate = new Date(`${a.due_date}T00:00:00Z`);
      const daysUntil = Math.round((dueDate.getTime() - todayUtc.getTime()) / DAY);
      return { ...a, stage: stageFor(daysUntil) };
    })
    .filter((a): a is typeof a & { stage: string } => a.stage !== null);

  if (!due.length) return Response.json({ sent: 0, skipped: 0, failed: 0, dryRun: DRY_RUN });

  const ids = due.map((a) => a.id);

  // 2. Related rows: raters, employees, templates.
  const [{ data: raters }, { data: employees }, { data: templates }] = await Promise.all([
    supabase
      .from("assessment_raters")
      .select("id, assignment_id, rater_user_id, rater_type, status")
      .in("assignment_id", ids),
    supabase
      .from("employees")
      .select("employee_id, full_name, user_id")
      .in("employee_id", [...new Set(due.map((a) => a.employee_id))]),
    supabase
      .from("assessment_templates")
      .select("id, name, role_family, kind")
      .in("id", [...new Set(due.map((a) => a.template_id))]),
  ]);

  const empById = new Map((employees ?? []).map((e) => [e.employee_id, e]));
  const tplById = new Map((templates ?? []).map((t) => [t.id, t]));
  const ratersByAssignment = new Map<string, NonNullable<typeof raters>>();
  for (const r of raters ?? []) {
    const list = ratersByAssignment.get(r.assignment_id) ?? [];
    list.push(r);
    ratersByAssignment.set(r.assignment_id, list);
  }

  // 3. Resolve emails for every involved user.
  const userIds = new Set<string>();
  for (const a of due) {
    if (a.employee_user_id) userIds.add(a.employee_user_id);
    const emp = empById.get(a.employee_id);
    if (emp?.user_id) userIds.add(emp.user_id);
    for (const r of ratersByAssignment.get(a.id) ?? []) userIds.add(r.rater_user_id);
  }
  const { data: profiles } = userIds.size
    ? await supabase.from("profiles").select("id, email, full_name, is_active").in("id", [...userIds])
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  // 4. Existing log rows → dedup keys.
  const { data: logs } = await supabase
    .from("email_reminder_log")
    .select("assignment_id, rater_id, stage, recipient")
    .in("assignment_id", ids);
  const seen = new Set(
    (logs ?? []).map((l) => `${l.assignment_id}|${l.rater_id ?? ""}|${l.stage}|${l.recipient}`),
  );

  // 5. Build per-recipient digests.
  const digests = new Map<string, { name: string; items: DueItem[] }>();
  let skipped = 0;

  const addItem = (email: string | null | undefined, name: string, item: DueItem) => {
    if (!email) { skipped += 1; return; }
    if (seen.has(`${item.assignmentId}|${item.raterId ?? ""}|${item.stage}|${email}`)) {
      skipped += 1;
      return;
    }
    const d = digests.get(email) ?? { name, items: [] };
    d.items.push(item);
    digests.set(email, d);
  };

  for (const a of due) {
    const emp = empById.get(a.employee_id);
    const tpl = tplById.get(a.template_id);
    const assessmentName = tpl?.role_family ?? tpl?.name ?? "Assessment";
    const employeeName = emp?.full_name ?? a.employee_id;
    const employeeUserId = a.employee_user_id ?? emp?.user_id ?? null;
    const employeeProfile = employeeUserId ? profileById.get(employeeUserId) : null;

    if (employeeProfile?.is_active !== false) {
      addItem(employeeProfile?.email, employeeName, {
        assignmentId: a.id,
        raterId: null,
        employeeName,
        assessmentName,
        dueDate: a.due_date,
        stage: a.stage,
        link: `${APP_URL}/assessments/${a.id}/take`,
      });
    }

    // Raters: only chase once the employee has started / submitted self.
    const rs = ratersByAssignment.get(a.id) ?? [];
    const selfDone =
      a.status === "in_progress" ||
      rs.some((r) => r.rater_type === "self" && r.status === "submitted");
    if (selfDone) {
      for (const r of rs.filter((r) => r.rater_type !== "self" && r.status !== "submitted")) {
        const p = profileById.get(r.rater_user_id);
        if (p?.is_active === false) continue;
        addItem(p?.email, p?.full_name ?? "there", {
          assignmentId: a.id,
          raterId: r.id,
          employeeName,
          assessmentName,
          dueDate: a.due_date,
          stage: a.stage,
          link: `${APP_URL}/assessments`,
        });
      }
    }
  }

  // 6. Send + log.
  let sent = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const [email, digest] of digests) {
    let status = "sent";
    if (DRY_RUN) {
      console.log(`DRY_RUN → ${email}: ${digest.items.length} item(s)`, digest.items.map((i) => `${i.assessmentName} (${i.stage})`));
      status = "dry_run";
    } else {
      try {
        status = await sendMail(email, digest.name, digest.items);
      } catch (e) {
        status = `error:${String(e).slice(0, 120)}`;
      }
    }
    if (status === "sent" || status === "dry_run") sent += 1;
    else {
      failed += 1;
      failures.push(`${email}: ${status}`);
    }
    if (!DRY_RUN && status === "sent") {
      await supabase.from("email_reminder_log").upsert(
        digest.items.map((i) => ({
          assignment_id: i.assignmentId,
          rater_id: i.raterId,
          stage: i.stage,
          recipient: email,
          graph_status: status,
        })),
        { onConflict: "assignment_id,rater_id,stage,recipient", ignoreDuplicates: true },
      );
    }
  }

  return Response.json({
    sent,
    skipped,
    failed,
    dryRun: DRY_RUN,
    failures: failures.slice(0, 10),
    recipients: digests.size,
    dueAssignments: due.length,
  });
});
