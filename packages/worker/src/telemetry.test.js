const test = require("node:test");
const assert = require("node:assert/strict");
const { createWorkerTelemetry, __testables } = require("./telemetry");

test("worker telemetry percentile helper handles empty and populated samples", () => {
  assert.equal(__testables.percentile([], 0.95), 0);
  assert.equal(__testables.percentile([100, 200, 300, 400], 0.5), 200);
  assert.equal(__testables.percentile([100, 200, 300, 400], 0.95), 400);
});

test("worker telemetry snapshot tracks polls, retries, failures, and latency samples", () => {
  let nowMs = 1_700_000_000_000;
  const telemetry = createWorkerTelemetry({
    nowProvider: () => nowMs,
    sampleLimit: 10
  });

  telemetry.recordPoll();
  telemetry.recordPoll({ empty: true });
  telemetry.recordScanStarted({ queueLatencyMs: 5000 });
  telemetry.recordScanCompleted({ durationMs: 1200 });
  telemetry.recordRetryScheduled({ durationMs: 900, retryDelayMs: 7000 });
  telemetry.recordScanFailed({ durationMs: 400 });
  telemetry.recordPollError();

  nowMs += 60_000;
  const snapshot = telemetry.snapshot({ queue: { queued: 3, running: 1 } });

  assert.equal(snapshot.poll.total, 2);
  assert.equal(snapshot.poll.empty, 1);
  assert.equal(snapshot.poll.errors, 1);
  assert.equal(snapshot.poll.emptyPct, 50);
  assert.equal(snapshot.scans.processed, 1);
  assert.equal(snapshot.scans.retried, 1);
  assert.equal(snapshot.scans.failed, 1);
  assert.equal(snapshot.queueLatencyMs.p95, 5000);
  assert.equal(snapshot.processingDurationMs.p50, 900);
  assert.equal(snapshot.retryDelayMs.p95, 7000);
  assert.equal(snapshot.queue.queued, 3);
});
