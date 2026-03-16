const test = require("node:test");
const assert = require("node:assert/strict");
const { createApiTelemetry, __testables } = require("./telemetry");

test("percentile returns zero for empty arrays and p95 for populated arrays", () => {
  assert.equal(__testables.percentile([], 0.95), 0);
  assert.equal(__testables.percentile([10, 20, 30, 40, 50], 0.95), 50);
  assert.equal(__testables.percentile([1, 2, 3, 4], 0.5), 2);
});

test("createApiTelemetry snapshot includes rates, latency stats, and top paths", () => {
  let nowMs = 1_700_000_000_000;
  const telemetry = createApiTelemetry({
    nowProvider: () => nowMs,
    sampleLimit: 10
  });

  telemetry.observeHttpRequest({
    method: "GET",
    path: "/api/scans",
    statusCode: 200,
    durationMs: 120
  });
  telemetry.observeHttpRequest({
    method: "POST",
    path: "/api/scans",
    statusCode: 429,
    durationMs: 300
  });
  telemetry.observeHttpRequest({
    method: "GET",
    path: "/api/scans/scan-1",
    statusCode: 503,
    durationMs: 210
  });

  nowMs += 60_000;
  const snapshot = telemetry.snapshot();

  assert.equal(snapshot.requests.total, 3);
  assert.equal(snapshot.statusCodes["2xx"], 1);
  assert.equal(snapshot.statusCodes["4xx"], 1);
  assert.equal(snapshot.statusCodes["5xx"], 1);
  assert.equal(snapshot.rates.rateLimitedPct, 33.33);
  assert.equal(snapshot.latencyMs.avg, 210);
  assert.equal(snapshot.latencyMs.p95, 300);
  assert.ok(Array.isArray(snapshot.topPaths));
  assert.ok(snapshot.topPaths[0].path.includes("/api/scans"));
});
