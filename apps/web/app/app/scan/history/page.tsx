"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShellCard } from "@/components/ui/shell-card";
import { listScansViaApi, trackAnalyticsEvent } from "@/lib/scan-api-client";
import type { ScanRecord, ScanStatus } from "@/lib/scan-types";

const statusFilters: Array<"All" | ScanStatus> = ["All", "Queued", "Running", "Completed", "Failed"];
const SAVED_VIEWS_STORAGE_KEY = "syntellia.saved-history-views.v1";
const LAST_VISIT_STORAGE_KEY = "syntellia.history.last-visit.v1";
const REGRESSION_DROP_THRESHOLD = 8;

type StatusFilter = "All" | ScanStatus;
type SavedHistoryView = {
  id: string;
  name: string;
  statusFilter: StatusFilter;
  searchText: string;
  createdAt: string;
};
type HistoryAlertSummary = {
  completedSinceLastVisit: number;
  failedSinceLastVisit: number;
  regressionCount: number;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

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

function loadSavedViews(): SavedHistoryView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is SavedHistoryView => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Partial<SavedHistoryView>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.searchText === "string" &&
        typeof candidate.statusFilter === "string" &&
        typeof candidate.createdAt === "string"
      );
    });
  } catch {
    return [];
  }
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
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [searchText, setSearchText] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedHistoryView[]>([]);
  const [newViewName, setNewViewName] = useState("");
  const [alerts, setAlerts] = useState<HistoryAlertSummary | null>(null);
  const [hasHydratedSavedViews, setHasHydratedSavedViews] = useState(false);

  useEffect(() => {
    setSavedViews(loadSavedViews());
    setHasHydratedSavedViews(true);
  }, []);

  useEffect(() => {
    if (!hasHydratedSavedViews) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SAVED_VIEWS_STORAGE_KEY, JSON.stringify(savedViews));
  }, [hasHydratedSavedViews, savedViews]);

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
        setError(scanError instanceof Error ? scanError.message : "Unable to load scans.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [statusFilter]);

  const filteredScans = useMemo(() => {
    const text = searchText.trim().toLowerCase();

    return scans.filter((scan) => {
      const matchesStatus = statusFilter === "All" ? true : scan.status === statusFilter;
      if (!matchesStatus) return false;

      if (!text) return true;

      return (
        scan.siteName.toLowerCase().includes(text) ||
        scan.url.toLowerCase().includes(text) ||
        scan.focusArea.toLowerCase().includes(text) ||
        scan.projectName.toLowerCase().includes(text)
      );
    });
  }, [scans, searchText, statusFilter]);

  const saveCurrentView = () => {
    const name = newViewName.trim();
    if (!name) return;

    const nextView: SavedHistoryView = {
      id: `view-${Date.now()}`,
      name,
      statusFilter,
      searchText,
      createdAt: new Date().toISOString()
    };

    setSavedViews((current) => {
      const withoutSameName = current.filter((view) => view.name.toLowerCase() !== name.toLowerCase());
      return [nextView, ...withoutSameName].slice(0, 8);
    });
    setNewViewName("");

    void trackAnalyticsEvent("history_view_saved", {
      name,
      statusFilter,
      hasSearchText: Boolean(searchText.trim())
    });
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

  const deleteSavedView = (viewId: string) => {
    setSavedViews((current) => current.filter((view) => view.id !== viewId));
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
      setError(scanError instanceof Error ? scanError.message : "Unable to load additional scans.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <main className="space-y-6">
      <ShellCard className="p-8">
        <p className="text-sm uppercase tracking-[0.3em] text-white/45">Scan history</p>
        <h2 className="mt-4 text-4xl font-semibold text-white">Track every scan in one place.</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-white/66">
          Filter by status, search by site or URL, and open any record to review progress or final report output.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-[0.7fr,1fr]">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "All" | ScanStatus)}
              className="w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white"
            >
              {statusFilters.map((status) => (
                <option key={status} value={status} className="bg-[#09101d] text-white">
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.24em] text-white/45">Search</label>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search by site, URL, or focus area"
              className="w-full rounded-[18px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
          </div>
        </div>
        <div className="mt-8 rounded-[22px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-white/45">Saved views</p>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={newViewName}
              onChange={(event) => setNewViewName(event.target.value)}
              placeholder="Name this view (for example: completed this week)"
              className="w-full rounded-[16px] border border-white/12 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-white/40"
            />
            <button
              type="button"
              onClick={saveCurrentView}
              disabled={!newViewName.trim()}
              className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save view
            </button>
          </div>
          {savedViews.length ? (
            <div className="mt-4 flex flex-wrap gap-3">
              {savedViews.map((view) => (
                <div key={view.id} className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-white/82">
                  <button type="button" onClick={() => applySavedView(view)} className="hover:text-white">
                    {view.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavedView(view.id)}
                    className="rounded-full border border-white/10 px-2 py-[1px] text-[10px] text-white/65 hover:text-white"
                    aria-label={`Delete saved view ${view.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/58">
              Save your current filters to quickly return to important scan slices.
            </p>
          )}
        </div>
      </ShellCard>

      <ShellCard className="p-8">
        {alerts ? (
          <div className="mb-6 rounded-[22px] border border-[#6ca8ff]/20 bg-[#6ca8ff]/8 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-[#c7deff]">Workflow alerts</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3 text-sm text-white/85">
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                Completed since last visit: {alerts.completedSinceLastVisit}
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                Failed since last visit: {alerts.failedSinceLastVisit}
              </div>
              <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                Regressions detected: {alerts.regressionCount}
              </div>
            </div>
          </div>
        ) : null}
        {isLoading ? (
          <p className="text-sm text-white/62">Loading scan history...</p>
        ) : error ? (
          <p className="text-sm text-[#ffb39f]">{error}</p>
        ) : filteredScans.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-white/62">No scans match your filters yet.</p>
            <Link href="/app/scan/new" className="inline-flex rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d]">
              Start a new scan
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
                        {scan.status}
                      </span>
                    </div>
                    <p className="text-sm text-white/64">{scan.url}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-white/45">
                      {scan.projectName} · {scan.scanSize} · {scan.focusArea} · up to {scan.pageLimit} pages
                    </p>
                    <p className="text-xs text-white/45">Created: {formatDate(scan.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/app/scan/view?scanId=${scan.id}`}
                      className="rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm text-white transition hover:bg-white/12"
                    >
                      Open
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
                  {isLoadingMore ? "Loading more..." : "Load more scans"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </ShellCard>
    </main>
  );
}
