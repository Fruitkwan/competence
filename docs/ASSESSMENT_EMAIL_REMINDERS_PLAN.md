# Plan: Assessment Deadline Email Reminders via Microsoft Graph

Send automated email reminders to employees (and their outstanding raters) as
assessment `due_date`s approach, using Microsoft Graph `sendMail` with an
app-only (client credentials) flow on our existing Azure tenant.

## 1. Architecture

```
Supabase Cron (pg_cron, daily 07:00)
        │  net.http_post
        ▼
Edge Function: supabase/functions/deadline-reminders
        │  service-role queries
        ├─ assessment_assignments (due within window, not submitted/closed)
        ├─ employees / profiles (recipient emails)
        ├─ assessment_raters (outstanding raters → their emails)
        │
        ├─ check email_reminder_log (dedup — one email per assignment+stage)
        │
        ▼
Microsoft Graph  POST /users/{sender}/sendMail
   (client credentials → token from login.microsoftonline.com)
        │
        ▼
   email_reminder_log insert  (+ optional in-app notification row)
```

**Why app-only Graph:** reminders are system mail, not user mail. Client
credentials (`Mail.Send` **application** permission) let the function send from
a shared mailbox (e.g. `performance@dhofarglobal.com`) without storing user
credentials or refresh tokens.

**Why a Supabase Edge Function + pg_cron** (vs Vercel Cron + API route):
the function already has `SUPABASE_SERVICE_ROLE_KEY` injected, mirrors the
existing `push-fanout` pattern, and the schedule lives inside Supabase next to
the data — no extra Vercel env wiring. Vercel Cron is the documented fallback
(Option B below).

## 2. Azure / Entra ID setup (manual, one-time)

1. Entra admin center → **App registrations → New registration**
   - Name: `Competence Hub – Deadline Mailer`, single tenant.
2. **API permissions → Add → Microsoft Graph → Application → `Mail.Send`**
   - Grant **admin consent**.
   - (Recommended) Restrict scope with an Exchange **application access
     policy** so the app can only send as the shared mailbox, not anyone.
3. **Certificates & secrets → New client secret** — record the *value* (not ID).
4. Prepare a sender: shared mailbox or licensed user, e.g.
   `performance@dhofarglobal.com`.
5. Collect: `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
   `MAIL_SENDER`.

## 3. Database changes (migration)

New table `email_reminder_log` — dedup + audit trail:

```sql
create table public.email_reminder_log (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assessment_assignments(id) on delete cascade,
  rater_id      uuid references assessment_raters(id) on delete cascade, -- null = the employee
  stage         text not null,            -- 't_minus_7' | 't_minus_3' | 't_minus_1' | 'overdue'
  recipient     text not null,
  sent_at       timestamptz not null default now(),
  graph_status  text,                     -- 'sent' | error code
  unique (assignment_id, rater_id, stage, recipient)
);
```

RLS: no public access (service-role only writes/reads). No `deleted_at`
needed — it isn't user-facing.

## 4. Edge Function: `deadline-reminders`

`supabase/functions/deadline-reminders/index.ts` (Deno, mirrors `push-fanout`):

1. **Auth gate:** require `Authorization: Bearer <CRON_SECRET>` header so only
   the cron job can invoke it.
2. **Query** `assessment_assignments` where
   `deleted_at is null`, `status in ('assigned','in_progress')`,
   `due_date` in {`today+7`, `today+3`, `today+1`, `today`} **or** `< today`
   (overdue, remind weekly max — see stage rules).
3. **Resolve recipients:**
   - Employee: `employees.user_id`/`employee_user_id` → `profiles.email`
     (fallback: employee work email column if present).
   - Raters: `assessment_raters` where `status != 'submitted'` and
     `rater_type != 'self'` → `profiles.email`. Only remind raters once the
     self-assessment is in (`status = 'in_progress'` or self rater submitted)
     — avoids chasing raters before the employee has even started.
4. **Dedup:** skip rows already in `email_reminder_log` for that
   `(assignment_id, rater_id, stage)`.
5. **Graph token:** `POST /{tenant}/oauth2/v2.0/token` with
   `client_credentials`, scope `https://graph.microsoft.com/.default`;
   cache in-memory for the run.
