const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");
const { requireAuth, requireRoles } = require("./auth");
const { scanRouter } = require("./scan-router");
const { getSupabaseAdminClient } = require("./db");
const { createApiTelemetry } = require("./telemetry");
const { createTelemetryExporter } = require("./telemetry-exporter");
const { resolveTraceIdFromHeaders } = require("./tracing");
const openApiSpec = require("../openapi.json");

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from the GitHub Pages frontend, or wildcard in dev.
// Set ALLOWED_ORIGIN=https://your-org.github.io on Render.
const rawOrigin = process.env.ALLOWED_ORIGIN ?? "*";
const allowedOrigins = rawOrigin === "*" ? "*" : rawOrigin.split(",").map((s) => s.trim());
const API_TELEMETRY_HEARTBEAT_MS = Number.parseInt(process.env.API_TELEMETRY_HEARTBEAT_MS ?? "60000", 10) || 60_000;
const apiTelemetry = createApiTelemetry({
  sampleLimit: Number.parseInt(process.env.API_TELEMETRY_SAMPLE_SIZE ?? "400", 10) || 400
});
const apiTelemetryExporter = createTelemetryExporter({
  service: "syntellia-backend",
  endpoint: process.env.API_TELEMETRY_EXPORT_URL ?? process.env.TELEMETRY_EXPORT_URL ?? "",
  bearerToken: process.env.TELEMETRY_EXPORT_BEARER_TOKEN ?? "",
  timeoutMs: Number.parseInt(process.env.TELEMETRY_EXPORT_TIMEOUT_MS ?? "3000", 10) || 3000
});
const OPERATIONS_ROLES = ["super_admin", "admin", "ops", "security"];

function isMissingSupabaseServiceCredentialsError(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("Missing Supabase service credentials")
    || message.includes("SUPABASE_SERVICE_ROLE_KEY");
}

function sanitizePathForLogs(path) {
  if (!path) return path;
  if (path.startsWith("/api/shared/")) {
    return "/api/shared/[redacted-token]";
  }
  return path;
}

async function getQueueStatusSnapshot() {
  let queue = {
    queued: null,
    running: null,
    completed: null,
    failed: null,
    source: "unavailable"
  };

  try {
    const supabase = getSupabaseAdminClient();
    const countScansByStatus = async (status) => {
      const { count, error } = await supabase
        .from("scans")
        .select("*", { count: "exact", head: true })
        .eq("status", status);

      if (error) throw error;
      return count ?? 0;
    };

    const [queued, running, completed, failed] = await Promise.all([
      countScansByStatus("Queued"),
      countScansByStatus("Running"),
      countScansByStatus("Completed"),
      countScansByStatus("Failed")
    ]);
    queue = {
      queued,
      running,
      completed,
      failed,
      source: "supabase"
    };
  } catch (error) {
    if (isMissingSupabaseServiceCredentialsError(error)) {
      return {
        ...queue,
        source: "degraded-no-admin-credentials"
      };
    }

    queue = {
      ...queue,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  return queue;
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: allowedOrigins !== "*"
  })
);
app.use((req, res, next) => {
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "DENY");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");

  const proto = req.headers["x-forwarded-proto"];
  if (proto === "https" || req.secure) {
    res.setHeader("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  next();
});
app.use((req, res, next) => {
  const requestId = randomUUID();
  const traceId = resolveTraceIdFromHeaders(req.headers);
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  req.traceId = traceId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("x-trace-id", traceId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const path = sanitizePathForLogs(req.originalUrl);

    apiTelemetry.observeHttpRequest({
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs
    });

    console.log(
      JSON.stringify({
        level: "info",
        service: "syntellia-backend",
        event: "http_request",
        requestId,
        traceId,
        method: req.method,
        path,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2))
      })
    );
  });

  next();
});

app.use(express.json({ limit: "128kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "syntellia-backend", ts: new Date().toISOString() });
});
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "syntellia-backend", ts: new Date().toISOString() });
});
app.get("/readyz", async (_req, res) => {
  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("scans").select("id").limit(1);
    if (error) throw error;
    return res.json({ ok: true, service: "syntellia-backend", ts: new Date().toISOString() });
  } catch (error) {
    if (isMissingSupabaseServiceCredentialsError(error)) {
      return res.json({
        ok: true,
        degraded: true,
        service: "syntellia-backend",
        code: "DEPENDENCY_DEGRADED_NO_ADMIN_CREDENTIALS",
        ts: new Date().toISOString()
      });
    }

    return res.status(503).json({
      ok: false,
      service: "syntellia-backend",
      code: "DEPENDENCY_UNAVAILABLE",
      error: "Readiness dependency check failed.",
      detail: error instanceof Error ? error.message : String(error),
      ts: new Date().toISOString()
    });
  }
});
app.get("/ops/metrics", requireAuth, requireRoles(OPERATIONS_ROLES), async (_req, res) => {
  const telemetrySnapshot = apiTelemetry.snapshot();
  const queue = await getQueueStatusSnapshot();

  return res.json({
    ok: true,
    service: "syntellia-backend",
    ts: new Date().toISOString(),
    telemetry: telemetrySnapshot,
    queue,
    export: apiTelemetryExporter.status()
  });
});

async function emitApiTelemetryHeartbeat() {
  const payload = {
    telemetry: apiTelemetry.snapshot(),
    queue: await getQueueStatusSnapshot()
  };
  console.log(
    JSON.stringify({
      level: "info",
      service: "syntellia-backend",
      event: "backend_telemetry_heartbeat",
      heartbeatIntervalMs: API_TELEMETRY_HEARTBEAT_MS,
      payload
    })
  );

  const result = await apiTelemetryExporter.exportEvent("backend_telemetry_heartbeat", payload);
  if (!result.ok) {
    console.error(
      JSON.stringify({
        level: "error",
        service: "syntellia-backend",
        event: "backend_telemetry_export_failed",
        message: result.error
      })
    );
  }
}

const apiTelemetryTimer = setInterval(() => {
  emitApiTelemetryHeartbeat().catch((error) => {
    console.error(
      JSON.stringify({
        level: "error",
        service: "syntellia-backend",
        event: "backend_telemetry_heartbeat_failed",
        message: error instanceof Error ? error.message : String(error)
      })
    );
  });
}, API_TELEMETRY_HEARTBEAT_MS);
if (typeof apiTelemetryTimer.unref === "function") {
  apiTelemetryTimer.unref();
}
app.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});
// Backward-compatible route mounting:
// - /api/* remains supported for existing clients
// - /api/v1/* is the versioned surface for new integrations

app.use("/api", scanRouter);
app.use("/api/v1", scanRouter);
app.use((req, res) => {
  res.status(404).json({
    error: "Not found.",
    code: "NOT_FOUND",
    requestId: req.requestId,
    traceId: req.traceId
  });
});

app.listen(PORT, () => {
  console.log(`Syntellia backend listening on port ${PORT}`);
});
