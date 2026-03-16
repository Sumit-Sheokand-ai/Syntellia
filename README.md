# Syntellia
Syntellia is a UI/UX scanner that takes a URL, queues an authenticated scan, extracts real page signals, and returns a structured report.

## Current architecture
- `apps/web`: Next.js frontend, statically exported for GitHub Pages.
- `packages/backend`: Express API (`/api/scans`) with Supabase-authenticated access.
- `packages/worker`: background scanner that processes queued scans and writes report results.
- `supabase/schema.sql`: scan table + RLS policies for per-user data isolation.
- `render.yaml`: Render Blueprint for split API + worker services.

## Real scan flow
1. User signs in from the frontend using Supabase Auth.
2. Frontend calls `NEXT_PUBLIC_BACKEND_URL/api/scans` with a Supabase Bearer token.
3. Backend verifies the token and stores a `Queued` scan in Supabase.
4. Worker claims queued scans, extracts page structure/style/action signals, and writes `Completed` or `Failed` results.
5. Frontend polls scan status and renders the final report.

## Monorepo layout
```text
Syntellia/
├─ apps/
│  └─ web/
├─ packages/
│  ├─ backend/
│  └─ worker/
├─ supabase/
│  └─ schema.sql
├─ render.yaml
└─ .github/workflows/ci-render-deploy.yml
```

## Environment variables
Use `.env.example` as the source of truth. Required groups:

Frontend build/runtime:
- `NEXT_PUBLIC_BACKEND_URL`
- `NEXT_PUBLIC_BASE_PATH` (set to `/RepoName` for project-site Pages, otherwise empty)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_PUBLISHABLE_KEY` (optional alias)

Backend + worker runtime:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGIN` (backend only, comma-separated origins)
- `RATE_LIMIT_STORE` (`supabase` default, or `memory`)
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `API_TELEMETRY_SAMPLE_SIZE`
- `API_TELEMETRY_HEARTBEAT_MS`
- `API_TELEMETRY_EXPORT_URL` (optional override for API export sink)
- `SCAN_LEASE_DURATION_SECONDS`
- `SCAN_RETRY_BASE_DELAY_MS`
- `SCAN_RETRY_MAX_DELAY_MS`
- `SCAN_TELEMETRY_HEARTBEAT_MS`
- `SCAN_TELEMETRY_SAMPLE_SIZE`
- `WORKER_TELEMETRY_EXPORT_URL` (optional override for worker export sink)
- `TELEMETRY_EXPORT_URL` (shared optional export sink fallback)
- `TELEMETRY_EXPORT_BEARER_TOKEN` (optional bearer auth for sink)
- `TELEMETRY_EXPORT_TIMEOUT_MS`
- `PORT` (backend only; Render sets this automatically)

## Local development
1. Install dependencies:
   ```bash
   npm ci
   ```
2. Provide environment variables from `.env.example`.
3. Run services in separate terminals:
   ```bash
   npm run backend:dev
   npm run worker:dev
   npm run dev
   ```
4. Validate:
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

## Deploying GitHub Pages + Render
### 1) Configure Supabase
- Apply `supabase/schema.sql`.
- Add auth redirect URLs for every frontend origin you will use, including callback path variants:
  - `https://<username>.github.io/<repo>/auth/callback`
  - `https://<username>.github.io/<repo>/auth/callback/`
  - local/dev equivalents if needed.

### 2) Configure Render (split runtime)
Use `render.yaml` to create/sync:
- `syntellia-api` (web service)
- `syntellia-worker` (worker service)