6. **Send:** `POST /v1.0/users/{MAIL_SENDER}/sendMail` per recipient
   (one email per person, not per assignment — batch multiple assignments for
   the same person into one digest email).
7. **Log** each send to `email_reminder_log`; continue on individual
   failures, return a JSON summary `{ sent, skipped, failed }`.

### Reminder stages

| Stage        | Trigger                          | Frequency cap        |
|--------------|----------------------------------|----------------------|
| `t_minus_7`  | due in 7 days                    | once                 |
| `t_minus_3`  | due in 3 days                    | once                 |
| `t_minus_1`  | due tomorrow                     | once                 |
| `overdue`    | past due                         | once per 7 days      |

### Email template (plain + simple HTML)

- Subject: `Reminder: {assessment name} due {date}` (or `Overdue: …`)
- Body: employee name, assessment name, due date, deep link
  `{APP_URL}/assessments/{assignment_id}/take` for the employee and
  `{APP_URL}/assessments/rate/{rater_id}` for raters.
- Optional footer: "You are receiving this because …" + HR contact.

## 5. Scheduling

Supabase Cron (requires `pg_cron` + `pg_net` extensions — check first):

```sql
select cron.schedule(
  'assessment-deadline-reminders',
  '0 7 * * *',  -- 07:00 UTC daily
  $$
  select net.http_post(
    url     := 'https://giknnmtnlsjzphjzkfcq.supabase.co/functions/v1/deadline-reminders',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || '<CRON_SECRET>',
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
  $$);
```

Store `CRON_SECRET` as an edge-function secret and verify it in the handler.

## 6. Env vars / secrets

Edge function secrets (`supabase secrets set`):

```
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
MAIL_SENDER=performance@…
APP_URL=https://<vercel-domain>
CRON_SECRET=<random>
```

Nothing client-side — all secrets stay in the edge function.

## 7. Option B — Vercel Cron fallback

If cron inside Supabase is undesirable:

- `src/app/api/cron/deadline-reminders/route.ts` — same logic using
  `createAdminClient()`; guarded by `Authorization: Bearer $CRON_SECRET`
  (Vercel sends this automatically when `CRON_SECRET` env is set).
- `vercel.json`: `{ "crons": [{ "path": "/api/cron/deadline-reminders", "schedule": "0 7 * * *" }] }`
- Same Graph code in a shared `src/lib/graph/send-mail.ts`.

Keep the edge function as the primary plan; implement B only if cron
scheduling proves unreliable.

## 8. In-app + push (optional, same run)

For each email sent, also insert a `notifications` row
(`type: 'assessment_deadline_reminder'` — add to `notification-types.ts`) so
the same reminder appears in the bell and triggers the existing
`push-fanout` → FCM path. Cheap because the function already touches
Supabase. Decide: nice-to-have, not required for v1.

## 9. Testing

1. **Dry-run mode:** `DRY_RUN=1` secret → resolve recipients, log what would
   be sent, skip Graph call. Verify counts in function logs.
2. **Test mailbox:** point `MAIL_SENDER`/recipients at a test account; seed a
   dummy assignment due tomorrow; invoke function manually
   (`supabase functions invoke` or curl with the bearer secret).
3. **Dedup:** invoke twice — second run sends 0.
4. **Rater gating:** confirm raters are not emailed while the employee
   hasn't started.
5. **Cron:** check `cron.job_run_details` after the first scheduled run.

## 10. Rollout

1. Apply migration (`email_reminder_log`).
2. Azure app registration + consent (manual — needs Entra admin).
3. Deploy function, set secrets, `DRY_RUN=1`.
4. Schedule cron; monitor first run in logs.
5. `DRY_RUN=0` → live.

## 11. Risks / notes

- `Mail.Send` application permission is powerful — restrict it to the sender
  mailbox via Exchange application access policy.
- Graph throttling: batch sends with small delays; we send ≤ a few hundred
  per run, well under limits.
- Employee emails must exist in `profiles` — add a fallback report listing
  due assignments whose employee has no email (log them, alert admin).
- Overdue spam: the 7-day overdue cap prevents daily nagging.
