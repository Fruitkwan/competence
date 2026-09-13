#!/usr/bin/env bash
set -euo pipefail

SUPABASE_ENV="$HOME/competence-portal/supabase/docker/.env"

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "Supabase env file not found: $SUPABASE_ENV" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$SUPABASE_ENV" | tail -n 1 | cut -d= -f2-)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

POSTGRES_PASSWORD="$(read_env_value POSTGRES_PASSWORD)"
POOLER_TENANT_ID="$(read_env_value POOLER_TENANT_ID)"

if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${POOLER_TENANT_ID:-}" ]; then
  echo "POSTGRES_PASSWORD and POOLER_TENANT_ID are required in $SUPABASE_ENV" >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"

psql \
  --host localhost \
  --port 5432 \
  --username "postgres.${POOLER_TENANT_ID}" \
  --dbname postgres \
  --variable ON_ERROR_STOP=1 \
  --command "
select 'auth.users' table_name, count(*) total, null::bigint with_department from auth.users
union all select 'employee_courses', count(*), null::bigint from public.employee_courses
union all select 'employees', count(*), count(department) from public.employees
union all select 'fcm_tokens', count(*), null::bigint from public.firebase_messaging_tokens
union all select 'notifications', count(*), null::bigint from public.notifications
union all select 'profiles', count(*), null::bigint from public.profiles
order by table_name;
" \
  --command "
select employee_id, full_name, department
from public.employees
order by employee_id
limit 10;
"
