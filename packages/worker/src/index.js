const { claimNextQueuedScan, writeScanResult, writeScanError } = require("./db");
const { extractScanData, buildReport, ScanProcessingError } = require("./processor");

const POLL_INTERVAL_MS = 5000;
const MAX_PROCESS_ATTEMPTS = Number.parseInt(process.env.MAX_SCAN_PROCESS_ATTEMPTS ?? "2", 10) || 2;
const stats = {
  processed: 0,
  failed: 0
};

async function runScanWithRetry(scan) {
  const input = {
    url: scan.url,
    scanSize: scan.scan_size,
    loginMode: scan.login_mode,
    focusArea: scan.focus_area
  };

  let attempt = 0;
  while (attempt < MAX_PROCESS_ATTEMPTS) {
    attempt += 1;

    try {
      const scanData = await extractScanData(input);
      return { scanData, attempt };
    } catch (error) {
      const retryable = error instanceof ScanProcessingError ? error.retryable : true;
      const code = error instanceof ScanProcessingError ? error.code : "UNKNOWN_ERROR";
      const message = error instanceof Error ? error.message : "Unknown error";

      if (!retryable || attempt >= MAX_PROCESS_ATTEMPTS) {
        throw error;
      }

      console.warn(
        JSON.stringify({
          level: "warn",
          service: "syntellia-worker",
          event: "scan_retrying",
          scanId: scan.id,
          attempt,
          nextAttempt: attempt + 1,
          code,
          message
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 750 * attempt));
    }
  }

  throw new Error("Scan retries exhausted unexpectedly.");
}

async function poll() {
  const scan = await claimNextQueuedScan();

  if (!scan) {
    return; // no work available
  }

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
      queueLatencyMs
    })
  );

  try {
    const { scanData, attempt } = await runScanWithRetry(scan);
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

    console.log(
      JSON.stringify({
        level: "info",
        service: "syntellia-worker",
        event: "scan_completed",
        scanId: scan.id,
        pageTitle: scanData.pages[0]?.pageTitle ?? "Untitled page",
        pagesScanned: scanData.crawl.pagesScanned,
        executionMode: scanData.crawl.executionMode,
        attemptsUsed: attempt,
        durationMs: Date.now() - startedAt,
        totals: {
          processed: stats.processed,
          failed: stats.failed
        }
      })
    );
  } catch (error) {
    const code = error instanceof ScanProcessingError ? error.code : "SCAN_FAILED";
    const message = error instanceof Error ? error.message : "Unknown error";

    await writeScanError(scan.id, scan.user_id, message);
    stats.failed += 1;

    console.error(
      JSON.stringify({
        level: "error",
        service: "syntellia-worker",
        event: "scan_failed",
        scanId: scan.id,
        code,
        message,
        durationMs: Date.now() - startedAt,
        totals: {
          processed: stats.processed,
          failed: stats.failed
        }
      })
    );
  }
}

async function main() {
  console.log(
    JSON.stringify({
      level: "info",
      service: "syntellia-worker",
      event: "worker_started",
      pollIntervalMs: POLL_INTERVAL_MS,
      maxProcessAttempts: MAX_PROCESS_ATTEMPTS
    })
  );

  while (true) {
    try {
      await poll();
    } catch (error) {
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
