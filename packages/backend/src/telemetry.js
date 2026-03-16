const DEFAULT_SAMPLE_LIMIT = 400;

function readPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

function createApiTelemetry(options = {}) {
  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => Date.now();
  const sampleLimit = readPositiveInteger(options.sampleLimit, DEFAULT_SAMPLE_LIMIT);

  const state = {
    startedAtMs: nowProvider(),
    requestCount: 0,
    status2xxCount: 0,
    status4xxCount: 0,
    status5xxCount: 0,
    rateLimitedCount: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    latencySamples: [],
    pathCounts: new Map(),
    lastRequestAtMs: null
  };

  function observeHttpRequest({ method, path, statusCode, durationMs }) {
    const safeStatusCode = Number.isFinite(statusCode) ? statusCode : 500;
    const safeDurationMs = Number.isFinite(durationMs) && durationMs >= 0 ? durationMs : 0;
    const safeMethod = typeof method === "string" && method ? method : "UNKNOWN";
    const safePath = typeof path === "string" && path ? path : "/unknown";
    const pathKey = `${safeMethod} ${safePath}`;

    state.requestCount += 1;
    state.totalDurationMs += safeDurationMs;
    state.maxDurationMs = Math.max(state.maxDurationMs, safeDurationMs);
    state.lastRequestAtMs = nowProvider();

    if (safeStatusCode >= 500) state.status5xxCount += 1;
    else if (safeStatusCode >= 400) state.status4xxCount += 1;
    else if (safeStatusCode >= 200 && safeStatusCode < 300) state.status2xxCount += 1;

    if (safeStatusCode === 429) state.rateLimitedCount += 1;

    state.latencySamples.push(safeDurationMs);
    if (state.latencySamples.length > sampleLimit) {
      state.latencySamples.shift();
    }

    const currentPathCount = state.pathCounts.get(pathKey) ?? 0;
    state.pathCounts.set(pathKey, currentPathCount + 1);
  }

  function snapshot() {
    const uptimeSeconds = Math.max(1, Math.floor((nowProvider() - state.startedAtMs) / 1000));
    const requestsPerMinute = Number(((state.requestCount / uptimeSeconds) * 60).toFixed(2));
    const avgDurationMs = state.requestCount ? Number((state.totalDurationMs / state.requestCount).toFixed(2)) : 0;
    const p95DurationMs = Number(percentile(state.latencySamples, 0.95).toFixed(2));
    const errorRatePct = state.requestCount
      ? Number((((state.status4xxCount + state.status5xxCount) / state.requestCount) * 100).toFixed(2))
      : 0;
    const status5xxRatePct = state.requestCount
      ? Number(((state.status5xxCount / state.requestCount) * 100).toFixed(2))
      : 0;
    const rateLimitedPct = state.requestCount
      ? Number(((state.rateLimitedCount / state.requestCount) * 100).toFixed(2))
      : 0;

    const topPaths = [...state.pathCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([path, count]) => ({ path, count }));

    return {
      uptimeSeconds,
      requests: {
        total: state.requestCount,
        perMinute: requestsPerMinute,
        lastRequestAt: state.lastRequestAtMs ? new Date(state.lastRequestAtMs).toISOString() : null
      },
      statusCodes: {
        "2xx": state.status2xxCount,
        "4xx": state.status4xxCount,
        "5xx": state.status5xxCount
      },
      rates: {
        errorPct: errorRatePct,
        status5xxPct: status5xxRatePct,
        rateLimitedPct
      },
      latencyMs: {
        avg: avgDurationMs,
        p95: p95DurationMs,
        max: Number(state.maxDurationMs.toFixed(2)),
        sampleSize: state.latencySamples.length
      },
      topPaths
    };
  }

  return {
    observeHttpRequest,
    snapshot
  };
}

module.exports = {
  createApiTelemetry,
  __testables: {
    percentile
  }
};
