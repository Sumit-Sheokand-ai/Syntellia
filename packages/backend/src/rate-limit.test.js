const test = require("node:test");
const assert = require("node:assert/strict");
const { createMemoryRateLimiter, createSupabaseRateLimiter } = require("./rate-limit");

test("createMemoryRateLimiter blocks after max requests in window", () => {
  let now = 0;
  const limiter = createMemoryRateLimiter({
    windowMs: 1000,
    maxRequests: 2,
    timeProvider: () => now
  });

  assert.equal(limiter.check("user-1").allowed, true);
  assert.equal(limiter.check("user-1").allowed, true);

  const blocked = limiter.check("user-1");
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
});

test("createMemoryRateLimiter resets after window boundary", () => {
  let now = 0;
  const limiter = createMemoryRateLimiter({
    windowMs: 1000,
    maxRequests: 1,
    timeProvider: () => now
  });

  assert.equal(limiter.check("user-2").allowed, true);
  assert.equal(limiter.check("user-2").allowed, false);

  now = 1001;
  assert.equal(limiter.check("user-2").allowed, true);
});

test("createSupabaseRateLimiter maps shared rpc response fields", async () => {
  const limiter = createSupabaseRateLimiter({
    supabase: {
      async rpc(functionName, params) {
        assert.equal(functionName, "take_rate_limit_token");
        assert.equal(typeof params.p_bucket_key, "string");
        return {
          data: [
            {
              allowed: true,
              request_count: 2,
              retry_after_seconds: 41
            }
          ],
          error: null
        };
      }
    },
    windowMs: 60_000,
    maxRequests: 5,
    timeProvider: () => 1_700_000_000_000
  });

  const result = await limiter.check("user-3");
  assert.equal(result.allowed, true);
  assert.equal(result.limit, 5);
  assert.equal(result.remaining, 3);
  assert.equal(result.retryAfterSeconds, 41);
});
