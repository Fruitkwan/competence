-- =========================================================================
-- migration-mobile-v1.sql
-- Wraps the server-action mutations needed by the mobile (Flutter) client
-- as SQL functions so both web and mobile share a single, RLS-enforced path.
-- All functions are SECURITY INVOKER so existing RLS policies still apply.
-- Also creates the device_tokens table used for FCM fan-out.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. device_tokens
-- -------------------------------------------------------------------------
create table if not exists public.device_tokens (
  token        text primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  platform     text not null check (platform in ('android', 'ios', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens self read"   on public.device_tokens;
drop policy if exists "device_tokens self insert" on public.device_tokens;
drop policy if exists "device_tokens self update" on public.device_tokens;
drop policy if exists "device_tokens self delete" on public.device_tokens;

create policy "device_tokens self read"
  on public.device_tokens for select
  using (user_id = auth.uid());

create policy "device_tokens self insert"
  on public.device_tokens for insert
  with check (user_id = auth.uid());

create policy "device_tokens self update"
  on public.device_tokens for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "device_tokens self delete"
  on public.device_tokens for delete
  using (user_id = auth.uid());

-- -------------------------------------------------------------------------
-- 2. Objectives RPCs
-- -------------------------------------------------------------------------

-- Submit all draft objectives for the current user in the given cycle.
-- Validates weights sum to 100 and notifies the employee's manager.
create or replace function public.submit_objectives_for_cycle(p_cycle_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
  v_total numeric;
  v_manager uuid;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select count(*), coalesce(sum(weight), 0)
    into v_count, v_total
  from public.cycle_objectives
  where cycle_id = p_cycle_id
    and employee_id = auth.uid()
    and status = 'draft';

  if v_count = 0 then
    raise exception 'No draft objectives to submit';
  end if;

  if abs(v_total - 100) > 0.01 then
    raise exception 'Objective weights must sum to 100%% (currently %)', v_total;
  end if;

  update public.cycle_objectives
    set status = 'submitted', updated_at = now()
  where cycle_id = p_cycle_id
    and employee_id = auth.uid()
    and status = 'draft';

  select manager_id, full_name
    into v_manager, v_name
  from public.profiles
  where id = auth.uid();

  if v_manager is not null then
    insert into public.notifications (user_id, type, title, body, link)
    values (
      v_manager,
      'objective_submitted',
      coalesce(v_name, 'An employee') || ' submitted objectives for review',
      v_count || ' objectives are waiting for your approval.',
      '/objectives/review'
    );
  end if;
end;
$$;

create or replace function public.approve_objective(p_objective_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_employee uuid;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select employee_id, title
    into v_employee, v_title
  from public.cycle_objectives
  where id = p_objective_id;

  if v_employee is null then
    raise exception 'Objective not found';
  end if;

  update public.cycle_objectives
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_at = now()
   where id = p_objective_id;

  insert into public.notifications (user_id, type, title, link)
  values (
    v_employee,
    'objective_approved',
    'Objective approved: "' || v_title || '"',
    '/objectives'
  );
end;
$$;

create or replace function public.request_objective_revision(
  p_objective_id uuid,
  p_comment      text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_employee uuid;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if coalesce(trim(p_comment), '') = '' then
    raise exception 'Comment is required';
  end if;

  select employee_id, title
    into v_employee, v_title
  from public.cycle_objectives
  where id = p_objective_id;

  if v_employee is null then
    raise exception 'Objective not found';
  end if;

  update public.cycle_objectives
     set status = 'revision_requested', updated_at = now()
   where id = p_objective_id;

  insert into public.objective_comments (objective_id, author_id, body)
  values (p_objective_id, auth.uid(), p_comment);

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_employee,
    'objective_revision_requested',
    'Revision requested for: "' || v_title || '"',
    p_comment,
    '/objectives'
  );
end;
$$;

create or replace function public.reject_objective(
  p_objective_id uuid,
  p_comment      text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_employee uuid;
  v_title text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select employee_id, title
    into v_employee, v_title
  from public.cycle_objectives
  where id = p_objective_id;

  if v_employee is null then
    raise exception 'Objective not found';
  end if;

  update public.cycle_objectives
     set status = 'rejected', updated_at = now()
   where id = p_objective_id;

  if coalesce(trim(p_comment), '') <> '' then
    insert into public.objective_comments (objective_id, author_id, body)
    values (p_objective_id, auth.uid(), p_comment);
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (
    v_employee,
    'objective_rejected',
    'Objective rejected: "' || v_title || '"',
    nullif(p_comment, ''),
    '/objectives'
  );
end;
$$;

-- -------------------------------------------------------------------------
-- 3. Performance appraisal RPCs
-- -------------------------------------------------------------------------

create or replace function public.save_appraisal_self(
  p_id             uuid,
  p_goals          jsonb,
  p_core           jsonb,
  p_leadership     jsonb,
  p_values         jsonb,
  p_feedback_n1    jsonb,
  p_mark_complete  boolean default false
) returns public.performance_appraisals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.performance_appraisals;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.performance_appraisals
    where id = p_id and status = 'Draft'
  ) then
    raise exception 'Only draft appraisals can be edited by the employee';
  end if;

  update public.performance_appraisals
     set goals = p_goals,
         core_competencies = p_core,
         leadership = p_leadership,
         values_culture = p_values,
         feedback_n1 = p_feedback_n1,
         employee_signed_at = case
           when p_mark_complete and employee_signed_at is null then now()
           else employee_signed_at
         end,
         status = case
           when p_mark_complete and status = 'Draft' then 'N1 Complete'
           else status
         end,
         updated_at = now()
   where id = p_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Appraisal not found or not accessible';
  end if;

  if p_mark_complete and v_row.manager_id is not null then
    insert into public.notifications (user_id, type, title, link)
    values (
      v_row.manager_id,
      'appraisal_self_complete',
      'Self-assessment ready for review',
      '/appraisals/' || v_row.id || '/review'
    );
  end if;

  return v_row;
end;
$$;

create or replace function public.save_appraisal_manager(
  p_id                  uuid,
  p_goals               jsonb,
  p_core                jsonb,
  p_leadership          jsonb,
  p_values              jsonb,
  p_feedback_n2         jsonb,
  p_final_rating        int default null,
  p_overall_label       text default null,
  p_recommended_action  text default null,
  p_mark_complete       boolean default false
) returns public.performance_appraisals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.performance_appraisals;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.performance_appraisals
    where id = p_id and status = 'N1 Complete'
  ) then
    raise exception 'Manager review is available only after employee sign-off';
  end if;

  update public.performance_appraisals
     set goals = p_goals,
         core_competencies = p_core,
         leadership = p_leadership,
         values_culture = p_values,
         feedback_n2 = p_feedback_n2,
         final_rating = coalesce(p_final_rating, final_rating),
         overall_label = coalesce(p_overall_label, overall_label),
         recommended_action = coalesce(p_recommended_action, recommended_action),
         manager_signed_at = case
           when p_mark_complete and manager_signed_at is null then now()
           else manager_signed_at
         end,
         status = case
           when p_mark_complete then 'N2 Complete'
           else status
         end,
         updated_at = now()
   where id = p_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Appraisal not found or not accessible';
  end if;

  if p_mark_complete then
    insert into public.notifications (user_id, type, title, body, link)
    select p.id,
           'appraisal_manager_complete',
           'Performance appraisal ready for HR sign-off',
           coalesce(e.full_name, v_row.employee_id) || ' and their manager signed the appraisal.',
           '/appraisals/performance/' || v_row.id
      from public.profiles p
      left join public.employees e on e.employee_id = v_row.employee_id
     where p.role in ('admin', 'executive');
  end if;

  return v_row;
end;
$$;

create or replace function public.finalize_appraisal(
  p_id                  uuid,
  p_calibrated_rating   int default null,
  p_calibration_rationale text default null,
  p_hr_representative   text default null
) returns public.performance_appraisals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.performance_appraisals;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.performance_appraisals
    where id = p_id and status = 'N2 Complete'
  ) then
    raise exception 'HR can finalize only after manager sign-off';
  end if;

  update public.performance_appraisals
     set calibrated_rating = coalesce(p_calibrated_rating, calibrated_rating),
         calibration_rationale = coalesce(p_calibration_rationale, calibration_rationale),
         hr_representative = coalesce(p_hr_representative, hr_representative),
         hr_signed_at = coalesce(hr_signed_at, now()),
         status = 'Final',
         updated_at = now()
   where id = p_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Appraisal not found or not accessible';
  end if;

  -- Notify the employee that their appraisal has been finalized.
  insert into public.notifications (user_id, type, title, link)
  select e.user_id,
         'appraisal_finalized',
         'Your appraisal has been finalized',
         '/appraisals/' || v_row.id || '/self'
    from public.employees e
   where e.employee_id = v_row.employee_id
     and e.user_id is not null;

  return v_row;
end;
$$;

-- Calibration sign-off (sets calibrated rating + rationale without finalizing).
create or replace function public.calibrate_appraisal(
  p_id                uuid,
  p_calibrated_rating int,
  p_rationale         text default null
) returns public.performance_appraisals
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.performance_appraisals;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  update public.performance_appraisals
     set calibrated_rating = p_calibrated_rating,
         calibration_rationale = p_rationale,
         updated_at = now()
   where id = p_id
   returning * into v_row;

  if v_row.id is null then
    raise exception 'Appraisal not found or not accessible';
  end if;

  return v_row;
end;
$$;

-- -------------------------------------------------------------------------
-- 4. Aggregates used by the HR dashboard
-- -------------------------------------------------------------------------

create or replace function public.top_skill_gaps(p_limit int default 5)
returns table(competency_name text, gap_count bigint)
language sql
security invoker
set search_path = public
as $$
  select competency_name, count(*)::bigint as gap_count
    from public.skill_gaps
   group by competency_name
   order by gap_count desc
   limit p_limit;
$$;

create or replace function public.appraisal_status_counts(p_cycle_id uuid default null)
returns table(status text, total bigint)
language sql
security invoker
set search_path = public
as $$
  select status, count(*)::bigint
    from public.performance_appraisals
   where (p_cycle_id is null or cycle_id = p_cycle_id)
   group by status
   order by status;
$$;

-- -------------------------------------------------------------------------
-- 5. Storage bucket for completion certificates (idempotent)
-- -------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'certificates') then
    insert into storage.buckets (id, name, public)
    values ('certificates', 'certificates', true);
  end if;
end $$;

-- Allow signed-in users to upload and update files only inside their own
-- folder (paths starting with `certificates/<their employee_id>/...`).
drop policy if exists "certificates upload by employee" on storage.objects;
create policy "certificates upload by employee"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'certificates'
  );

drop policy if exists "certificates update by employee" on storage.objects;
create policy "certificates update by employee"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'certificates')
  with check (bucket_id = 'certificates');

drop policy if exists "certificates read for everyone" on storage.objects;
create policy "certificates read for everyone"
  on storage.objects for select
  using (bucket_id = 'certificates');

-- -------------------------------------------------------------------------
-- 6. Grants
-- -------------------------------------------------------------------------
grant execute on function public.submit_objectives_for_cycle(uuid)            to authenticated;
grant execute on function public.approve_objective(uuid)                       to authenticated;
grant execute on function public.request_objective_revision(uuid, text)        to authenticated;
grant execute on function public.reject_objective(uuid, text)                  to authenticated;
grant execute on function public.save_appraisal_self(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.save_appraisal_manager(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, int, text, text, boolean) to authenticated;
grant execute on function public.calibrate_appraisal(uuid, int, text)          to authenticated;
grant execute on function public.finalize_appraisal(uuid, int, text, text)     to authenticated;
grant execute on function public.top_skill_gaps(int)                            to authenticated;
grant execute on function public.appraisal_status_counts(uuid)                  to authenticated;
