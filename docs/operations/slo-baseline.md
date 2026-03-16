# Syntellia SLO Baseline
## Scope
This baseline covers the API service (`packages/backend`) and worker service (`packages/worker`) for scan lifecycle reliability.
## Telemetry sources
- API operational snapshot endpoint: `/ops/metrics`
- API structured logs: `event=http_request`
- Worker structured logs:
  - `event=worker_telemetry_heartbeat`
  - `event=scan_completed`
  - `event=scan_requeued_for_retry`
  - `event=scan_failed_terminal`
## Initial SLO targets
- API availability: **99.9%** monthly (non-5xx success ratio).
- API latency: **p95 < 750ms** over 5-minute windows.
- Scan completion success: **>= 97%** per rolling 24 hours.
- Queue freshness: **p95 queue latency < 5 minutes**.
- Retry pressure: **retry ratio < 20%** over rolling 1 hour.
## Alert thresholds (initial)
- Critical:
  - API `status5xxPct > 5` for 10 minutes.
  - Worker terminal failures >= 5 within 10 minutes.
  - Queue `queued > 200` for 15 minutes.
- High:
  - API latency `p95 > 1000ms` for 10 minutes.
  - Retry ratio >= 30% for 15 minutes.
  - Poll error count increases continuously for 10 minutes.
- Warning:
  - Queue growth trend positive for 30 minutes.
  - API error rate `errorPct > 10` for 15 minutes.
## Review cadence
- Weekly: verify thresholds against traffic profile and false-positive rate.
- Monthly: update targets after capacity or architecture changes.
