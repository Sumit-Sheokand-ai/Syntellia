const {
  claimNextQueuedScan,
  extendScanLease,
  fetchQueueStatusCounts,
  requeueScanForRetry,
  writeScanResult,
  writeScanFailure
} = require("./db");
const { extractScanData, buildReport, ScanProcessingError } = require("./processor");
const { createTelemetryExporter } = require("./telemetry-exporter");
const { createWorkerTelemetry } = require("./telemetry");

function readPositiveInteger(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

const POLL_INTERVAL_MS = readPositiveInteger(process.env.SCAN_POLL_INTERVAL_MS, 5000);
const LEASE_DURATION_SECONDS = readPositiveInteger(process.env.SCAN_LEASE_DURATION_SECONDS, 90);
const LEASE_HEARTBEAT_INTERVAL_MS = Math.max(5000, Math.floor((LEASE_DURATION_SECONDS * 1000) / 2));
const MAX_SCAN_ATTEMPTS = readPositiveInteger(
  process.env.MAX_SCAN_ATTEMPTS ?? process.env.MAX_SCAN_PROCESS_ATTEMPTS,
  3
);
const RETRY_BASE_DELAY_MS = readPositiveInteger(process.env.SCAN_RETRY_BASE_DELAY_MS, 5000);
const RETRY_MAX_DELAY_MS = readPositiveInteger(process.env.SCAN_RETRY_MAX_DELAY_MS, 120000);
const WORKER_TELEMETRY_HEARTBEAT_MS = readPositiveInteger(process.env.SCAN_TELEMETRY_HEARTBEAT_MS, 60_000);
const workerTelemetry = createWorkerTelemetry({
  sampleLimit: readPositiveInteger(process.env.SCAN_TELEMETRY_SAMPLE_SIZE, 400)
});
const workerTelemetryExporter = createTelemetryExporter({
  service: "syntellia-worker",
  endpoint: process.env.WORKER_TELEMETRY_EXPORT_URL ?? process.env.TELEMETRY_EXPORT_URL ?? "",
  bearerToken: process.env.TELEMETRY_EXPORT_BEARER_TOKEN ?? "",
  timeoutMs: readPositiveInteger(process.env.TELEMETRY_EXPORT_TIMEOUT_MS, 3000)
});

const stats = {
  processed: 0,
  failed: 0,
  retried: 0
};

function computeRetryDelayMs(attemptCount, options = {}) {
  const baseDelayMs = readPositiveInteger(options.baseDelayMs, RETRY_BASE_DELAY_MS);
  const maxDelayMs = readPositiveInteger(options.maxDelayMs, RETRY_MAX_DELAY_MS);
  const exponent = Math.max(0, (attemptCount || 1) - 1);
  const delay = baseDelayMs * (2 ** exponent);
  return Math.min(delay, maxDelayMs);
}

function getErrorCode(error) {
  return error instanceof ScanProcessingError ? error.code : "SCAN_FAILED";
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Unknown error";
}

function shouldRetryScan(error, attemptCount, maxAttempts = MAX_SCAN_ATTEMPTS) {
  const retryable = error instanceof ScanProcessingError ? error.retryable : true;
  return retryable && attemptCount < maxAttempts;
}

function startLeaseHeartbeat(scan) {
  let stopped = false;
  const timer = setInterval(async () => {
    if (stopped) return;
    try {
      const extended = await extendScanLease(scan.id, scan.user_id, LEASE_DURATION_SECONDS);
      if (!extended) {
        console.warn(
          JSON.stringify({
            level: "warn",
            service: "syntellia-worker",
            event: "scan_lease_extension_missed",
            scanId: scan.id
          })
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "syntellia-worker",
          event: "scan_lease_extension_failed",
          scanId: scan.id,
          message: getErrorMessage(error)
        })
      );
    }
  }, LEASE_HEARTBEAT_INTERVAL_MS);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function poll() {
  const scan = await claimNextQueuedScan({ leaseDurationSeconds: LEASE_DURATION_SECONDS });
  workerTelemetry.recordPoll({ empty: !scan });

  if (!scan) {
    return;
  }

  const attemptCount = Number.isFinite(scan.attempt_count) ? scan.attempt_count : 1;
  const startedAt = Date.now();
  const queueLatencyMs = scan.created_at
    ? Math.max(0, Date.now() - new Date(scan.created_at).getTime())
    : null;

  console.log(
    JSON.stringify({
      level: "info",
      service: "syntellia-worker",
      event: "scan_started",
      scanId: scan.id,
      url: scan.url,
      queueLatencyMs,
      attemptCount
    })
  );

  const stopLeaseHeartbeat = startLeaseHeartbeat(scan);
  workerTelemetry.recordScanStarted({ queueLatencyMs });

  try {
    const scanData = await extractScanData({
      url: scan.url,
      scanSize: scan.scan_size,
      loginMode: scan.login_mode,
      focusArea: scan.focus_area
    });
    const report = buildReport(
      {
        url: scan.url,
        scanSize: scan.scan_size,
        loginMode: scan.login_mode,
        focusArea: scan.focus_area
      },
      scanData
    );

    await writeScanResult(scan.id, scan.user_id, report);
    stats.processed += 1;
    const durationMs = Date.now() - startedAt;
    workerTelemetry.recordScanCompleted({ durationMs });

    const payload = {
      telemetry: workerTelemetry.snapshot({
        queue
      }),
      totals: {
        processed: stats.processed,
        failed: stats.failed,
        retried: stats.retried
      }
    };
    console.log(
      JSON.stringify({
        level: "info",
        service: "syntellia-worker",
        event: "scan_completed",
        scanId: scan.id,
        pageTitle: scanData.pages[0]?.pageTitle ?? "Untitled page",
        pagesScanned: scanData.crawl.pagesScanned,
        executionMode: scanData.crawl.executionMode,
        attemptsUsed: attemptCount,
        durationMs,
        totals: {
          processed: stats.processed,
          failed: stats.failed,
          retried: stats.retried
        }
      })
    );
  } catch (error) {
    const code = getErrorCode(error);
    const message = getErrorMessage(error);
    const retryAllowed = shouldRetryScan(error, attemptCount, MAX_SCAN_ATTEMPTS);

    if (retryAllowed) {
      const retryDelayMs = computeRetryDelayMs(attemptCount);
      const retryAt = new Date(Date.now() + retryDelayMs).toISOString();
      const durationMs = Date.now() - startedAt;

      try {
        await requeueScanForRetry(scan.id, scan.user_id, {
          retryAt,
          errorMessage: message,
          errorCode: code
        });
        stats.retried += 1;
        workerTelemetry.recordRetryScheduled({
          durationMs,
          retryDelayMs
        });

        console.warn(
          JSON.stringify({
            level: "warn",
            service: "syntellia-worker",
            event: "scan_requeued_for_retry",
            scanId: scan.id,
            code,
            message,
            attemptCount,
            maxAttempts: MAX_SCAN_ATTEMPTS,
            retryDelayMs,
            retryAt,
            durationMs,
            totals: {
              processed: stats.processed,
              failed: stats.failed,
              retried: stats.retried
            }
          })
        );
      } catch (persistError) {
        const persistMessage = getErrorMessage(persistError);
        const durationMs = Date.now() - startedAt;
        await writeScanFailure(
          scan.id,
          scan.user_id,
          `Retry scheduling failed: ${persistMessage}. Original error: ${message}`,
          "RETRY_SCHEDULING_FAILED"
        );
        stats.failed += 1;
        workerTelemetry.recordScanFailed({ durationMs });

        console.error(
          JSON.stringify({
            level: "error",
            service: "syntellia-worker",
            event: "scan_retry_scheduling_failed",
            scanId: scan.id,
            code,
            message,
            persistMessage,
            durationMs: Date.now() - startedAt,
            totals: {
              processed: stats.processed,
              failed: stats.failed,
              retried: stats.retried
            }
          })
        );
      }
    } else {
      const durationMs = Date.now() - startedAt;
      await writeScanFailure(scan.id, scan.user_id, message, code);
      stats.failed += 1;
      workerTelemetry.recordScanFailed({ durationMs });

      console.error(
        JSON.stringify({
          level: "error",
          service: "syntellia-worker",
          event: "scan_failed_terminal",
          scanId: scan.id,
          code,
          message,
          attemptCount,
          maxAttempts: MAX_SCAN_ATTEMPTS,
          durationMs,
          totals: {
            processed: stats.processed,
            failed: stats.failed,
            retried: stats.retried
          }
        })
      );
    }
  } finally {
    stopLeaseHeartbeat();
  }
}

async function main() {
  const emitTelemetryHeartbeat = async () => {
    let queue;
    try {
      queue = await fetchQueueStatusCounts();
    } catch (error) {
      queue = {
        source: "unavailable",
        error: getErrorMessage(error)
      };
    }

    console.log(
      JSON.stringify({
        level: "info",
        service: "syntellia-worker",
        event: "worker_telemetry_heartbeat",
        heartbeatIntervalMs: WORKER_TELEMETRY_HEARTBEAT_MS,
        ...payload
      })
    );

    const result = await workerTelemetryExporter.exportEvent("worker_telemetry_heartbeat", payload);
    if (!result.ok) {
      console.error(
        JSON.stringify({
          level: "error",
          service: "syntellia-worker",
          event: "worker_telemetry_export_failed",
          message: result.error
        })
      );
    }
  };
  const telemetryTimer = setInterval(() => {
    emitTelemetryHeartbeat().catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          service: "syntellia-worker",
          event: "worker_telemetry_heartbeat_failed",
          message: getErrorMessage(error)
        })
      );
    });
  }, WORKER_TELEMETRY_HEARTBEAT_MS);
  if (typeof telemetryTimer.unref === "function") {
    telemetryTimer.unref();
  }
  console.log(
    JSON.stringify({
      level: "info",
      service: "syntellia-worker",
      event: "worker_started",
      pollIntervalMs: POLL_INTERVAL_MS,
      leaseDurationSeconds: LEASE_DURATION_SECONDS,
      leaseHeartbeatIntervalMs: LEASE_HEARTBEAT_INTERVAL_MS,
      maxScanAttempts: MAX_SCAN_ATTEMPTS,
      telemetryHeartbeatMs: WORKER_TELEMETRY_HEARTBEAT_MS,
      telemetryExportEnabled: workerTelemetryExporter.status().enabled
    })
  );

  while (true) {
    try {
      await poll();
    } catch (error) {
      workerTelemetry.recordPollError();
      console.error(
        JSON.stringify({
          level: "error",
          service: "syntellia-worker",
          event: "worker_poll_error",
          message: error instanceof Error ? error.message : String(error)
        })
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      JSON.stringify({
        level: "fatal",
        service: "syntellia-worker",
        event: "worker_fatal",
        message: error instanceof Error ? error.message : String(error)
      })
    );
    process.exit(1);
  });
}

module.exports = {
  main,
  poll,
  __testables: {
    readPositiveInteger,
    computeRetryDelayMs,
    shouldRetryScan
  }
};
