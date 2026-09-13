#!/usr/bin/env bash
set -euo pipefail

if [ -z "${CLOUD_DB_URL:-}" ]; then
  echo "CLOUD_DB_URL is required. Set it in this shell without committing it to files." >&2
  exit 1
fi

export PATH="$HOME/.local/share/supabase:$HOME/.local/bin:$PATH"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$HOME/competence-portal/backups/$STAMP"
mkdir -p "$BACKUP_DIR"
cd "$BACKUP_DIR"

echo "Writing backup to $BACKUP_DIR"
supabase db dump --db-url "$CLOUD_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$CLOUD_DB_URL" -f schema.sql
supabase db dump --db-url "$CLOUD_DB_URL" -f data.sql --use-copy --data-only

psql "$CLOUD_DB_URL" -v ON_ERROR_STOP=1 -o row-counts.txt -c "
select 'profiles' table_name, count(*) from public.profiles
union all select 'employees', count(*) from public.employees
union all select 'employee_courses', count(*) from public.employee_courses
union all select 'notifications', count(*) from public.notifications
union all select 'auth.users', count(*) from auth.users
order by table_name;
"

ls -lh roles.sql schema.sql data.sql row-counts.txt
cat row-counts.txt
