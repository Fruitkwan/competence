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

if [ "$#" -eq 0 ]; then
  set -- \
    "$HOME/competence-portal/scripts/migration-employee-import.sql" \
    "$HOME/competence-portal/scripts/migration-firebase-notifications.sql"
fi

PSQL_ARGS=(
  --host localhost
  --port 5432
  --username "postgres.${POOLER_TENANT_ID}"
  --dbname postgres
  --variable ON_ERROR_STOP=1
)

for migration in "$@"; do
  if [ ! -f "$migration" ]; then
    echo "Migration not found: $migration" >&2
    exit 1
  fi

  echo "Applying $migration"
  PGPASSWORD="$POSTGRES_PASSWORD" psql "${PSQL_ARGS[@]}" --file "$migration"
done

echo "Migrations applied."
