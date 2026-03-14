const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");
const { scanRouter } = require("./scan-router");
const openApiSpec = require("../openapi.json");

const app = express();
const PORT = process.env.PORT || 3001;

// Allow requests from the GitHub Pages frontend, or wildcard in dev.
// Set ALLOWED_ORIGIN=https://your-org.github.io on Render.
const rawOrigin = process.env.ALLOWED_ORIGIN ?? "*";
const allowedOrigins = rawOrigin === "*" ? "*" : rawOrigin.split(",").map((s) => s.trim());

function sanitizePathForLogs(path) {
  if (!path) return path;
  if (path.startsWith("/api/shared/")) {
    return "/api/shared/[redacted-token]";
  }
  return path;
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
  const startedAt = process.hrtime.bigint();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    console.log(
      JSON.stringify({
        level: "info",
        service: "syntellia-backend",
        event: "http_request",
        requestId,
        method: req.method,
        path: sanitizePathForLogs(req.originalUrl),
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
app.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

app.use("/api", scanRouter);
app.use((req, res) => {
  res.status(404).json({
    error: "Not found.",
    code: "NOT_FOUND",
    requestId: req.requestId
  });
});

app.listen(PORT, () => {
  console.log(`Syntellia backend listening on port ${PORT}`);
});
