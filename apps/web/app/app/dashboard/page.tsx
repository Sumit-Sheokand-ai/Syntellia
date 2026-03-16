"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Globe, ArrowUpRight } from "lucide-react";
import {
  getEntitlementSummaryViaApi,
  listScansViaApi,
  trackAnalyticsEvent
} from "@/lib/scan-api-client";
import type { EntitlementSummary, ScanRecord } from "@/lib/scan-types";

type DashboardInsights = {
  inFlightCount: number;
  recentFailureCount: number;
  regressionCount: number;
  completedCount: number;
  avgHealthScore: number;
  latestScan: ScanRecord | null;
  recentScans: ScanRecord[];
};

function getAverageScore(scan: ScanRecord): number | null {
  const values = scan.report?.scores?.map((s) => s.value).filter((v) => Number.isFinite(v)) ?? [];
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getScanTimestamp(scan: ScanRecord): number {
  return Date.parse(scan.completedAt ?? scan.createdAt);
}

function getSiteKey(scan: ScanRecord): string {
  try { return new URL(scan.url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return scan.siteName.toLowerCase(); }
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
    if (previous - latest >= 8) regressions += 1;
  }
  return regressions;
}

function summarizeInsights(scans: ScanRecord[]): DashboardInsights {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentFailureCount = scans.filter((s) => s.status === "Failed" && getScanTimestamp(s) >= sevenDaysAgo).length;
  const inFlightCount = scans.filter((s) => s.status === "Queued" || s.status === "Running").length;
  const completedScans = scans.filter((s) => s.status === "Completed");
  const completedCount = completedScans.length;
  const scores = completedScans.map(getAverageScore).filter((v): v is number => v !== null);
  const avgHealthScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 85;
  const sorted = [...scans].sort((a, b) => getScanTimestamp(b) - getScanTimestamp(a));
  return {
    inFlightCount, recentFailureCount,
    regressionCount: countRegressions(scans),
    completedCount,
    avgHealthScore,
    latestScan: sorted[0] ?? null,
    recentScans: sorted.slice(0, 4),
  };
}

function getEventLabel(scan: ScanRecord): string {
  if (scan.status === "Completed") return "Scan_Seq Complete";
  if (scan.status === "Failed") return "Anomaly Detected";
  if (scan.status === "Running") return "Scan Running";
  return "Scan Queued";
}

function getEventColor(scan: ScanRecord): string {
  if (scan.status === "Completed") return "#00e5ff";
  if (scan.status === "Failed") return "#f97316";
  if (scan.status === "Running") return "#a78bfa";
  return "#60a5fa";
}

function getElapsedLabel(scan: ScanRecord): string {
  const ms = Date.now() - getScanTimestamp(scan);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return `T-MINUS ${Math.floor(h / 24)}D`;
  if (h > 0) return `T-MINUS ${h}H`;
  return `T-MINUS ${m}M`;
}

function getPageLabel(scan: ScanRecord): string {
  try { return new URL(scan.url).hostname; } catch { return scan.siteName; }
}

function CircularMeter({ value }: { value: number }) {
  const size = 112;
  const r = 44;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="url(#meterGrad)"
          strokeWidth="9"
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id="meterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00e5ff" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute text-[24px] font-bold text-white">{value}</span>
    </div>
  );
}

function getBugCounts(scan: ScanRecord) {
  const bugs = scan.report?.bugsReliability?.bugs ?? [];
  return {
    critical: bugs.filter((b) => b.severity === "high").length,
    serious: bugs.filter((b) => b.severity === "medium").length,
    moderate: bugs.filter((b) => b.severity === "low").length,
    minor: 0,
  };
}

