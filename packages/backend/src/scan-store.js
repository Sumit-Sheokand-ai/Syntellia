const { randomBytes } = require("node:crypto");
const { createSupabaseUserClient, getSupabaseAdminClient } = require("./db");

const sizeConfig = {
  "Quick check": { pageLimit: 1 },
  "Standard review": { pageLimit: 5 },
  "Full walkthrough": { pageLimit: 10 }
};

function deriveSiteName(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname
      .split(".")
      .slice(0, 2)
      .join(" ")
      .replace(/(^\w|[-_ ]\w)/g, (match) => match.toUpperCase())
      .trim();
  } catch {
    return "Website Review";
  }
}

function getSizeDetails(scanSize) {
  return sizeConfig[scanSize] ?? sizeConfig["Standard review"];
}

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    siteName: row.site_name,
    url: row.url,
    scanSize: row.scan_size,
    loginMode: row.login_mode,
    focusArea: row.focus_area,
    projectName: row.project_name ?? "General",
    pageLimit: row.page_limit,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
    shareToken: row.share_token ?? undefined,
    report: row.report ?? null
  };
}

async function createScan(userId, accessToken, input) {
  const id = `scan-${Math.random().toString(36).slice(2, 10)}`;
  const { pageLimit } = getSizeDetails(input.scanSize);

  const row = {
    id,
    user_id: userId,
    site_name: deriveSiteName(input.url),
    url: input.url,
    scan_size: input.scanSize,
    login_mode: input.loginMode,
    focus_area: input.focusArea,
    project_name: input.projectName ?? "General",
    page_limit: pageLimit,
    status: "Queued",
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    error: null,
    report: null
  };

  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase.from("scans").insert(row).select("*").single();

  if (error) throw new Error(`Unable to create scan: ${error.message}`);
  return mapRow(data);
}

async function getScan(userId, accessToken, scanId) {
  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Unable to fetch scan: ${error.message}`);
  return data ? mapRow(data) : null;
}

async function listScans(userId, accessToken) {
  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Unable to list scans: ${error.message}`);
  return (data ?? []).map(mapRow);
}

function generateShareToken() {
  return randomBytes(18).toString("base64url");
}

async function createOrGetShareToken(userId, accessToken, scanId) {
  const supabase = createSupabaseUserClient(accessToken);

  const { data: existing, error: readError } = await supabase
    .from("scans")
    .select("id, share_token")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw new Error(`Unable to fetch scan for sharing: ${readError.message}`);
  if (!existing) return null;
  if (existing.share_token) {
    return existing.share_token;
  }

  const shareToken = generateShareToken();
  const { data: updated, error: updateError } = await supabase
    .from("scans")
    .update({
      share_token: shareToken,
      shared_at: new Date().toISOString()
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .select("share_token")
    .maybeSingle();

  if (updateError) throw new Error(`Unable to create share token: ${updateError.message}`);
  return updated?.share_token ?? null;
}

async function getSharedScanByToken(shareToken) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scans")
    .select("id, site_name, url, scan_size, login_mode, focus_area, project_name, page_limit, status, created_at, started_at, completed_at, error, report, share_token")
    .eq("share_token", shareToken)
    .eq("status", "Completed")
    .maybeSingle();

  if (error) throw new Error(`Unable to fetch shared scan: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    siteName: data.site_name,
    url: data.url,
    scanSize: data.scan_size,
    loginMode: data.login_mode,
    focusArea: data.focus_area,
    projectName: data.project_name ?? "General",
    pageLimit: data.page_limit,
    status: data.status,
    createdAt: data.created_at,
    startedAt: data.started_at ?? undefined,
    completedAt: data.completed_at ?? undefined,
    error: data.error ?? undefined,
    report: data.report ?? null,
    shareToken: data.share_token
  };
}

module.exports = { createScan, getScan, listScans, createOrGetShareToken, getSharedScanByToken };
