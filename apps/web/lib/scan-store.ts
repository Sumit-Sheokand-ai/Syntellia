import type { ScanReport } from "@/lib/report-schema";
import { extractPageData, type ExtractedPageData } from "@/lib/page-extractor";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { CreateScanInput, ScanRecord, ScanStatus } from "@/lib/scan-types";

const sizeConfig: Record<string, { pageLimit: number; scope: string; detail: string }> = {
  "Quick check": {
    pageLimit: 1,
    scope: "Single page review",
    detail: "A fast look at one page."
  },
  "Standard review": {
    pageLimit: 5,
    scope: "Up to 5 important pages",
    detail: "A balanced review of the main journey."
  },
  "Full walkthrough": {
    pageLimit: 10,
    scope: "Up to 10 key pages",
    detail: "A broader review for a fuller picture."
  }
};

const focusConfig: Record<string, { checks: string[]; outputs: string[]; components: string[]; interactions: string[] }> = {
  "Overall feel": {
    checks: ["Visual consistency", "Ease of use", "Main messages", "User flow"],
    outputs: ["A plain-language summary", "Style highlights", "Top UX observations"],
    components: ["Hero sections", "Content blocks", "Buttons and calls to action", "Menus and page structure"],
    interactions: ["Overall feel", "Visual style", "Page clarity", "User path"]
  },
  "Look and brand": {
    checks: ["Colors", "Fonts", "Spacing", "Visual rhythm"],
    outputs: ["Style summary", "Color and font review", "Brand consistency notes"],
    components: ["Brand headers", "Feature cards", "Buttons", "Highlight sections"],
    interactions: ["Look and brand", "Color balance", "Typography", "Visual consistency"]
  },
  "Content clarity": {
    checks: ["Headline clarity", "Reading flow", "Section order", "Supporting copy"],
    outputs: ["Clarity summary", "Readability notes", "Message structure review"],
    components: ["Headlines", "Supporting sections", "Lists and cards", "Calls to action"],
    interactions: ["Content clarity", "Reading order", "Message flow", "Decision points"]
  },
  "Navigation and actions": {
    checks: ["Navigation", "Primary actions", "Page hierarchy", "Decision points"],
    outputs: ["Navigation summary", "Action-path notes", "Hierarchy review"],
    components: ["Navigation bars", "Menus", "Buttons", "Forms and conversion points"],
    interactions: ["Navigation and actions", "Primary next steps", "Wayfinding", "Action clarity"]
  }
};

const activeJobs = new Set<string>();
const QUEUE_DELAY_MS = 1200;

type ScanRow = {
  id: string;
  user_id: string;
  site_name: string;
  url: string;
  scan_size: string;
  login_mode: string;
  focus_area: string;
  project_name: string | null;
  page_limit: number;
  status: ScanStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  share_token: string | null;
  report: ScanReport | null;
};

function mapRowToRecord(row: ScanRow): ScanRecord {
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
    report: row.report
  };
}

function mapRecordToRowInsert(record: ScanRecord): ScanRow {
  return {
    id: record.id,
    user_id: record.userId,
    site_name: record.siteName,
    url: record.url,
    scan_size: record.scanSize,
    login_mode: record.loginMode,
    focus_area: record.focusArea,
    project_name: record.projectName,
    page_limit: record.pageLimit,
    status: record.status,
    created_at: record.createdAt,
    started_at: record.startedAt ?? null,
    completed_at: record.completedAt ?? null,
    error: record.error ?? null,
    share_token: record.shareToken ?? null,
    report: record.report
  };
}

function mapRecordToRowUpdate(record: ScanRecord) {
  return {
    user_id: record.userId,
    site_name: record.siteName,
    url: record.url,
    scan_size: record.scanSize,
    login_mode: record.loginMode,
    focus_area: record.focusArea,
    project_name: record.projectName,
    page_limit: record.pageLimit,
    status: record.status,
    created_at: record.createdAt,
    started_at: record.startedAt ?? null,
    completed_at: record.completedAt ?? null,
    error: record.error ?? null,
    share_token: record.shareToken ?? null,
    report: record.report
  };
}

function formatSupabaseError(context: string, error: { message: string }) {
  return `${context}: ${error.message}`;
}

const deriveSiteName = (url: string) => {
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
};

const getSizeDetails = (scanSize: string) => sizeConfig[scanSize] ?? sizeConfig["Standard review"];
const getFocusDetails = (focusArea: string) => focusConfig[focusArea] ?? focusConfig["Overall feel"];

const scoreWithinRange = (value: number) => Math.max(35, Math.min(98, value));

