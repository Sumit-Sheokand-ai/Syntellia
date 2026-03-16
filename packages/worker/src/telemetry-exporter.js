function readPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function createTelemetryExporter({
  service,
  endpoint = "",
  bearerToken = "",
  timeoutMs = 3000
}) {
  const normalizedEndpoint = typeof endpoint === "string" ? endpoint.trim() : "";
  const normalizedService = typeof service === "string" && service.trim() ? service.trim() : "syntellia";
  const normalizedBearerToken = typeof bearerToken === "string" ? bearerToken.trim() : "";
  const normalizedTimeoutMs = readPositiveInteger(timeoutMs, 3000);

  async function exportEvent(event, payload) {
    if (!normalizedEndpoint) {
      return { enabled: false, ok: true };
    }

    if (typeof fetch !== "function") {
      return { enabled: true, ok: false, error: "fetch is not available in this runtime" };
    }

    const headers = {
      "content-type": "application/json"
    };
    if (normalizedBearerToken) {
      headers.authorization = `Bearer ${normalizedBearerToken}`;
    }

    try {
      const response = await fetch(normalizedEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          service: normalizedService,
          event,
          ts: new Date().toISOString(),
          payload
        }),
        signal: AbortSignal.timeout(normalizedTimeoutMs)
      });

      if (!response.ok) {
        return {
          enabled: true,
          ok: false,
          error: `telemetry export failed with HTTP ${response.status}`
        };
      }

      return { enabled: true, ok: true };
    } catch (error) {
      return {
        enabled: true,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  return {
    exportEvent,
    status() {
      return {
        enabled: Boolean(normalizedEndpoint),
        endpoint: normalizedEndpoint || null,
        timeoutMs: normalizedTimeoutMs
      };
    }
  };
}

module.exports = {
  createTelemetryExporter
};
