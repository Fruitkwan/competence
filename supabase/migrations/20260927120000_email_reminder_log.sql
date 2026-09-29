-- Assessment deadline email reminders: dedup/audit log for the
-- deadline-reminders edge function + scheduling prerequisites.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.email_reminder_log (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assessment_assignments(id) on delete cascade,
  rater_id      uuid references public.assessment_raters(id) on delete cascade,
  stage         text not null,  -- 't_minus_7' | 't_minus_3' | 't_minus_1' | 'overdue_w<isoWeek>'
  recipient     text not null,
  sent_at       timestamptz not null default now(),
  graph_status  text not null default 'sent',
  unique (assignment_id, rater_id, stage, recipient)
);

alter table public.email_reminder_log enable row level security;
-- No policies: service-role only. Admins can inspect via SQL if needed.

create index if not exists idx_email_reminder_log_lookup
  on public.email_reminder_log (assignment_id, stage, sent_at);

comment on table public.email_reminder_log is
  'Dedup + audit log for assessment deadline reminder emails (edge function deadline-reminders).';

-- Scheduling: a pg_cron job POSTs daily to the edge function with a bearer
-- secret matching the function's CRON_SECRET env. Applied out-of-band on this
-- project (the secret must not live in the repo). To recreate it:
--
--   select cron.schedule('assessment-deadline-reminders', '0 7 * * *', $$
--     select net.http_post(
--       url     := 'https://<project-ref>.supabase.co/functions/v1/deadline-reminders',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer <CRON_SECRET>',
--         'Content-Type', 'application/json'),
--       body := '{}'::jsonb);
--   $$);
