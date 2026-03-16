"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { ShellCard } from "@/components/ui/shell-card";
import { formatDateTimeForLocale } from "@/lib/accessibility";
import {
  deleteHistoryViewViaApi,
  listSavedHistoryViewsViaApi,
  listScansViaApi,
  saveHistoryViewViaApi,
  trackAnalyticsEvent
} from "@/lib/scan-api-client";
import type { MessageKey } from "@/lib/i18n";
import type {
  HistoryStatusFilter,
  SavedHistoryView,
  ScanRecord,
  ScanStatus
} from "@/lib/scan-types";

const statusFilters: Array<HistoryStatusFilter> = ["All", "Queued", "Running", "Completed", "Failed"];
const statusLabelKeys: Record<HistoryStatusFilter, MessageKey> = {
  All: "scan.status.all",
  Queued: "scan.status.queued",
  Running: "scan.status.running",
  Completed: "scan.status.completed",
  Failed: "scan.status.failed"
};

const LAST_VISIT_STORAGE_KEY = "syntellia.history.last-visit.v1";
const REGRESSION_DROP_THRESHOLD = 8;
type StatusFilter = HistoryStatusFilter;
type HistoryAlertSummary = {
  completedSinceLastVisit: number;
  failedSinceLastVisit: number;
  regressionCount: number;
};


function getStatusClasses(status: ScanStatus) {
  if (status === "Completed") return "border-[#7cf5d4]/25 bg-[#7cf5d4]/10 text-[#bbffe9]";
  if (status === "Failed") return "border-[#ffb39f]/30 bg-[#ffb39f]/10 text-[#ffd6cb]";
  if (status === "Running") return "border-[#6ca8ff]/30 bg-[#6ca8ff]/10 text-[#c7deff]";
  return "border-white/12 bg-white/8 text-white/80";
}

