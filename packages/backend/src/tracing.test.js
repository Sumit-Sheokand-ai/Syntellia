const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeTraceId,
  extractTraceIdFromHeaders,
  resolveTraceIdFromHeaders
} = require("./tracing");

test("normalizeTraceId accepts 32-hex and strips hyphens", () => {
  assert.equal(normalizeTraceId("00112233445566778899aabbccddeeff"), "00112233445566778899aabbccddeeff");
  assert.equal(normalizeTraceId("00112233-4455-6677-8899-aabbccddeeff"), "00112233445566778899aabbccddeeff");
  assert.equal(normalizeTraceId("not-a-trace-id"), null);
});

test("extractTraceIdFromHeaders prefers traceparent and falls back to x-trace-id", () => {
  assert.equal(
    extractTraceIdFromHeaders({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
    }),
    "4bf92f3577b34da6a3ce929d0e0e4736"
  );
  assert.equal(
    extractTraceIdFromHeaders({
      "x-trace-id": "00112233-4455-6677-8899-aabbccddeeff"
    }),
    "00112233445566778899aabbccddeeff"
  );
});

test("resolveTraceIdFromHeaders returns generated trace id when missing", () => {
  const traceId = resolveTraceIdFromHeaders({});
  assert.equal(typeof traceId, "string");
  assert.equal(traceId.length, 32);
});
