#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$HOME/competence-portal/app}"
SUPABASE_ENV="$HOME/competence-portal/supabase/docker/.env"
WEB_ENV="$APP_DIR/.env"

if [ ! -f "$SUPABASE_ENV" ]; then
  echo "Supabase env file not found: $SUPABASE_ENV" >&2
  exit 1
fi

read_env_value() {
  local key="$1"
  local value
  value="$(grep -E "^${key}=" "$SUPABASE_ENV" | tail -n 1 | cut -d= -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  printf '%s' "$value"
}

first_value() {
  local value
  for key in "$@"; do
    value="$(read_env_value "$key")"
    if [ -n "$value" ]; then
      printf '%s' "$value"
      return 0
    fi
  done
}

SUPABASE_PUBLIC_URL="$(first_value SUPABASE_PUBLIC_URL API_EXTERNAL_URL)"
SUPABASE_PUBLISHABLE_KEY="$(first_value SUPABASE_PUBLISHABLE_KEY PUBLISHABLE_KEY ANON_KEY)"
SUPABASE_SERVICE_ROLE_KEY="$(first_value SUPABASE_SECRET_KEY SECRET_KEY SERVICE_ROLE_KEY)"

if [ -z "${SUPABASE_PUBLIC_URL:-}" ]; then
  echo "Could not find SUPABASE_PUBLIC_URL or API_EXTERNAL_URL in $SUPABASE_ENV" >&2
  exit 1
fi

if [ -z "${SUPABASE_PUBLISHABLE_KEY:-}" ]; then
  echo "Could not find a Supabase publishable/anon key in $SUPABASE_ENV" >&2
  exit 1
fi

if [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "Could not find a Supabase service/secret key in $SUPABASE_ENV" >&2
  exit 1
fi

mkdir -p "$APP_DIR"
cat > "$WEB_ENV" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_PUBLIC_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
EOF

chmod 600 "$WEB_ENV"
echo "Wrote $WEB_ENV"
