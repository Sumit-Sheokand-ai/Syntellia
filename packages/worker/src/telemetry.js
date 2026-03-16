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

function createWorkerTelemetry(options = {}) {
  const nowProvider = typeof options.nowProvider === "function" ? options.nowProvider : () => Date.now();
  const sampleLimit = readPositiveInteger(options.sampleLimit, DEFAULT_SAMPLE_LIMIT);

  const state = {
    startedAtMs: nowProvider(),
    pollCount: 0,
    emptyPollCount: 0,
    pollErrorCount: 0,
    processedCount: 0,
    failedCount: 0,
    retriedCount: 0,
    queueLatencySamples: [],
    processingDurationSamples: [],
    retryDelaySamples: [],
    lastPollAtMs: null,
    lastPollErrorAtMs: null,
    lastScanStartedAtMs: null,
    lastScanCompletedAtMs: null,
    lastRetryScheduledAtMs: null,
    lastFailureAtMs: null
  };

  function pushSample(target, value) {
    if (!Number.isFinite(value) || value < 0) return;
    target.push(value);
    if (target.length > sampleLimit) target.shift();
  }

  function recordPoll({ empty = false } = {}) {
    state.pollCount += 1;
    if (empty) state.emptyPollCount += 1;
    state.lastPollAtMs = nowProvider();
  }

  function recordPollError() {
    state.pollErrorCount += 1;
    state.lastPollErrorAtMs = nowProvider();
  }

  function recordScanStarted({ queueLatencyMs }) {
    state.lastScanStartedAtMs = nowProvider();
    pushSample(state.queueLatencySamples, queueLatencyMs);
  }

  function recordScanCompleted({ durationMs }) {
    state.processedCount += 1;
    state.lastScanCompletedAtMs = nowProvider();
    pushSample(state.processingDurationSamples, durationMs);
  }

  function recordRetryScheduled({ durationMs, retryDelayMs }) {
    state.retriedCount += 1;
    state.lastRetryScheduledAtMs = nowProvider();
    pushSample(state.processingDurationSamples, durationMs);
    pushSample(state.retryDelaySamples, retryDelayMs);
  }

  function recordScanFailed({ durationMs }) {
    state.failedCount += 1;
    state.lastFailureAtMs = nowProvider();
    pushSample(state.processingDurationSamples, durationMs);
  }

  function toIso(timestampMs) {
    if (!timestampMs) return null;
    return new Date(timestampMs).toISOString();
  }

  function snapshot(extra = {}) {
    const uptimeSeconds = Math.max(1, Math.floor((nowProvider() - state.startedAtMs) / 1000));
    return {
      uptimeSeconds,
      poll: {
        total: state.pollCount,
        empty: state.emptyPollCount,
        errors: state.pollErrorCount,
        emptyPct: state.pollCount ? Number(((state.emptyPollCount / state.pollCount) * 100).toFixed(2)) : 0,
        lastPolledAt: toIso(state.lastPollAtMs),
        lastErrorAt: toIso(state.lastPollErrorAtMs)
      },
      scans: {
        processed: state.processedCount,
        failed: state.failedCount,
        retried: state.retriedCount,
        lastStartedAt: toIso(state.lastScanStartedAtMs),
        lastCompletedAt: toIso(state.lastScanCompletedAtMs),
        lastRetryScheduledAt: toIso(state.lastRetryScheduledAtMs),
        lastFailedAt: toIso(state.lastFailureAtMs)
      },
      queueLatencyMs: {
        p50: Number(percentile(state.queueLatencySamples, 0.5).toFixed(2)),
        p95: Number(percentile(state.queueLatencySamples, 0.95).toFixed(2)),
        sampleSize: state.queueLatencySamples.length
      },
      processingDurationMs: {
        p50: Number(percentile(state.processingDurationSamples, 0.5).toFixed(2)),
        p95: Number(percentile(state.processingDurationSamples, 0.95).toFixed(2)),
        sampleSize: state.processingDurationSamples.length
      },
      retryDelayMs: {
        p50: Number(percentile(state.retryDelaySamples, 0.5).toFixed(2)),
        p95: Number(percentile(state.retryDelaySamples, 0.95).toFixed(2)),
        sampleSize: state.retryDelaySamples.length
      },
      ...extra
    };
  }

  return {
    recordPoll,
    recordPollError,
    recordScanStarted,
    recordScanCompleted,
    recordRetryScheduled,
    recordScanFailed,
    snapshot
  };
}

module.exports = {
  createWorkerTelemetry,
  __testables: {
    percentile
  }
};
