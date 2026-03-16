const { getSupabaseAdminClient } = require("./db");
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 90;
const DEFAULT_STORE = (process.env.RATE_LIMIT_STORE ?? "supabase").toLowerCase();

function readPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function createSupabaseRateLimiter({
  supabase,
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  timeProvider = () => Date.now()
}) {
  if (!supabase || typeof supabase.rpc !== "function") {
    throw new Error("Supabase client is required for shared rate limiting.");
  }

  return {
    async check(key) {
      const now = timeProvider();
      const windowStartMs = Math.floor(now / windowMs) * windowMs;
      const windowEndMs = windowStartMs + windowMs;
      const fallbackRetryAfterSeconds = Math.max(1, Math.ceil((windowEndMs - now) / 1000));

      const { data, error } = await supabase.rpc("take_rate_limit_token", {
        p_bucket_key: normalizeRateLimitKey(key),
        p_window_start: new Date(windowStartMs).toISOString(),
        p_window_end: new Date(windowEndMs).toISOString(),
        p_max_requests: maxRequests
      });

      if (error) {
        throw new Error(`Shared rate limiter failed: ${error.message}`);
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row.allowed !== "boolean" || typeof row.request_count !== "number") {
        throw new Error("Shared rate limiter returned an invalid response.");
      }

      const retryAfterSeconds = Number.parseInt(String(row.retry_after_seconds ?? fallbackRetryAfterSeconds), 10);
      return {
        allowed: row.allowed,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - row.request_count),
        retryAfterSeconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : fallbackRetryAfterSeconds
      };
    }
  };
}

function createResilientRateLimiter({ windowMs, maxRequests, store }) {
  const memoryLimiter = createMemoryRateLimiter({ windowMs, maxRequests });

  if (store !== "supabase") {
    return {
      mode: "memory",
      async check(key) {
        return memoryLimiter.check(key);
      }
    };
  }

  try {
    const supabase = getSupabaseAdminClient();
    const sharedLimiter = createSupabaseRateLimiter({
      supabase,
      windowMs,
      maxRequests
    });

    return {
      mode: "supabase+memory-fallback",
      async check(key) {
        try {
          return await sharedLimiter.check(key);
        } catch (error) {
          console.error(
            JSON.stringify({
              level: "error",
              service: "syntellia-backend",
              event: "rate_limit_shared_store_error",
              message: error instanceof Error ? error.message : String(error)
            })
          );
          return memoryLimiter.check(key);
        }
      }
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        service: "syntellia-backend",
        event: "rate_limit_store_init_failed",
        message: error instanceof Error ? error.message : String(error),
        fallbackMode: "memory"
      })
    );
    return {
      mode: "memory",
      async check(key) {
        return memoryLimiter.check(key);
      }
    };
  }
}


function normalizeRateLimitKey(value) {
  const stringValue = String(value ?? "anonymous").trim();
  if (!stringValue) return "anonymous";
  return stringValue.slice(0, 200);
}
function createMemoryRateLimiter({
  windowMs = DEFAULT_WINDOW_MS,
  maxRequests = DEFAULT_MAX_REQUESTS,
  timeProvider = () => Date.now()
} = {}) {
  const buckets = new Map();

  function pruneIfStale(key, now) {
    const bucket = buckets.get(key);
    if (!bucket) return null;

    if (bucket.resetAt <= now) {
      buckets.delete(key);
      return null;
    }

    return bucket;
  }

  return {
    check(key) {
      const now = timeProvider();
      let bucket = pruneIfStale(key, now);

      if (!bucket) {
        bucket = {
          count: 0,
          resetAt: now + windowMs
        };
        buckets.set(key, bucket);
      }

      bucket.count += 1;

      const remaining = Math.max(0, maxRequests - bucket.count);
      const retryAfterMs = Math.max(0, bucket.resetAt - now);
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
      const allowed = bucket.count <= maxRequests;

      return {
        allowed,
        limit: maxRequests,
        remaining,
        retryAfterSeconds
      };
    }
  };
}

const limiter = createResilientRateLimiter({
  windowMs: readPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
  maxRequests: readPositiveInteger(process.env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_MAX_REQUESTS),
  store: DEFAULT_STORE
});

async function enforceUserRateLimit(req, res, next) {
  const key = normalizeRateLimitKey(req.user?.id ?? req.ip ?? "anonymous");
  const result = await limiter.check(key);

  res.setHeader("x-ratelimit-limit", String(result.limit));
  res.setHeader("x-ratelimit-remaining", String(result.remaining));
  res.setHeader("x-ratelimit-store", limiter.mode);

  if (result.allowed) {
    return next();
  }

  res.setHeader("retry-after", String(result.retryAfterSeconds));
  return res.status(429).json({
    error: "Too many requests. Please try again shortly.",
    code: "RATE_LIMIT_EXCEEDED",
    requestId: req.requestId,
    traceId: req.traceId
  });
}

module.exports = {
  createMemoryRateLimiter,
  createSupabaseRateLimiter,
  enforceUserRateLimit
};
