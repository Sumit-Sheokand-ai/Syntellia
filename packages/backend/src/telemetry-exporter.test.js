const test = require("node:test");
const assert = require("node:assert/strict");
const { createTelemetryExporter } = require("./telemetry-exporter");

test("telemetry exporter returns disabled status when endpoint is missing", async () => {
  const exporter = createTelemetryExporter({
    service: "syntellia-backend",
    endpoint: ""
  });

  const result = await exporter.exportEvent("event_name", { ok: true });
  assert.equal(result.enabled, false);
  assert.equal(result.ok, true);
  assert.equal(exporter.status().enabled, false);
});

test("telemetry exporter reports success when sink accepts payload", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: true, status: 200 });

  try {
    const exporter = createTelemetryExporter({
      service: "syntellia-backend",
      endpoint: "https://example.invalid/telemetry",
      timeoutMs: 1000
    });

    const result = await exporter.exportEvent("heartbeat", { metric: 1 });
    assert.equal(result.enabled, true);
    assert.equal(result.ok, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("telemetry exporter reports sink errors", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 503 });

  try {
    const exporter = createTelemetryExporter({
      service: "syntellia-backend",
      endpoint: "https://example.invalid/telemetry"
    });

    const result = await exporter.exportEvent("heartbeat", { metric: 1 });
    assert.equal(result.enabled, true);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("503"));
  } finally {
    global.fetch = originalFetch;
  }
});
