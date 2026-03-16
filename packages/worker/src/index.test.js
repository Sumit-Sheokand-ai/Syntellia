const test = require("node:test");
const assert = require("node:assert/strict");
const { ScanProcessingError } = require("./processor");
const { __testables } = require("./index");

test("computeRetryDelayMs grows exponentially and respects cap", () => {
  const delay1 = __testables.computeRetryDelayMs(1, { baseDelayMs: 1000, maxDelayMs: 30_000 });
  const delay2 = __testables.computeRetryDelayMs(2, { baseDelayMs: 1000, maxDelayMs: 30_000 });
  const delay5 = __testables.computeRetryDelayMs(5, { baseDelayMs: 1000, maxDelayMs: 30_000 });
  const delay10 = __testables.computeRetryDelayMs(10, { baseDelayMs: 1000, maxDelayMs: 30_000 });

  assert.equal(delay1, 1000);
  assert.equal(delay2, 2000);
  assert.equal(delay5, 16_000);
  assert.equal(delay10, 30_000);
});

test("shouldRetryScan returns true only for retryable errors below max attempts", () => {
  const retryableError = new ScanProcessingError("NETWORK_TIMEOUT", "timeout", { retryable: true });
  const nonRetryableError = new ScanProcessingError("INVALID_TARGET", "invalid", { retryable: false });

  assert.equal(__testables.shouldRetryScan(retryableError, 1, 3), true);
  assert.equal(__testables.shouldRetryScan(retryableError, 3, 3), false);
  assert.equal(__testables.shouldRetryScan(nonRetryableError, 1, 3), false);
  assert.equal(__testables.shouldRetryScan(new Error("generic"), 1, 3), true);
});
