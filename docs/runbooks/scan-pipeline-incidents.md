# Scan Pipeline Incident Runbook
## Trigger signals
- `worker_telemetry_heartbeat` shows rising `queue.queued` and rising `queueLatencyMs.p95`.
- `scan_failed_terminal` frequency spikes.
- API `/ops/metrics` shows elevated `status5xxPct` or `rateLimitedPct`.
## Triage checklist
1. Confirm deployment health:
   - Backend `/healthz` and `/readyz`
   - Worker process is running and emitting heartbeat events
2. Inspect queue posture:
   - `queue.queued`, `queue.running`, `queue.failed` from heartbeat or API metrics endpoint
   - `retry` and `failed` trend in worker logs
3. Check upstream dependency health:
   - Supabase availability and latency
   - Auth token verification path behavior
4. Validate config sanity:
   - `SCAN_LEASE_DURATION_SECONDS`
   - `MAX_SCAN_ATTEMPTS`
   - `SCAN_RETRY_BASE_DELAY_MS` / `SCAN_RETRY_MAX_DELAY_MS`
## Immediate mitigations
- If queue growth is runaway:
  - Increase worker capacity.
  - Temporarily raise poll frequency (lower `SCAN_POLL_INTERVAL_MS`) if CPU headroom allows.
- If retries are noisy and low value:
  - Reduce `MAX_SCAN_ATTEMPTS` temporarily.
  - Increase retry base delay to reduce churn.
- If API throttling is excessive:
  - Re-check `RATE_LIMIT_*` settings and traffic source profile.
## Recovery criteria
- `queue.queued` trending downward for 30+ minutes.
- `scan_failed_terminal` returns to baseline.
- API `/ops/metrics` `status5xxPct` and latency recover below alert thresholds.
## Post-incident follow-up
- Record incident timeline, root cause, and config changes.
- Update `docs/operations/slo-baseline.md` thresholds if behavior indicates a better baseline.