const buildInteractions = (extracted: ExtractedPageData) => {
  const interactionSignals = [
    ...extracted.buttonLabels.slice(0, 4).map((label) => `Action: ${label}`),
    ...extracted.navLabels.slice(0, 3).map((label) => `Navigation: ${label}`)
  ];

  if (!interactionSignals.length) {
    interactionSignals.push("Minimal visible action labels detected");
  }

  return interactionSignals.slice(0, 6);
};

const buildFindings = (input: CreateScanInput, extracted: ExtractedPageData, siteName: string) => {
  const structureFinding = extracted.counts.headings > 0
    ? `${siteName} exposes ${extracted.counts.headings} heading${extracted.counts.headings === 1 ? "" : "s"} and ${extracted.counts.sections} section-level block${extracted.counts.sections === 1 ? "" : "s"}, which gives the report real page structure to work from.`
    : `${siteName} does not expose clear heading structure in the fetched HTML, so content hierarchy may be harder to read quickly.`;

  const actionFinding = extracted.counts.buttons + extracted.counts.forms > 0
    ? `The fetched page includes ${extracted.counts.buttons} button${extracted.counts.buttons === 1 ? "" : "s"} and ${extracted.counts.forms} form${extracted.counts.forms === 1 ? "" : "s"}, which helps anchor the ${input.focusArea.toLowerCase()} review in real action points.`
    : `The fetched page exposes very few obvious action controls, so the ${input.focusArea.toLowerCase()} review will lean more on structure and messaging than conversion paths.`;

  const styleFinding = extracted.colors.length || extracted.fonts.length
    ? `Visible style signals include ${extracted.colors.length} color token${extracted.colors.length === 1 ? "" : "s"} and ${extracted.fonts.length} font family reference${extracted.fonts.length === 1 ? "" : "ies"} pulled from accessible HTML and CSS.`
    : "Only limited style tokens were readable from the page source, so style extraction is still partial for pages that rely heavily on runtime styling or locked-down assets.";

  return [
    {
      title: "Messaging and structure",
      detail: structureFinding,
      severity: extracted.counts.headings > 0 ? "low" : "high"
    },
    {
      title: "Navigation and action cues",
      detail: actionFinding,
      severity: extracted.counts.buttons + extracted.counts.forms > 0 ? "low" : "medium"
    },
    {
      title: "Visible style signals",
      detail: styleFinding,
      severity: extracted.colors.length || extracted.fonts.length ? "low" : "medium"
    }
  ] as ScanReport["findings"];
};

const buildReport = (input: CreateScanInput, extracted: ExtractedPageData): ScanReport => {
  const siteName = deriveSiteName(input.url);
  const sizeDetails = getSizeDetails(input.scanSize);
  const focusDetails = getFocusDetails(input.focusArea);
  const structureScore = scoreWithinRange(52 + extracted.counts.headings * 6 + extracted.counts.sections * 3 + extracted.counts.navs * 4);
  const actionScore = scoreWithinRange(48 + extracted.counts.buttons * 7 + extracted.counts.forms * 8 + Math.min(extracted.counts.links, 20));
  const styleScore = scoreWithinRange(44 + extracted.colors.length * 6 + extracted.fonts.length * 8 + extracted.components.length * 4);

  return {
    siteName,
    scannedAt: new Date().toISOString(),
    scope: sizeDetails.scope,
    summary: `${siteName} was fetched successfully and the report now reflects real page signals from ${extracted.finalUrl}. We found ${extracted.counts.links} links, ${extracted.counts.buttons} buttons, ${extracted.counts.forms} forms, and ${extracted.counts.headings} headings, then shaped the review around ${input.focusArea.toLowerCase()}.`,
    scores: [
      {
        label: "Page structure",
        value: structureScore,
        trend: `${extracted.counts.headings} headings and ${extracted.counts.sections} sections detected`
      },
      {
        label: "Style coverage",
        value: styleScore,
        trend: `${extracted.colors.length} colors and ${extracted.fonts.length} font references detected`
      },
      {
        label: "Action clarity",
        value: actionScore,
        trend: `${extracted.counts.buttons} buttons and ${extracted.counts.forms} forms detected`
      }
    ],
    tokenGroups: [
      {
        label: "Detected style tokens",
        values: extracted.colors.length || extracted.fonts.length ? [...extracted.colors.slice(0, 5), ...extracted.fonts.slice(0, 3)] : ["No readable colors", "No readable fonts"]
      },
      {
        label: "Detected page structure",
        values: [
          `${extracted.counts.headings} headings`,
          `${extracted.counts.links} links`,
          `${extracted.counts.buttons} buttons`,
          `${extracted.counts.forms} forms`,
          `${extracted.counts.images} visual assets`
        ]
      },
      {
        label: "Review setup",
        values: [sizeDetails.detail, input.loginMode, focusDetails.checks[0], `Up to ${sizeDetails.pageLimit} page${sizeDetails.pageLimit === 1 ? "" : "s"}`]
      }
    ],
    findings: buildFindings(input, extracted, siteName),
    components: extracted.components.length ? extracted.components : focusDetails.components,
    interactions: buildInteractions(extracted),
    source: {
      finalUrl: extracted.finalUrl,
      statusCode: extracted.statusCode,
      pageTitle: extracted.pageTitle,
      metaDescription: extracted.metaDescription,
      headingCount: extracted.counts.headings,
      linkCount: extracted.counts.links,
      buttonCount: extracted.counts.buttons,
      formCount: extracted.counts.forms,
      imageCount: extracted.counts.images,
      colors: extracted.colors,
      fonts: extracted.fonts,
      notes: extracted.notes
    }
  };
};

