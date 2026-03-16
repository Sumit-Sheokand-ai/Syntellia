const test = require("node:test");
const assert = require("node:assert/strict");
const { createTelemetryExporter } = require("./telemetry-exporter");

test("worker telemetry exporter returns disabled state when endpoint missing", async () => {
  const exporter = createTelemetryExporter({
    service: "syntellia-worker",
    endpoint: ""
  });

  const result = await exporter.exportEvent("worker_telemetry_heartbeat", { ok: true });
  assert.equal(result.enabled, false);
  assert.equal(result.ok, true);
});

test("worker telemetry exporter handles network exceptions", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network down");
  };

  try {
    const exporter = createTelemetryExporter({
      service: "syntellia-worker",
      endpoint: "https://example.invalid/telemetry"
    });

    const result = await exporter.exportEvent("worker_telemetry_heartbeat", { ok: true });
    assert.equal(result.enabled, true);
    assert.equal(result.ok, false);
    assert.ok(result.error.includes("network down"));
  } finally {
    global.fetch = originalFetch;
  }
});