export default function DashboardPage() {
  const [entitlement, setEntitlement] = useState<EntitlementSummary | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);

  useEffect(() => {
    let isActive = true;
    Promise.all([
      getEntitlementSummaryViaApi().catch(() => null),
      listScansViaApi({ pageSize: 100 }).then((r) => r.scans).catch(() => [] as ScanRecord[]),
    ]).then(([entitlementResult, scans]) => {
      if (!isActive) return;
      setEntitlement(entitlementResult);
      const nextInsights = summarizeInsights(scans);
      setInsights(nextInsights);
      if (nextInsights.recentFailureCount || nextInsights.regressionCount) {
        void trackAnalyticsEvent("dashboard_alerts_shown", nextInsights);
      }
    });
    return () => { isActive = false; };
  }, []);

  const planTier = (entitlement?.planName ?? "free").toUpperCase().replace(" ", "_");
  const health = insights?.avgHealthScore ?? 85;
  const pagesScanned = insights?.completedCount ?? 0;
  const latestScan = insights?.latestScan;
  const bugCounts = latestScan ? getBugCounts(latestScan) : { critical: 0, serious: 0, moderate: 0, minor: 0 };

  return (
    <main id="main-content" className="space-y-6">
      {/* ── Page header ── */}
      <div>
        <h1 className="font-mono text-[22px] font-bold uppercase tracking-[0.08em] text-white">
          Overview_Matrix
        </h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-white/32">
          Status: Online | Monitoring Active
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Global health */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#0c0d1e] p-6">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/42">Global Health</p>
            <span className="rounded border border-[#34d399]/25 bg-[#34d399]/8 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#34d399]">
              +5.0%
            </span>
          </div>
          <div className="mt-5 flex flex-col items-center gap-3">
            <CircularMeter value={health} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/30">System Nominal</p>
          </div>
        </div>

        {/* Pages scanned */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#0c0d1e] p-6">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/42">Pages Scanned</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#a78bfa]/20 bg-[#a78bfa]/8">
              <Globe className="h-4 w-4 text-[#a78bfa]" />
            </div>
          </div>
          <div className="mt-6">
            <p className="font-mono text-[3rem] font-bold leading-none text-[#a78bfa]">
              {pagesScanned.toLocaleString()}
            </p>
          </div>
          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#a78bfa] to-[#60a5fa]"
                style={{ width: `${Math.min(100, (pagesScanned / Math.max(pagesScanned + 10, 50)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/30">
              +{insights?.recentFailureCount ?? 0} recent · {insights?.inFlightCount ?? 0} in-flight
            </p>
          </div>
        </div>

        {/* License status */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#0c0d1e] p-6">
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/42">License Status</p>
            <span className="rounded border border-[#00e5ff]/25 bg-[#00e5ff]/8 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#00e5ff]">
              Active
            </span>
          </div>
          <p className="mt-5 font-mono text-[2.2rem] font-bold uppercase leading-tight text-white">{planTier}_Tier</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.28em] text-white/32">Enhanced Telemetry</p>
          <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/32">
              Remaining: {entitlement?.remainingScans ?? "—"}
            </span>
            <Link href="/app/scan/new" className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00e5ff] transition hover:text-[#60a5fa]">
              Config <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid gap-5 lg:grid-cols-[1.4fr,0.6fr]">
        {/* Latest log output */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#0c0d1e] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[12px] font-bold uppercase tracking-[0.28em] text-white">Latest Log Output</h2>
            {latestScan ? (
              <span className="rounded border border-[#34d399]/25 bg-[#34d399]/8 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#34d399]">
                Target Accessed
              </span>
            ) : null}
          </div>

          {latestScan ? (
            <>
              <div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
                    <Globe className="h-4 w-4 text-white/40" />
                  </div>
                  <div>
                    <p className="font-mono text-[13px] font-semibold text-white/85">{getPageLabel(latestScan)}</p>
                    <p className="font-mono text-[10px] text-white/30">
                      TS: {new Date(getScanTimestamp(latestScan)).toISOString().replace(".000", "")}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/app/scan/view?id=${latestScan.id}`}
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/65 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Extract Report
                </Link>
              </div>

              {/* Bug severity grid */}
              <div className="mt-4 grid grid-cols-4 gap-3">
                {[
                  { label: "Critical", value: bugCounts.critical, color: "#ff4444" },
                  { label: "Serious", value: bugCounts.serious, color: "#f97316" },
                  { label: "Moderate", value: bugCounts.moderate, color: "#eab308" },
                  { label: "Minor", value: bugCounts.minor + (insights?.completedCount ?? 0), color: "#00e5ff" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border px-3 py-4 text-center"
                    style={{ borderColor: `${item.color}30`, backgroundColor: `${item.color}08` }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: item.color }}>
                      {item.label}
                    </p>
                    <p className="mt-2 font-mono text-[2rem] font-bold leading-none" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-8 text-center">
              <p className="text-[12px] uppercase tracking-[0.22em] text-white/28">No scans yet</p>
              <Link href="/app/scan/new" className="mt-3 inline-block text-[12px] font-semibold text-[#00e5ff] transition hover:text-[#60a5fa]">
                Run your first scan →
              </Link>
            </div>
          )}
        </div>

        {/* System events */}
        <div className="rounded-[18px] border border-white/[0.07] bg-[#0c0d1e] p-6">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.28em] text-white">System Events</h2>
          <div className="mt-5 space-y-4">
            {insights && insights.recentScans.length > 0 ? (
              insights.recentScans.slice(0, 4).map((scan) => (
                <div key={scan.id} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 h-2 w-2 shrink-0 rounded-full shadow-sm"
                    style={{ backgroundColor: getEventColor(scan), boxShadow: `0 0 6px ${getEventColor(scan)}` }}
                  />
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white/82">{getEventLabel(scan)}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/28">
                      {getElapsedLabel(scan)} · {getPageLabel(scan).toUpperCase().slice(0, 12)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              [
                { label: "System Online", sub: "MONITORING ACTIVE", color: "#00e5ff" },
                { label: "Engine Ready", sub: "AI ENGINE STANDBY", color: "#a78bfa" },
                { label: "Auth Verified", sub: "SESSION ACTIVE", color: "#34d399" },
                { label: "Awaiting Scan", sub: "NO SCANS YET", color: "#60a5fa" },
              ].map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}` }} />
                  <div>
                    <p className="text-[12px] font-semibold text-white/82">{item.label}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-white/28">{item.sub}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/app/scan/history" className="mt-6 block text-center text-[11px] font-bold uppercase tracking-[0.22em] text-[#00e5ff]/70 transition hover:text-[#00e5ff]">
            Access Full Logs
          </Link>
        </div>
      </div>
    </main>
  );
}
