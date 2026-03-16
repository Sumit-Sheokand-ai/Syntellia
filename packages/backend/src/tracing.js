const { randomBytes } = require("node:crypto");

const HEX_32_PATTERN = /^[a-f0-9]{32}$/i;
const TRACEPARENT_PATTERN = /^00-([a-f0-9]{32})-([a-f0-9]{16})-[a-f0-9]{2}$/i;

function generateTraceId() {
  return randomBytes(16).toString("hex");
}

function normalizeTraceId(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  const compact = raw.replace(/-/g, "");
  if (!HEX_32_PATTERN.test(compact)) return null;
  return compact;
}

function extractTraceIdFromHeaders(headers) {
  if (!headers || typeof headers !== "object") return null;

  const traceParent = headers.traceparent ?? headers["traceparent"];
  if (typeof traceParent === "string") {
    const match = traceParent.trim().match(TRACEPARENT_PATTERN);
    if (match) return match[1].toLowerCase();
  }

  const xTraceId = headers["x-trace-id"] ?? headers.xTraceId;
  return normalizeTraceId(xTraceId);
}

function resolveTraceIdFromHeaders(headers) {
  return extractTraceIdFromHeaders(headers) ?? generateTraceId();
}

module.exports = {
  generateTraceId,
  normalizeTraceId,
  extractTraceIdFromHeaders,
  resolveTraceIdFromHeaders
};
