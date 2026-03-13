const { claimNextQueuedScan, writeScanResult, writeScanError } = require("./db");
const { extractPageData, buildReport } = require("./processor");

const POLL_INTERVAL_MS = 5000;

async function poll() {
  const scan = await claimNextQueuedScan();

  if (!scan) {
    return; // no work available
  }

  console.log(`[worker] Processing scan ${scan.id} — ${scan.url}`);

  try {
    const extracted = await extractPageData(scan.url);
    const report = buildReport(
      {
        url: scan.url,
        scanSize: scan.scan_size,
        loginMode: scan.login_mode,
        focusArea: scan.focus_area
      },
      extracted
    );
    await writeScanResult(scan.id, scan.user_id, report);
    console.log(`[worker] Scan ${scan.id} completed — ${extracted.pageTitle}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeScanError(scan.id, scan.user_id, message);
    console.error(`[worker] Scan ${scan.id} failed — ${message}`);
  }
}

async function main() {
  console.log("[worker] Started. Polling for queued scans every", POLL_INTERVAL_MS, "ms...");

  while (true) {
    try {
      await poll();
    } catch (error) {
      console.error("[worker] Unexpected poll error:", error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  console.error("[worker] Fatal crash:", error);
  process.exit(1);
});
