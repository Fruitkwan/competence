# Azure VM Deployment and Supabase Migration Plan

This runbook moves the app from Supabase Cloud to the self-hosted Supabase stack on the Azure VM, validates the migrated data, deploys the Next.js web app, and then adds GitHub CI/CD.

## Current Known State

- Azure VM user: `dhofar-az-portal`
- Azure VM public IP for testing: `74.162.67.39`
- VM project path: `~/competence-portal`
- Self-hosted Supabase path: `~/competence-portal/supabase/docker`
- Supabase Docker `.env` has been copied from `.env.example` and edited.
- Self-hosted Supabase containers are running and healthy on the VM.
- Web app container is running on the VM and responds locally on port `3000`.
- Azure external inbound access for testing ports `3000` and `8000` still needs to be opened in the VM Network Security Group.
- Supabase Cloud project ref: `giknnmtnlsjzphjzkfcq`
- Domain decision: use VM IP for testing before DNS/HTTPS cutover.
- This repo already has:
  - `Dockerfile`
  - `docker-compose.yml`
  - `.dockerignore`
  - app SQL scripts in `scripts/`

## References

- Supabase self-host Docker guide: https://supabase.com/docs/guides/self-hosting/docker
- Supabase restore platform project to self-hosted: https://supabase.com/docs/guides/self-hosting/restore-from-platform
- Supabase copy storage objects from platform: https://supabase.com/docs/guides/self-hosting/copy-from-platform-s3
- Supabase database migration workflow: https://supabase.com/docs/guides/deployment/database-migrations

## Information Needed Before Remote Execution

Fill these before running the steps:

```bash
VM_HOST="<azure-vm-public-ip-or-domain>"
VM_USER="dhofar-az-portal"
APP_DOMAIN="<app-domain-or-vm-ip>"
SUPABASE_DOMAIN="<supabase-domain-or-vm-ip>"
CLOUD_DB_URL="<supabase-cloud-postgres-connection-string>"
CLOUD_PROJECT_REF="<supabase-cloud-project-ref>"
GITHUB_REPO="<owner/repo>"
```

Current values:

```bash
VM_HOST="74.162.67.39"
VM_USER="dhofar-az-portal"
APP_DOMAIN="74.162.67.39"
SUPABASE_DOMAIN="74.162.67.39"
CLOUD_PROJECT_REF="giknnmtnlsjzphjzkfcq"
GITHUB_REPO="GDITdhofarglobal/<repo-name-needed>"
```

Do not commit or paste the full Cloud DB URL into this file because it contains the database password.

Also collect:

- Supabase Cloud database password.
- Supabase Cloud S3 access key/secret if storage objects need to move.
- Self-hosted Supabase `.env` values:
  - `POSTGRES_PASSWORD`
  - `POOLER_TENANT_ID`
  - `SUPABASE_PUBLIC_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SECRET_KEY`
