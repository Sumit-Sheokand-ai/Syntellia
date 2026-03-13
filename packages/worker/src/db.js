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

/**
 * Atomically claims the oldest Queued scan. Returns the scan row, or null if
 * no work is available or another worker instance claimed it first.
 */
async function claimNextQueuedScan() {
  const supabase = getSupabaseAdminClient();

  // Find the oldest queued scan
  const { data: candidates } = await supabase
    .from("scans")
    .select("id, user_id, url, scan_size, login_mode, focus_area")
    .eq("status", "Queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!candidates?.length) return null;

  const candidate = candidates[0];

  // Attempt to claim it with an optimistic status check — if another worker
  // instance claimed it first, the update will match zero rows and we skip.
  const { data: claimed } = await supabase
    .from("scans")
    .update({ status: "Running", started_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("status", "Queued")
    .select("id, user_id, url, scan_size, login_mode, focus_area")
    .maybeSingle();

  return claimed ?? null;
}

async function writeScanResult(scanId, userId, report) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("scans")
    .update({
      status: "Completed",
      completed_at: new Date().toISOString(),
      report,
      error: null
    })
    .eq("id", scanId)
    .eq("user_id", userId);

  if (error) throw new Error(`Unable to save scan result: ${error.message}`);
}

async function writeScanError(scanId, userId, errorMessage) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("scans")
    .update({
      status: "Failed",
      completed_at: new Date().toISOString(),
      report: null,
      error: errorMessage
    })
    .eq("id", scanId)
    .eq("user_id", userId);

  if (error) throw new Error(`Unable to save scan error: ${error.message}`);
}

module.exports = { claimNextQueuedScan, writeScanResult, writeScanError };
