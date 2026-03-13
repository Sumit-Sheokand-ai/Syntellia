const { createSupabaseUserClient } = require("./db");

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
    pageLimit: row.page_limit,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    error: row.error ?? undefined,
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

module.exports = { createScan, getScan, listScans };
