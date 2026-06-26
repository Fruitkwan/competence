# GitHub CI/CD to Azure VM

This repo now has a GitHub Actions workflow for deploying the Next.js web app to the Azure VM that is already running the self-hosted Supabase stack.

Workflow file:

- `.github/workflows/ci-cd-azure-vm.yml`

## What the workflow does

On pull requests to `main`:

1. Installs Node 22 dependencies with `npm ci`.
2. Runs ESLint.
3. Runs TypeScript typecheck.
4. Builds the Docker image as a smoke test.

On pushes to `main`, or manual `workflow_dispatch` runs:

1. Re-runs all checks.
2. Connects to the Azure VM over SSH.
3. Uploads `.env.production` built from GitHub Secrets.
4. Checks out the deployed commit in `AZURE_VM_APP_PATH`.
5. Runs `docker compose up -d --build` on the VM.
6. Runs internal smoke checks on the VM:
   - `http://127.0.0.1:3000/login`
   - `http://127.0.0.1:3000/api/health`
7. Runs an external smoke check against `http://AZURE_VM_HOST:3000/login`. This check warns instead of failing because the Azure NSG / firewall / DNS may not be opened yet.

## Required GitHub Secrets

Add these in GitHub:

Repository -> Settings -> Secrets and variables -> Actions -> New repository secret

Required:

```text
AZURE_VM_HOST=74.162.67.39
AZURE_VM_USER=dhofar-az-portal
AZURE_VM_SSH_PRIVATE_KEY=<private key that can SSH to dhofar-az-portal@74.162.67.39>
AZURE_VM_APP_PATH=/home/dhofar-az-portal/competence-portal/app
NEXT_PUBLIC_SUPABASE_URL=http://74.162.67.39:8000
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<self-hosted Supabase publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<self-hosted Supabase service/secret key>
```

Optional, for Firebase push notifications:

```text
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<Firebase web push VAPID key>
FIREBASE_SERVICE_ACCOUNT_JSON=<full Firebase service account JSON, if the app uses this format>
FIREBASE_PROJECT_ID=<Firebase project id>
FIREBASE_CLIENT_EMAIL=<Firebase service account email>
FIREBASE_PRIVATE_KEY=<Firebase private key with newlines escaped as \n>
```

## VM prerequisites

The first deploy assumes the VM already has a git checkout at `AZURE_VM_APP_PATH`.

On the VM, this should be true:

```bash
cd /home/dhofar-az-portal/competence-portal/app
git remote -v
docker compose ps
```

If the app directory is not a git checkout yet, clone it once manually:

```bash
mkdir -p /home/dhofar-az-portal/competence-portal/app
cd /home/dhofar-az-portal/competence-portal/app
git clone https://github.com/Fruitkwan/competence.git .
```

If the repo is private, use SSH deploy keys or a GitHub token on the VM.

## Current known blocker

From this machine, external checks currently time out:

```text
http://74.162.67.39:3000/login
http://74.162.67.39:8000/auth/v1/settings
```

SSH also fails with the local key currently available here:

```text
Permission denied (publickey)
```

So the CI/CD files are ready, but the deployment cannot be executed from this machine until the correct VM SSH private key is available and Azure inbound access is opened or HTTPS reverse proxy is configured.

## Open Azure inbound ports for temporary testing

Use the Azure Portal or Azure CLI to allow inbound access to the VM for:

- port `3000` for the web app
- port `8000` for the Supabase API gateway

For production, prefer HTTPS through Nginx/Caddy instead of leaving raw ports open.

Example Azure CLI, if you know the resource group and NSG names:

```bash
az network nsg rule create \
  --resource-group <resource-group> \
  --nsg-name <nsg-name> \
  --name Allow-Web-3000 \
  --priority 1300 \
  --access Allow \
  --direction Inbound \
  --protocol Tcp \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-port-ranges 3000

az network nsg rule create \
  --resource-group <resource-group> \
  --nsg-name <nsg-name> \
  --name Allow-Supabase-8000 \
  --priority 1310 \
  --access Allow \
  --direction Inbound \
  --protocol Tcp \
  --source-address-prefixes '*' \
  --source-port-ranges '*' \
  --destination-port-ranges 8000
```

## Manual first run

After secrets are added:

1. Push this branch / PR.
2. Merge to `main`, or run the workflow manually from the GitHub Actions tab.
3. Watch `CI/CD Azure VM` in GitHub Actions.
4. Confirm the internal smoke checks pass.
5. If external smoke warns, fix Azure NSG / firewall / DNS / reverse proxy.
