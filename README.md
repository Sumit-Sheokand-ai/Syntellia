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

Repository secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RENDER_BACKEND_DEPLOY_HOOK_URL`
- `RENDER_WORKER_DEPLOY_HOOK_URL`

Legacy fallback is still supported with `RENDER_DEPLOY_HOOK_URL`, but the target setup is separate backend/worker hooks.

## Deployment behavior
On push to `main`, CI will:
1. Install deps, lint, and build static frontend.
2. Deploy `apps/web/out` to GitHub Pages.
3. Trigger Render deploy hooks for backend + worker.

## Notes
- The repository still contains a `Dockerfile` for legacy single-service deployment paths.
- For the dual-hosting model, prefer the split services defined in `render.yaml`.
