#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${1:-}"
SUPABASE_ENV="$HOME/competence-portal/supabase/docker/.env"

if [ -z "$BACKUP_DIR" ]; then
  BACKUP_DIR="$(find "$HOME/competence-portal/backups" -mindepth 1 -maxdepth 1 -type d | sort | tail -n 1)"
fi

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

for file in roles.sql schema.sql data.sql row-counts.txt; do
  if [ ! -f "$BACKUP_DIR/$file" ]; then
    echo "Missing $file in $BACKUP_DIR" >&2
    exit 1
  fi
done

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

cd "$BACKUP_DIR"

# Supabase Cloud may run newer Postgres versions than self-hosted.
sed -i.bak 's/^SET transaction_timeout/-- &/' schema.sql data.sql
grep -v 'ALTER ROLE "supabase_admin"' roles.sql > roles.restore.sql
awk '
  /^COPY "storage"."buckets_vectors"/ { skip = 1; next }
  /^COPY "storage"."vector_indexes"/ { skip = 1; next }
  skip && /^\\\.$/ { skip = 0; next }
  !skip { print }
' data.sql > data.restore.sql

echo "Restoring backup from $BACKUP_DIR"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  --host localhost \
  --port 5432 \
  --username "postgres.${POOLER_TENANT_ID}" \
  --dbname postgres \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.restore.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.restore.sql

echo "Restore completed. Self-hosted row counts:"
PGPASSWORD="$POSTGRES_PASSWORD" psql \
  --host localhost \
  --port 5432 \
  --username "postgres.${POOLER_TENANT_ID}" \
  --dbname postgres \
  --variable ON_ERROR_STOP=1 \
  --command "
select 'profiles' table_name, count(*) from public.profiles
union all select 'employees', count(*) from public.employees
union all select 'employee_courses', count(*) from public.employee_courses
union all select 'notifications', count(*) from public.notifications
union all select 'auth.users', count(*) from auth.users
order by table_name;
"
