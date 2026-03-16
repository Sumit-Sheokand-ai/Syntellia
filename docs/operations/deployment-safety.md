# Deployment Safety Baseline
## Objectives
- Prevent unhealthy runtime rollouts from silently persisting.
- Detect post-deploy regressions quickly with automated readiness checks.
- Standardize rollback criteria for API and worker incidents.
## Automated guardrails
- CI workflow includes post-deploy readiness polling against `BACKEND_HEALTHCHECK_URL`.
- Readiness verification now requires a configurable consecutive-success quorum before rollout is considered healthy.
- Optional post-deploy ops metrics gating can fail deployment verification when `status5xxPct`, `latencyMs.p95`, or queue backlog exceed configured thresholds.
- Recommended `BACKEND_HEALTHCHECK_URL` target: backend `/readyz` endpoint.
- Deployment should be considered incomplete until readiness check passes.
## CI verification controls
- `DEPLOY_HEALTHCHECK_MAX_ATTEMPTS` (default `36`)
- `DEPLOY_HEALTHCHECK_INTERVAL_SECONDS` (default `10`)
- `DEPLOY_HEALTHCHECK_CONSECUTIVE_SUCCESSES` (default `3`)
- `BACKEND_METRICS_URL` (optional, recommend backend `/ops/metrics`)
- `BACKEND_MAX_STATUS_5XX_PCT` (default `5`)
- `BACKEND_MAX_P95_LATENCY_MS` (default `5000`)
- `BACKEND_MAX_QUEUE_QUEUED` (default `250`)
- `SUPABASE_METRICS_AUTH_EMAIL` and `SUPABASE_METRICS_AUTH_PASSWORD` (recommended for metrics gating; workflow mints a fresh JWT per run)
- `BACKEND_METRICS_BEARER_TOKEN` (fallback only when dynamic minting secrets are not set; token must map to a privileged role allowed on `/ops/metrics`)
## Pre-deploy checklist
1. `npm run test`, `npm run lint`, and `npm run build` are green.
2. `supabase/schema.sql` changes (if any) are applied before runtime rollout.
3. Required runtime env vars are present for backend and worker.
4. `ALLOWED_ORIGIN` and auth redirect URLs match active frontend origin(s).
## Post-deploy verification
1. Confirm `BACKEND_HEALTHCHECK_URL` succeeds.
2. Check backend `/ops/metrics` for:
   - `status5xxPct` near baseline
   - stable latency (`latencyMs.p95`)
   - acceptable `rateLimitedPct`
3. Check worker heartbeat logs:
   - `worker_telemetry_heartbeat`
   - queue growth not accelerating (`queue.queued`)
   - retry/failure trends within threshold
## Rollback criteria (initial)
- Immediate rollback recommended if any condition persists beyond 10 minutes:
  - API `status5xxPct > 5`
  - Backend readiness repeatedly failing
  - Worker terminal failures spike and queue backlog continues rising
- Investigate before rollback when:
  - latency increased but no corresponding error/failure surge
  - retry ratio elevated but queue remains stable
## Rollback procedure
1. Roll back backend and worker to last known-good deployment in Render.
2. Re-run readiness checks and validate `/ops/metrics`.
3. Capture incident notes and update runbooks/SLO thresholds if needed.