Set environment values in Render:
- API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`
- Worker: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

`ALLOWED_ORIGIN` should include your GitHub Pages origin (and any other allowed frontend origins).

### 3) Configure GitHub Actions
Workflow: `.github/workflows/ci-render-deploy.yml`

Repository variables:
- `NEXT_PUBLIC_BACKEND_URL` (Render API URL)
- `NEXT_PUBLIC_BASE_PATH` (`/RepoName` for project-site Pages; empty for root-site/custom domain)
- `BACKEND_HEALTHCHECK_URL` (recommended: backend `/readyz` URL for post-deploy verification)
- `DEPLOY_HEALTHCHECK_MAX_ATTEMPTS` (optional, default `36`)
- `DEPLOY_HEALTHCHECK_INTERVAL_SECONDS` (optional, default `10`)
- `DEPLOY_HEALTHCHECK_CONSECUTIVE_SUCCESSES` (optional, default `3`)
- `BACKEND_METRICS_URL` (optional, backend `/ops/metrics` URL for post-deploy metrics gating)
- `BACKEND_MAX_STATUS_5XX_PCT` (optional, default `5`)
- `BACKEND_MAX_P95_LATENCY_MS` (optional, default `5000`)
- `BACKEND_MAX_QUEUE_QUEUED` (optional, default `250`)

Repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RENDER_BACKEND_DEPLOY_HOOK_URL`
- `RENDER_WORKER_DEPLOY_HOOK_URL`
- `SUPABASE_METRICS_AUTH_EMAIL` (recommended when `BACKEND_METRICS_URL` is set; dedicated privileged user email for dynamic token minting)
- `SUPABASE_METRICS_AUTH_PASSWORD` (recommended when `BACKEND_METRICS_URL` is set; password for the dedicated privileged user)
- `BACKEND_METRICS_BEARER_TOKEN` (optional fallback; static privileged JWT used only when dynamic token minting secrets are not provided)

Legacy fallback is still supported with `RENDER_DEPLOY_HOOK_URL`, but the target setup is separate backend/worker hooks.

## Deployment behavior
On push to `main`, CI will:
1. Install deps, run backend/worker/web tests, lint, and build static frontend.
2. Deploy `apps/web/out` to GitHub Pages.
3. Trigger Render deploy hooks for backend + worker.
4. Verify rollout health with readiness quorum polling (`BACKEND_HEALTHCHECK_URL`) and optional `/ops/metrics` threshold gating when configured.
   - Metrics gate auth order: dynamic Supabase token minting (`SUPABASE_METRICS_AUTH_EMAIL` + `SUPABASE_METRICS_AUTH_PASSWORD`) first, then static `BACKEND_METRICS_BEARER_TOKEN` fallback.

## Notes
- The repository still contains a `Dockerfile` for legacy single-service deployment paths.
- For the dual-hosting model, prefer the split services defined in `render.yaml`.
- Backend operational metrics are available at `/ops/metrics` (includes request telemetry and queue status counts).
- Web localization now covers auth, dashboard, and primary scan flows (`/app/scan/new`, `/app/scan/history`, `/app/scan/view`) with locale-aware timestamps.
- Scan history saved views are now server-backed per authenticated user (`/api/history-views`) so filters persist across devices and sessions.
- Supported UI locales: English (`en`), Spanish (`es`), and Arabic (`ar`), including automatic `lang`/`dir` updates for RTL when Arabic is selected.
- Accessibility baseline now includes skip-to-content navigation, consistent `:focus-visible` treatment, tab keyboard controls in reports, and reduced-motion fallbacks for animated UI effects.
- Enterprise RBAC baseline is enabled for privileged operations endpoints. Roles are resolved from Supabase JWT metadata (`app_metadata.roles` / `app_metadata.role`, with fallback to user metadata); default role is `member`.
- Privileged operations now require admin-class roles (`super_admin`, `admin`, `ops`, `security`, `billing_admin`):
  - `GET /ops/metrics`
  - `GET /api/admin/access-context`
  - `GET /api/admin/entitlements/overview`
  - `GET /api/admin/analytics/events`
- Operational baselines:
  - SLOs and alert thresholds: `docs/operations/slo-baseline.md`
  - Incident response flow: `docs/runbooks/scan-pipeline-incidents.md`
  - Deployment safety checks and rollback criteria: `docs/operations/deployment-safety.md`