async function fetchScanRow(userId: string, scanId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("scans").select("*").eq("id", scanId).eq("user_id", userId).maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError("Unable to fetch scan", error));
  }

  return (data as ScanRow | null) ?? null;
}

async function updateScan(userId: string, scanId: string, updater: (current: ScanRecord) => ScanRecord) {
  const current = await getScan(userId, scanId);

  if (!current) {
    return null;
  }

  const next = updater(current);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("scans")
    .update(mapRecordToRowUpdate(next))
    .eq("id", scanId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(formatSupabaseError("Unable to update scan", error));
  }

  return mapRowToRecord(data as ScanRow);
}

async function processScan(userId: string, scanId: string) {
  await updateScan(userId, scanId, (current) => ({
    ...current,
    status: "Running",
    startedAt: new Date().toISOString(),
    error: undefined
  }));

  const current = await getScan(userId, scanId);

  if (!current) {
    return;
  }

  try {
    const extracted = await extractPageData(current.url);

    await updateScan(userId, scanId, (record) => ({
      ...record,
      status: "Completed",
      completedAt: new Date().toISOString(),
      report: buildReport(
        {
          url: record.url,
          scanSize: record.scanSize,
          loginMode: record.loginMode,
          focusArea: record.focusArea
        },
        extracted
      )
    }));
  } catch (error) {
    await updateScan(userId, scanId, (record) => ({
      ...record,
      status: "Failed",
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "The page could not be fetched.",
      report: null
    }));
  }
}

export async function createScan(userId: string, input: CreateScanInput) {
  const id = `scan-${Math.random().toString(36).slice(2, 10)}`;
  const sizeDetails = getSizeDetails(input.scanSize);

  const record: ScanRecord = {
    id,
    userId,
    siteName: deriveSiteName(input.url),
    url: input.url,
    scanSize: input.scanSize,
    loginMode: input.loginMode,
    focusArea: input.focusArea,
    projectName: input.projectName?.trim() || "General",
    pageLimit: sizeDetails.pageLimit,
    status: "Queued",
    createdAt: new Date().toISOString(),
    report: null
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("scans").insert(mapRecordToRowInsert(record)).select("*").single();

  if (error) {
    throw new Error(formatSupabaseError("Unable to create scan", error));
  }

  return mapRowToRecord(data as ScanRow);
}

export async function advanceScan(userId: string, scanId: string) {
  const scan = await getScan(userId, scanId);

  if (!scan) {
    return null;
  }

  if (scan.status === "Completed" || scan.status === "Failed") {
    return scan;
  }

  if (scan.status === "Queued") {
    const queuedFor = Date.now() - new Date(scan.createdAt).getTime();

    if (queuedFor < QUEUE_DELAY_MS) {
      return scan;
    }

    return updateScan(userId, scanId, (current) => ({
      ...current,
      status: "Running",
      startedAt: current.startedAt ?? new Date().toISOString()
    }));
  }

  const jobKey = `${userId}:${scanId}`;

  if (activeJobs.has(jobKey)) {
    return scan;
  }

  activeJobs.add(jobKey);

  try {
    await processScan(userId, scanId);
  } finally {
    activeJobs.delete(jobKey);
  }

  return getScan(userId, scanId);
}

export async function getScan(userId: string, scanId: string) {
  const row = await fetchScanRow(userId, scanId);
  return row ? mapRowToRecord(row) : null;
}

export async function listScans(userId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("scans").select("*").eq("user_id", userId).order("created_at", { ascending: false });

  if (error) {
    throw new Error(formatSupabaseError("Unable to list scans", error));
  }

  return ((data as ScanRow[] | null) ?? []).map(mapRowToRecord);
}
