const { createClient } = require("@supabase/supabase-js");

let client = null;

function getSupabaseAdminClient() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false }
  });

  return client;
}

async function claimNextQueuedScan({ leaseDurationSeconds = 60 } = {}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_next_scan", {
    p_lease_seconds: leaseDurationSeconds
  });

  if (error) {
    throw new Error(`Unable to claim queued scan: ${error.message}`);
  }

  if (!Array.isArray(data) || !data.length) {
    return null;
  }

  return data[0] ?? null;
}

async function extendScanLease(scanId, userId, leaseDurationSeconds = 60) {
  const supabase = getSupabaseAdminClient();
  const leaseExpiresAt = new Date(Date.now() + leaseDurationSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("scans")
    .update({
      lease_expires_at: leaseExpiresAt
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("status", "Running")
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to extend scan lease: ${error.message}`);
  }

  return Boolean(data?.id);
}

async function requeueScanForRetry(scanId, userId, { retryAt, errorMessage, errorCode }) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("scans")
    .update({
      status: "Queued",
      lease_expires_at: null,
      next_retry_at: retryAt,
      last_error: errorMessage,
      last_error_code: errorCode,
      error: null,
      completed_at: null
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("status", "Running")
    .select("id, attempt_count")
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to requeue scan for retry: ${error.message}`);
  }

  return data ?? null;
}

async function writeScanResult(scanId, userId, report) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("scans")
    .update({
      status: "Completed",
      completed_at: new Date().toISOString(),
      report,
      error: null,
      last_error: null,
      last_error_code: null,
      lease_expires_at: null,
      next_retry_at: null
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("status", "Running");

  if (error) throw new Error(`Unable to save scan result: ${error.message}`);
}

async function writeScanFailure(scanId, userId, errorMessage, errorCode = "SCAN_FAILED") {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("scans")
    .update({
      status: "Failed",
      completed_at: new Date().toISOString(),
      report: null,
      error: errorMessage,
      last_error: errorMessage,
      last_error_code: errorCode,
      lease_expires_at: null,
      next_retry_at: null
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .eq("status", "Running");

  if (error) throw new Error(`Unable to save scan error: ${error.message}`);
}

async function fetchQueueStatusCounts() {
  const supabase = getSupabaseAdminClient();
  const countScansByStatus = async (status) => {
    const { count, error } = await supabase
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("status", status);

    if (error) throw new Error(`Unable to count ${status} scans: ${error.message}`);
    return count ?? 0;
  };

  const [queued, running, completed, failed] = await Promise.all([
    countScansByStatus("Queued"),
    countScansByStatus("Running"),
    countScansByStatus("Completed"),
    countScansByStatus("Failed")
  ]);

  return {
    queued,
    running,
    completed,
    failed
  };
}
module.exports = {
  claimNextQueuedScan,
  extendScanLease,
  fetchQueueStatusCounts,
  requeueScanForRetry,
  writeScanResult,
  writeScanFailure
};
