const { randomBytes, randomUUID } = require("node:crypto");
const { createSupabaseUserClient, getSupabaseAdminClient } = require("./db");

const sizeConfig = {
  "Quick check": { pageLimit: 1 },
  "Standard review": { pageLimit: 5 },
  "Full walkthrough": { pageLimit: 10 }
};
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const SHARE_TOKEN_TTL_DAYS = Number.parseInt(process.env.SHARE_TOKEN_TTL_DAYS ?? "14", 10) || 14;
const MAX_SAVED_HISTORY_VIEWS = 8;
const ALLOWED_HISTORY_VIEW_STATUS_FILTERS = new Set([
  "All",
  "Queued",
  "Running",
  "Completed",
  "Failed"
]);

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
    shareTokenExpiresAt: row.share_token_expires_at ?? undefined,
    shareRevokedAt: row.share_revoked_at ?? undefined,
    report: row.report ?? null
  };
}
function mapSavedHistoryViewRow(row) {
  const statusFilter = ALLOWED_HISTORY_VIEW_STATUS_FILTERS.has(row.status_filter)
    ? row.status_filter
    : "All";

  return {
    id: row.id,
    name: row.name,
    statusFilter,
    searchText: row.search_text ?? "",
    createdAt: row.created_at
  };
}

function resolvePageSize(rawPageSize) {
  const parsed = Number.parseInt(rawPageSize ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function isShareTokenActive(row, now = new Date()) {
  if (!row?.share_token) return false;
  if (row.share_revoked_at) return false;
  if (!row.share_token_expires_at) return true;

  const expiresAt = new Date(row.share_token_expires_at);
  if (Number.isNaN(expiresAt.getTime())) return false;
  return expiresAt.getTime() > now.getTime();
}

function computeShareTokenExpiry(now = new Date()) {
  return new Date(now.getTime() + SHARE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function trimSavedHistoryViews(supabase, userId) {
  const { data: staleRows, error: staleError } = await supabase
    .from("saved_history_views")
    .select("id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(MAX_SAVED_HISTORY_VIEWS, MAX_SAVED_HISTORY_VIEWS + 200);

  if (staleError) throw new Error(`Unable to trim saved history views: ${staleError.message}`);

  const staleIds = (staleRows ?? []).map((row) => row.id).filter(Boolean);
  if (!staleIds.length) return;

  const { error: deleteError } = await supabase
    .from("saved_history_views")
    .delete()
    .eq("user_id", userId)
    .in("id", staleIds);

  if (deleteError) {
    throw new Error(`Unable to remove stale saved history views: ${deleteError.message}`);
  }
}

async function createScan(userId, accessToken, input) {
  const id = `scan-${randomUUID()}`;
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

async function listScans(userId, accessToken, options = {}) {
  const supabase = createSupabaseUserClient(accessToken);
  const pageSize = resolvePageSize(options.pageSize);
  const status = typeof options.status === "string" ? options.status.trim() : "";
  const cursor = typeof options.cursor === "string" ? options.cursor.trim() : "";

  let query = supabase
    .from("scans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);

  if (status && ["Queued", "Running", "Completed", "Failed"].includes(status)) {
    query = query.eq("status", status);
  }
  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Unable to list scans: ${error.message}`);
  const rows = data ?? [];
  const hasMore = rows.length > pageSize;
  const items = (hasMore ? rows.slice(0, pageSize) : rows).map(mapRow);
  const nextCursor = hasMore ? rows[pageSize - 1].created_at : null;
  return { scans: items, nextCursor };
}

async function listSavedHistoryViews(userId, accessToken) {
  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase
    .from("saved_history_views")
    .select("id, name, status_filter, search_text, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_SAVED_HISTORY_VIEWS);

  if (error) throw new Error(`Unable to list saved history views: ${error.message}`);

  return (data ?? []).map(mapSavedHistoryViewRow);
}

async function saveSavedHistoryView(userId, accessToken, input) {
  const supabase = createSupabaseUserClient(accessToken);
  const now = new Date().toISOString();
  const name = input.name.trim();
  const statusFilter = ALLOWED_HISTORY_VIEW_STATUS_FILTERS.has(input.statusFilter)
    ? input.statusFilter
    : "All";
  const searchText = typeof input.searchText === "string" ? input.searchText : "";

  const { data: existing, error: readError } = await supabase
    .from("saved_history_views")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (readError) throw new Error(`Unable to load saved history view: ${readError.message}`);

  let row;
  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("saved_history_views")
      .update({
        name,
        status_filter: statusFilter,
        search_text: searchText,
        updated_at: now
      })
      .eq("id", existing.id)
      .eq("user_id", userId)
      .select("id, name, status_filter, search_text, created_at, updated_at")
      .single();

    if (updateError) throw new Error(`Unable to update saved history view: ${updateError.message}`);
    row = updated;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("saved_history_views")
      .insert({
        id: `view-${randomUUID()}`,
        user_id: userId,
        name,
        status_filter: statusFilter,
        search_text: searchText,
        created_at: now,
        updated_at: now
      })
      .select("id, name, status_filter, search_text, created_at, updated_at")
      .single();

    if (insertError) throw new Error(`Unable to create saved history view: ${insertError.message}`);
    row = inserted;
  }

  await trimSavedHistoryViews(supabase, userId);
  return mapSavedHistoryViewRow(row);
}

async function deleteSavedHistoryView(userId, accessToken, viewId) {
  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase
    .from("saved_history_views")
    .delete()
    .eq("id", viewId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Unable to delete saved history view: ${error.message}`);
  return Boolean(data?.id);
}

function generateShareToken() {
  return randomBytes(18).toString("base64url");
}

async function createOrGetShareToken(userId, accessToken, scanId) {
  const supabase = createSupabaseUserClient(accessToken);

  const { data: existing, error: readError } = await supabase
    .from("scans")
    .select("id, share_token, share_token_expires_at, share_revoked_at")
    .eq("id", scanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (readError) throw new Error(`Unable to fetch scan for sharing: ${readError.message}`);
  if (!existing) return null;
  if (isShareTokenActive(existing)) {
    return {
      shareToken: existing.share_token,
      expiresAt: existing.share_token_expires_at ?? null
    };
  }

  const shareToken = generateShareToken();
  const expiresAt = computeShareTokenExpiry();
  const { data: updated, error: updateError } = await supabase
    .from("scans")
    .update({
      share_token: shareToken,
      shared_at: new Date().toISOString(),
      share_token_expires_at: expiresAt,
      share_revoked_at: null
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .select("share_token, share_token_expires_at")
    .maybeSingle();

  if (updateError) throw new Error(`Unable to create share token: ${updateError.message}`);
  if (!updated?.share_token) return null;
  return {
    shareToken: updated.share_token,
    expiresAt: updated.share_token_expires_at ?? null
  };
}

async function revokeShareToken(userId, accessToken, scanId) {
  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase
    .from("scans")
    .update({
      share_revoked_at: new Date().toISOString(),
      share_token: null,
      share_token_expires_at: null
    })
    .eq("id", scanId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Unable to revoke share token: ${error.message}`);
  return Boolean(data?.id);
}

async function getSharedScanByToken(shareToken) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("scans")
    .select("id, site_name, url, scan_size, login_mode, focus_area, project_name, page_limit, status, created_at, started_at, completed_at, error, report, share_token, share_token_expires_at, share_revoked_at")
    .eq("share_token", shareToken)
    .eq("status", "Completed")
    .maybeSingle();

  if (error) throw new Error(`Unable to fetch shared scan: ${error.message}`);
  if (!data) return null;
  if (!isShareTokenActive(data)) return null;

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
    shareToken: data.share_token,
    shareTokenExpiresAt: data.share_token_expires_at ?? undefined
  };
}

module.exports = {
  createScan,
  getScan,
  listScans,
  listSavedHistoryViews,
  saveSavedHistoryView,
  deleteSavedHistoryView,
  createOrGetShareToken,
  revokeShareToken,
  getSharedScanByToken
};