- Firebase VAPID key if Firebase push notifications should be enabled in production.
- Firebase Admin service account credentials for server-side push delivery:
  - Preferred `.env` format: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` with newlines escaped as `\n`.
  - Alternative GitHub secret format: `FIREBASE_SERVICE_ACCOUNT_JSON`.

## Phase 0 - Prepare Local Repo

Goal: make sure the code we deploy is clean and reproducible.

Status on 2026-06-19:

- `npx tsc --noEmit` passed.
- `npm run lint` passed with warnings only.
- `docker compose build` passed.
- `.dockerignore` was tightened after the first build showed the `mobile/` directory making the Docker context too large.
- `.dockerignore` now excludes only the root `/supabase` folder so `src/lib/supabase/*` remains in the Docker build context.

1. Confirm all intended changes are committed.

```bash
git status --short
npm run lint
npx tsc --noEmit
```

2. Confirm Docker build works locally with production env variables.

```bash
docker compose build
```

3. Push the deployment branch to GitHub.

```bash
git push origin <branch>
```

Acceptance:

- `git status --short` is empty or only has planned docs changes.
- lint and TypeScript pass.
- Docker build succeeds.

## Phase 1 - Start and Validate Self-Hosted Supabase

Goal: bring the VM Supabase stack up before migrating data.

Status on 2026-06-19:

- SSH access works with the provided VM key.
- `docker compose up -d --wait` completed successfully.
- All Supabase containers report healthy.
- Internal VM checks to `http://localhost:8000/auth/v1/settings` and `http://localhost:8000/rest/v1/` return the expected unauthenticated `401 No API key found` from Kong.
- External checks to `http://74.162.67.39:8000/...` failed to connect from local machine.
- Next network action: add Azure NSG/firewall inbound access for port `8000` for Supabase API testing, and later port `3000` for web app testing.

SSH to VM:

```bash
ssh ${VM_USER}@${VM_HOST}
cd ~/competence-portal/supabase/docker
```

Validate Supabase config:

```bash
grep -E '^(SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|SITE_URL|POSTGRES_PASSWORD|POOLER_TENANT_ID|SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' .env
```

Start stack:

```bash
docker compose pull
docker compose up -d --wait
docker compose ps
```

If the repo has `run.sh`, prefer:

```bash
sh run.sh start
docker compose ps
```

Check service endpoints:

```bash
curl -i http://${SUPABASE_DOMAIN}:8000/rest/v1/
curl -i http://${SUPABASE_DOMAIN}:8000/auth/v1/settings
```

Acceptance:

- Supabase containers show `Up` / healthy.
- Studio is reachable at `http://${SUPABASE_DOMAIN}:8000`.
- REST/Auth endpoints respond.

## Phase 2 - Back Up Supabase Cloud

Goal: create a restorable Cloud backup before changing the VM database.

Status on 2026-06-19:

- `psql` installed on VM.
- Supabase CLI `2.107.0` installed on VM under `~/.local/share/supabase`.
- Backup script copied to `~/competence-portal/scripts/backup-cloud-supabase.sh`.
- First backup attempt failed because only the CLI shim had been installed; fixed by installing the full release tarball containing both `supabase` and `supabase-go`.
- Direct database backup failed because the VM network cannot reach Supabase Cloud's IPv6 direct database endpoint.
- Backup succeeded after switching `CLOUD_DB_URL` to the Supabase Cloud **Transaction pooler** connection string.
- Successful backup directory: `~/competence-portal/backups/20260619-122417`.
- Cloud row counts saved:
  - `auth.users`: 6
  - `employees`: 87
  - `profiles`: 4
  - `employee_courses`: 1
  - `notifications`: 28

Install required tools on the machine where dumps will run:

```bash
npm install -g supabase
sudo apt-get update
sudo apt-get install -y postgresql-client
```

Create backup directory:

```bash
mkdir -p ~/competence-portal/backups/$(date +%Y%m%d-%H%M%S)
cd ~/competence-portal/backups/$(date +%Y%m%d-%H%M%S)
```

Dump roles, schema, and data using Supabase CLI:

```bash
supabase db dump --db-url "${CLOUD_DB_URL}" -f roles.sql --role-only
supabase db dump --db-url "${CLOUD_DB_URL}" -f schema.sql
supabase db dump --db-url "${CLOUD_DB_URL}" -f data.sql --use-copy --data-only
```

Optional row-count snapshot:

```bash
psql "${CLOUD_DB_URL}" -c "
select 'profiles' table_name, count(*) from public.profiles
union all select 'employees', count(*) from public.employees
union all select 'employee_courses', count(*) from public.employee_courses
union all select 'notifications', count(*) from public.notifications
union all select 'auth.users', count(*) from auth.users;
"
```

Acceptance:

- `roles.sql`, `schema.sql`, and `data.sql` exist.
- Cloud row counts are saved for comparison.

## Phase 3 - Restore Database to VM Supabase

Goal: restore Cloud schema/data to self-hosted Supabase and apply local app scripts.

Status on 2026-06-19:

- Restore completed from `~/competence-portal/backups/20260619-122417`.
- `roles.sql` was filtered to skip the reserved `supabase_admin` role alteration.
- `data.sql` was filtered to skip newer Supabase Storage internal COPY blocks for `storage.buckets_vectors` and `storage.vector_indexes`.
- App migrations applied:
  - `scripts/migration-employee-import.sql`
  - `scripts/migration-firebase-notifications.sql`
- Verified self-hosted row counts:
  - `auth.users`: 6
  - `employees`: 87
  - `profiles`: 4
  - `employee_courses`: 1
  - `notifications`: 28
  - `firebase_messaging_tokens`: 0
- Caveat: restored Cloud data has `employees.department` empty for all 87 rows, and `profiles.department_id` empty for all 4 profiles. Job profiles only matched 5 employees by title, so no automatic department backfill was applied. Upload the employee Excel again through the fixed importer after deployment to populate departments.

Build self-hosted DB URL:

```bash
SELF_HOSTED_DB_URL="postgres://postgres.${POOLER_TENANT_ID}:${POSTGRES_PASSWORD}@localhost:5432/postgres"
```

Restore:

```bash
psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file roles.sql \
  --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql \
  --dbname "${SELF_HOSTED_DB_URL}"
```

Apply app scripts that may not exist in the old Cloud schema:

```bash
cd ~/competence-portal/app
psql "${SELF_HOSTED_DB_URL}" -f scripts/migration-employee-import.sql
psql "${SELF_HOSTED_DB_URL}" -f scripts/migration-firebase-notifications.sql
```

If the restore fails because Cloud is newer than self-hosted Postgres/Auth/Storage:

1. Save the exact error.
2. Fix `data.sql` only for the failing incompatible statement.
3. Restart from a clean VM database or restore before app traffic is enabled.

Verify:

```bash
psql "${SELF_HOSTED_DB_URL}" -c "\dt public.*"
psql "${SELF_HOSTED_DB_URL}" -c "select count(*) from auth.users;"
psql "${SELF_HOSTED_DB_URL}" -c "select count(*) from public.employees;"
psql "${SELF_HOSTED_DB_URL}" -c "select count(*) from public.employee_courses;"
psql "${SELF_HOSTED_DB_URL}" -c "select employee_id, full_name, department from public.employees limit 10;"
```

Acceptance:

- Key table row counts match the Cloud snapshot.
- `auth.users` count matches Cloud.
- `public.employees.department` exists and has values after import/migration.

## Phase 4 - Copy Supabase Storage Objects If Needed

Goal: move uploaded files/certificates from Cloud Storage to self-hosted Storage.

Skip this phase if the app has no storage objects worth preserving.

Install `rclone`:

```bash
sudo apt-get install -y rclone
```

Configure two remotes in `~/.config/rclone/rclone.conf`:

```ini
[platform]
type = s3
provider = Other
access_key_id = <cloud-s3-access-key-id>
secret_access_key = <cloud-s3-secret>
endpoint = https://<cloud-project-ref>.supabase.co/storage/v1/s3
region = <cloud-region>

[self-hosted]
type = s3
provider = Other
access_key_id = <self-hosted-s3-access-key-id>
secret_access_key = <self-hosted-s3-secret>
endpoint = http://<supabase-domain-or-ip>:8000/storage/v1/s3
region = <self-hosted-region>
```

Verify and copy:

```bash
rclone lsd platform:
rclone lsd self-hosted:

for bucket in $(rclone lsf platform: | tr -d '/'); do
  echo "Copying bucket: $bucket"
  rclone copy "platform:$bucket" "self-hosted:$bucket" --progress
done
```

Acceptance:

- Bucket object counts match between Cloud and self-hosted.
- Files open from the self-hosted Storage API.

## Phase 5 - Deploy the Web App on the VM

Goal: run the Next.js app against the self-hosted Supabase instance.

Status on 2026-06-19:

- Current local working tree was packaged and uploaded to `~/competence-portal/app`.
- `scripts/write-web-env-from-supabase.sh` generated `~/competence-portal/app/.env` from the self-hosted Supabase `.env`.
- `docker compose up -d --build` completed successfully.
- Container `app-web-1` is running and maps `0.0.0.0:3000->3000`.
- Internal VM smoke checks passed:
  - `http://localhost:3000/login` returns `200`.
  - `http://localhost:3000/` redirects to `/login?redirectTo=%2F`.
- External check to `http://74.162.67.39:3000/login` timed out. VM OS firewall is not blocking traffic (`ufw inactive`, `INPUT ACCEPT`), so open Azure NSG inbound port `3000` before browser testing. Port `8000` is also needed for direct Supabase API testing until a reverse proxy/domain is configured.

Choose app directory:

```bash
mkdir -p ~/competence-portal/app
cd ~/competence-portal/app
```

Clone or update the GitHub repo:

```bash
git clone git@github.com:${GITHUB_REPO}.git .
# or, if already cloned:
git fetch origin
git checkout <branch>
git pull --ff-only
```

Create production env file:

```bash
cat > .env.production <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://<supabase-domain-or-ip>:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<self-hosted-supabase-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<self-hosted-supabase-secret-key>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<firebase-vapid-key-if-used>
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_CLIENT_EMAIL=<firebase-service-account-email>
FIREBASE_PRIVATE_KEY=<firebase-private-key-with-escaped-newlines>
EOF
```

Build and run:

```bash
cp .env.production .env
docker compose up -d --build
docker compose ps
docker compose logs -f web
```

Smoke checks:

```bash
curl -I http://${APP_DOMAIN}:3000/login
curl -I http://${APP_DOMAIN}:3000/firebase-messaging-sw.js
```

Acceptance:

- App container is running.
- Login page loads.
- Firebase service worker loads if notifications are enabled.
- User can log in with a migrated account.
- Dashboard, employee import, training assignment, notifications, and storage flows work.

## Phase 6 - DNS, HTTPS, and Reverse Proxy

Goal: expose the app and Supabase over stable HTTPS URLs.

Recommended public layout:

- App: `https://portal.<domain>`
- Supabase API/Studio: `https://supabase.<domain>`

Use Nginx or Caddy:

- Proxy app to `127.0.0.1:3000`.
- Proxy Supabase API gateway to `127.0.0.1:8000`.
- Enable TLS certificates.
- Update Supabase `.env`:
  - `SUPABASE_PUBLIC_URL=https://supabase.<domain>`
  - `API_EXTERNAL_URL=https://supabase.<domain>`
  - `SITE_URL=https://portal.<domain>`
- Restart Supabase and rebuild the web app because `NEXT_PUBLIC_SUPABASE_URL` is bundled into the client build.

Acceptance:

- `https://portal.<domain>` loads app.
- `https://supabase.<domain>/auth/v1/settings` responds.
- Login redirect/callback works.

## Phase 7 - GitHub CI/CD

Goal: deploy automatically from GitHub after the manual VM deployment is proven.

Recommended first pipeline:

1. On pull request:
   - `npm ci`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `docker build`

2. On push to `main`:
   - SSH to Azure VM.
   - `git pull --ff-only`
   - write/update `.env.production` from GitHub secrets.
   - `docker compose up -d --build`
   - run smoke checks.

GitHub secrets needed:

```text
AZURE_VM_HOST
AZURE_VM_USER
AZURE_VM_SSH_PRIVATE_KEY
AZURE_VM_APP_PATH
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_FIREBASE_VAPID_KEY
FIREBASE_SERVICE_ACCOUNT_JSON
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Later improvement:

- Build/push Docker image to GitHub Container Registry.
- VM pulls immutable image tags instead of building on the VM.
- Add DB migration job with manual approval.

Acceptance:

- PR checks block broken builds.
- Push to `main` deploys to VM.
- Failed deploy leaves prior container running.

## Phase 8 - Rollback

Goal: recover quickly if the VM deployment fails.

Before cutover:

```bash
docker compose ps
docker compose logs --tail=100 web
```

Rollback app:

```bash
cd ~/competence-portal/app
git checkout <last-good-commit>
docker compose up -d --build
```

Rollback Supabase:

- Do not overwrite Cloud until VM is accepted.
- If self-hosted restore fails, reset VM database and restore again from backup files.
- Keep Cloud project as source of truth until acceptance is complete.

## Execution Checklist

- [x] Phase 0 local repo clean/build verified.
- [x] Phase 1 VM Supabase stack running.
- [x] Phase 2 Cloud backup exported.
- [x] Phase 3 database restored and verified.
- [ ] Phase 4 storage copied, if needed.
- [x] Phase 5 web app deployed to VM.
- [ ] Phase 6 HTTPS/domain configured.
- [ ] Phase 7 GitHub CI/CD added.
- [ ] Phase 8 rollback path tested.