function getAverageScore(scan: ScanRecord): number | null {
  const values = scan.report?.scores?.map((score) => score.value).filter((value) => Number.isFinite(value)) ?? [];
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function getScanTimestamp(scan: ScanRecord): number {
  return Date.parse(scan.completedAt ?? scan.createdAt);
}

function getSiteKey(scan: ScanRecord): string {
  try {
    return new URL(scan.url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return scan.siteName.toLowerCase();
  }
}

function countRegressions(scans: ScanRecord[]): number {
  const grouped = new Map<string, ScanRecord[]>();

  for (const scan of scans) {
    if (scan.status !== "Completed") continue;
    if (getAverageScore(scan) === null) continue;
    const key = getSiteKey(scan);
    const existing = grouped.get(key) ?? [];
    existing.push(scan);
    grouped.set(key, existing);
  }

  let regressions = 0;
  for (const records of grouped.values()) {
    if (records.length < 2) continue;
    const sorted = [...records].sort((a, b) => getScanTimestamp(b) - getScanTimestamp(a));
    const latest = getAverageScore(sorted[0]);
    const previous = getAverageScore(sorted[1]);
    if (latest === null || previous === null) continue;
    if (previous - latest >= REGRESSION_DROP_THRESHOLD) {
      regressions += 1;
    }
  }

  return regressions;
}


function buildAlertSummary(scans: ScanRecord[], lastVisitValue: string | null): HistoryAlertSummary | null {
  const lastVisit = lastVisitValue ? Date.parse(lastVisitValue) : Number.NaN;
  const hasLastVisit = Number.isFinite(lastVisit);
  const completedSinceLastVisit = hasLastVisit
    ? scans.filter((scan) => scan.status === "Completed" && getScanTimestamp(scan) > lastVisit).length
    : 0;
  const failedSinceLastVisit = hasLastVisit
    ? scans.filter((scan) => scan.status === "Failed" && getScanTimestamp(scan) > lastVisit).length
    : 0;
  const regressionCount = countRegressions(scans);

  if (!completedSinceLastVisit && !failedSinceLastVisit && !regressionCount) {
    return null;
  }

  return {
    completedSinceLastVisit,
    failedSinceLastVisit,
    regressionCount
  };
}

export default function ScanHistoryPage() {
  const { locale, t } = useI18n();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchText, setSearchText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedHistoryView[]>([]);
  const [isLoadingSavedViews, setIsLoadingSavedViews] = useState(true);
  const [isSavingView, setIsSavingView] = useState(false);
  const [deletingViewId, setDeletingViewId] = useState<string | null>(null);
  const [savedViewsError, setSavedViewsError] = useState<string | null>(null);
  const [newViewName, setNewViewName] = useState("");
  const [alerts, setAlerts] = useState<HistoryAlertSummary | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    let isActive = true;

    setIsLoadingSavedViews(true);
    listSavedHistoryViewsViaApi()
      .then((views) => {
        if (!isActive) return;
        setSavedViews(views);
        setSavedViewsError(null);
      })
      .catch((savedError) => {
        if (!isActive) return;
        setSavedViewsError(savedError instanceof Error ? savedError.message : t("scan.history.error.load"));
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingSavedViews(false);
      });

    return () => {
      isActive = false;
    };
  }, [t]);

  useEffect(() => {
    let isActive = true;

    setIsLoading(true);
    setError(null);
    listScansViaApi({ status: statusFilter, pageSize: 25 })
      .then((result) => {
        if (!isActive) return;
        setScans(result.scans);
        setNextCursor(result.nextCursor);

        if (typeof window === "undefined") return;
        const lastVisit = window.localStorage.getItem(LAST_VISIT_STORAGE_KEY);
        const summary = buildAlertSummary(result.scans, lastVisit);
        setAlerts(summary);
        window.localStorage.setItem(LAST_VISIT_STORAGE_KEY, new Date().toISOString());

        if (summary) {
          void trackAnalyticsEvent("history_alerts_generated", summary);
        }
      })
      .catch((scanError) => {
        if (!isActive) return;
        setError(scanError instanceof Error ? scanError.message : t("scan.history.error.load"));
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [statusFilter, t]);

  const filteredScans = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    return scans.filter((scan) => {
      const matchesStatus = statusFilter === "All" ? true : scan.status === statusFilter;
      if (!matchesStatus) return false;

      if (dateFrom && new Date(scan.createdAt) < new Date(dateFrom)) return false;
      if (dateTo && new Date(scan.createdAt) > new Date(`${dateTo}T23:59:59Z`)) return false;

      if (!text) return true;

      return (
        scan.siteName.toLowerCase().includes(text) ||
        scan.url.toLowerCase().includes(text) ||
        scan.focusArea.toLowerCase().includes(text) ||
        scan.projectName.toLowerCase().includes(text)
      );
    });
  }, [scans, searchText, statusFilter, dateFrom, dateTo]);

  const saveCurrentView = async () => {
    const name = newViewName.trim();
    if (!name || isSavingView) return;

    setIsSavingView(true);
    setSavedViewsError(null);

    try {
      const result = await saveHistoryViewViaApi({
        name,
        statusFilter,
        searchText
      });

      setSavedViews(result.views);
      setNewViewName("");

      void trackAnalyticsEvent("history_view_saved", {
        name,
        statusFilter,
        hasSearchText: Boolean(searchText.trim())
      });
    } catch (savedError) {
      setSavedViewsError(savedError instanceof Error ? savedError.message : t("scan.history.error.load"));
    } finally {
      setIsSavingView(false);
    }
  };

  const applySavedView = (view: SavedHistoryView) => {
    setStatusFilter(view.statusFilter);
    setSearchText(view.searchText);

    void trackAnalyticsEvent("history_view_applied", {
      name: view.name,
      statusFilter: view.statusFilter,
      hasSearchText: Boolean(view.searchText.trim())
    });
  };

  const deleteSavedView = async (viewId: string) => {
    if (!viewId || deletingViewId) return;

    setDeletingViewId(viewId);
    setSavedViewsError(null);

    try {
      const result = await deleteHistoryViewViaApi(viewId);
      setSavedViews(result.views);
    } catch (savedError) {
      setSavedViewsError(savedError instanceof Error ? savedError.message : t("scan.history.error.load"));
    } finally {
      setDeletingViewId(null);
    }
  };

  const loadMore = async () => {
    if (!nextCursor) return;

    try {
      setIsLoadingMore(true);
      const result = await listScansViaApi({
        status: statusFilter,
        pageSize: 25,
        cursor: nextCursor
      });
      setScans((current) => [...current, ...result.scans]);
      setNextCursor(result.nextCursor);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t("scan.history.error.loadMore"));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <main id="main-content" className="space-y-6">
      <ShellCard className="p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/45">{t("scan.history.badge")}</p>
        <h2 className="mt-4 text-4xl font-semibold text-white">{t("scan.history.title")}</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-white/66">
          {t("scan.history.subtitle")}
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-[0.7fr,1fr]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">{t("scan.history.statusLabel")}</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white"
            >
              {statusFilters.map((status) => (
                <option key={status} value={status} className="bg-[#09101d] text-white">
                  {t(statusLabelKeys[status])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">{t("scan.history.searchLabel")}</label>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t("scan.history.searchPlaceholder")}
              className="w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">From date</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white [color-scheme:dark]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">To date</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white [color-scheme:dark]"
            />
          </div>
        </div>
        <div className="mt-8 rounded-[22px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">{t("scan.history.savedViewsTitle")}</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={newViewName}
              onChange={(event) => setNewViewName(event.target.value)}
              placeholder={t("scan.history.savedViewsPlaceholder")}
              className="w-full rounded-[16px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              disabled={!newViewName.trim() || isSavingView}
              className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("scan.history.savedViews.save")}
            </button>
          </div>
          {savedViewsError ? (
            <p className="mt-4 text-sm text-[#ffb39f]" role="alert" aria-live="assertive">
              {savedViewsError}
            </p>
          ) : null}
          {isLoadingSavedViews ? (
            <p className="mt-4 text-sm text-white/58" role="status" aria-live="polite">
              {t("scan.history.loading")}
            </p>
          ) : savedViews.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {savedViews.map((view) => (
                <div key={view.id} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/82">
                  <button type="button" onClick={() => applySavedView(view)} className="hover:text-white">
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedView(view.id)}
                    disabled={deletingViewId === view.id}
                    className="rounded-full border border-white/10 px-2 py-[1px] text-[10px] text-white/65 hover:text-white"
                    aria-label={t("scan.history.savedViews.deleteAria", { name: view.name })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/58">
              {t("scan.history.savedViews.empty")}
            </p>
          )}
        </div>
      </ShellCard>

      <ShellCard className="p-8">
        {alerts ? (
          <div className="mb-6 rounded-[22px] border border-[#6ca8ff]/20 bg-[#6ca8ff]/8 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[#c7deff]">{t("scan.history.alerts.title")}</p>
            <div className="mt-4 grid gap-3 text-sm text-white/85 md:grid-cols-3">
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                {t("scan.history.alerts.completed", { count: alerts.completedSinceLastVisit })}
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                {t("scan.history.alerts.failed", { count: alerts.failedSinceLastVisit })}
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                {t("scan.history.alerts.regressions", { count: alerts.regressionCount })}
              </div>
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-white/62" role="status" aria-live="polite">{t("scan.history.loading")}</p>
        ) : error ? (
          <p className="text-sm text-[#ffb39f]" role="alert" aria-live="assertive">{error}</p>
        ) : filteredScans.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-white/62">{t("scan.history.empty")}</p>
            <Link href="/app/scan/new" className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d]">
              {t("scan.history.cta.startScan")}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredScans.map((scan) => (
              <div
                key={scan.id}
                className="rounded-[22px] border border-white/10 bg-white/5 px-5 py-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-white">{scan.siteName}</p>
                      <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em] ${getStatusClasses(scan.status)}`}>
                        {t(statusLabelKeys[scan.status])}
                      </span>
                    </div>
                    <p className="text-sm text-white/64">{scan.url}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                      {t("scan.history.row.meta", {
                        projectName: scan.projectName,
                        scanSize: scan.scanSize,
                        focusArea: scan.focusArea,
                        pageLimit: scan.pageLimit
                      })}
                    </p>
                    <p className="text-xs text-white/45">{t("scan.history.row.created", { value: formatDateTimeForLocale(scan.createdAt, locale) })}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/app/scan/view?scanId=${scan.id}`}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
                    >
                      {t("scan.history.cta.open")}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {nextCursor ? (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoadingMore ? t("scan.history.cta.loadingMore") : t("scan.history.cta.loadMore")}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </ShellCard>
    </main>
  );
}
