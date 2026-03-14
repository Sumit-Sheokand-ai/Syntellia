"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Layers3, LockKeyhole, Radar, ScrollText } from "lucide-react";
import { ShellCard } from "@/components/ui/shell-card";
import {
  getEntitlementSummaryViaApi,
  listScansViaApi,
  trackAnalyticsEvent
} from "@/lib/scan-api-client";
import type { EntitlementSummary, ScanRecord } from "@/lib/scan-types";

const cards = [
  {
    title: "Public or authenticated scans",
    body: "Create scans for marketing sites, app surfaces, or session-protected pages with controlled access handling.",
    icon: LockKeyhole
  },
  {
    title: "Bounded crawl control",
    body: "Limit analysis by page count, path depth, and crawl domain so reports stay precise and cost remains predictable.",
    icon: Radar
  },
  {
    title: "Saved structured reports",
    body: "Store scan output as reusable design intelligence instead of one-off screenshots or notes.",
    icon: ScrollText
  }
];

type DashboardInsights = {
  inFlightCount: number;
  recentFailureCount: number;
  regressionCount: number;
  completedCount: number;
};

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
    if (previous - latest >= 8) regressions += 1;
  }

  return regressions;
}

function summarizeInsights(scans: ScanRecord[]): DashboardInsights {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentFailureCount = scans.filter(
    (scan) => scan.status === "Failed" && getScanTimestamp(scan) >= sevenDaysAgo
  ).length;
  const inFlightCount = scans.filter(
    (scan) => scan.status === "Queued" || scan.status === "Running"
  ).length;
  const completedCount = scans.filter((scan) => scan.status === "Completed").length;

  return {
    inFlightCount,
    recentFailureCount,
    regressionCount: countRegressions(scans),
    completedCount
  };
}

export default function DashboardPage() {
  const [entitlement, setEntitlement] = useState<EntitlementSummary | null>(null);
  const [insights, setInsights] = useState<DashboardInsights | null>(null);

  useEffect(() => {
    let isActive = true;

    Promise.all([
      getEntitlementSummaryViaApi().catch(() => null),
      listScansViaApi({ pageSize: 100 }).then((result) => result.scans).catch(() => [] as ScanRecord[])
    ]).then(([entitlementResult, scans]) => {
      if (!isActive) return;
      setEntitlement(entitlementResult);

      const nextInsights = summarizeInsights(scans);
      setInsights(nextInsights);

      if (nextInsights.recentFailureCount || nextInsights.regressionCount) {
        void trackAnalyticsEvent("dashboard_alerts_shown", nextInsights);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);
  return (
    <main className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Dashboard</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold text-white">Start a scan in a few simple steps.</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/66">
            Paste a page link, choose how wide the review should be, and tell Syntellia what matters most. The report view is already designed to turn that into something easy to read.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/scan/new" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d]">Start new scan</Link>
            <Link href="/app/scan/history" className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/85">View scan history</Link>
            <Link href="/#workflow" className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/85">See how it works</Link>
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <div className="flex items-center gap-3 text-white">
            <Layers3 className="h-5 w-5 text-[#7cf5d4]" />
            <h3 className="text-2xl font-semibold">Workspace snapshot</h3>
          </div>
          <div className="mt-6 space-y-4 text-sm text-white/68">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              Plan: {entitlement?.planName ?? "free"}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              Remaining scans this month: {entitlement?.remainingScans ?? "—"}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              Scans currently in progress: {insights?.inFlightCount ?? "—"}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              Recent failures (7 days): {insights?.recentFailureCount ?? "—"}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              Regressions detected: {insights?.regressionCount ?? "—"}
            </div>
          </div>
        </ShellCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <ShellCard key={card.title} className="p-7">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
                <Icon className="h-6 w-6 text-[#6ca8ff]" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-white">{card.title}</h3>
              <p className="mt-4 text-base leading-8 text-white/66">{card.body}</p>
            </ShellCard>
          );
        })}
      </section>
    </main>
  );
}
