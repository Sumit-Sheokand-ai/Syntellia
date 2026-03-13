const { getSupabaseAdminClient } = require("./db");

class EntitlementError extends Error {
  constructor(code, message, status = 403) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
    this.status = status;
  }
}

const DEFAULT_PLAN = {
  plan_name: "free",
  monthly_scan_limit: 30
};

function resolvePeriodStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function requiresPeriodReset(periodStartIso, now = new Date()) {
  if (!periodStartIso) return true;
  const periodStart = new Date(periodStartIso);
  if (Number.isNaN(periodStart.getTime())) return true;
  return (
    periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
    periodStart.getUTCMonth() !== now.getUTCMonth()
  );
}

async function getOrCreateEntitlement(userId) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_entitlements")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Unable to read entitlement: ${error.message}`);
  if (data) return data;

  const now = new Date().toISOString();
  const insertPayload = {
    user_id: userId,
    plan_name: DEFAULT_PLAN.plan_name,
    monthly_scan_limit: DEFAULT_PLAN.monthly_scan_limit,
    monthly_scans_used: 0,
    period_start: resolvePeriodStart(),
    created_at: now,
    updated_at: now
  };

  const { data: created, error: createError } = await supabase
    .from("user_entitlements")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createError) throw new Error(`Unable to create entitlement: ${createError.message}`);
  return created;
}

async function normalizeEntitlementPeriod(userId) {
  const supabase = getSupabaseAdminClient();
  let entitlement = await getOrCreateEntitlement(userId);

  if (requiresPeriodReset(entitlement.period_start)) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("user_entitlements")
      .update({
        monthly_scans_used: 0,
        period_start: resolvePeriodStart(),
        updated_at: now
      })
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw new Error(`Unable to reset entitlement period: ${error.message}`);
    entitlement = data;
  }

  return entitlement;
}

async function consumeScanCredit(userId) {
  const supabase = getSupabaseAdminClient();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const entitlement = await normalizeEntitlementPeriod(userId);
    const used = Number(entitlement.monthly_scans_used ?? 0);
    const limit = Number(entitlement.monthly_scan_limit ?? DEFAULT_PLAN.monthly_scan_limit);

    if (used >= limit) {
      throw new EntitlementError(
        "ENTITLEMENT_LIMIT_REACHED",
        `You've reached your monthly scan limit (${limit}) for the ${entitlement.plan_name} plan.`
      );
    }

    const nextUsed = used + 1;
    const { data, error } = await supabase
      .from("user_entitlements")
      .update({
        monthly_scans_used: nextUsed,
        updated_at: new Date().toISOString()
      })
      .eq("user_id", userId)
      .eq("monthly_scans_used", used)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`Unable to consume entitlement credit: ${error.message}`);
    if (data) return data;
  }

  throw new Error("Unable to consume entitlement credit due to concurrent updates.");
}

async function getEntitlementSummary(userId) {
  const entitlement = await normalizeEntitlementPeriod(userId);
  const used = Number(entitlement.monthly_scans_used ?? 0);
  const limit = Number(entitlement.monthly_scan_limit ?? DEFAULT_PLAN.monthly_scan_limit);

  return {
    planName: entitlement.plan_name,
    monthlyScanLimit: limit,
    monthlyScansUsed: used,
    remainingScans: Math.max(0, limit - used),
    periodStart: entitlement.period_start
  };
}

module.exports = {
  EntitlementError,
  consumeScanCredit,
  getEntitlementSummary
};
