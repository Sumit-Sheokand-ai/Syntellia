"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Layers3, LockKeyhole, Radar, ScrollText } from "lucide-react";
import { ShellCard } from "@/components/ui/shell-card";
import { useI18n } from "@/components/i18n-provider";
import {
  getEntitlementSummaryViaApi,
  listScansViaApi,
  trackAnalyticsEvent
} from "@/lib/scan-api-client";
import type { MessageKey } from "@/lib/i18n";
import type { EntitlementSummary, ScanRecord } from "@/lib/scan-types";

const cards = [
  {
    titleKey: "dashboard.card.publicAuth.title",
    bodyKey: "dashboard.card.publicAuth.body",
    icon: LockKeyhole
  },
  {
    titleKey: "dashboard.card.crawlControl.title",
    bodyKey: "dashboard.card.crawlControl.body",
    icon: Radar
  },
  {
    titleKey: "dashboard.card.savedReports.title",
    bodyKey: "dashboard.card.savedReports.body",
    icon: ScrollText
  }
] as const satisfies ReadonlyArray<{
  titleKey: MessageKey;
  bodyKey: MessageKey;
  icon: typeof LockKeyhole;
}>;

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
  const { t } = useI18n();
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

  const planValue = entitlement?.planName ?? t("dashboard.plan.free");
  return (
    <main id="main-content" className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">{t("dashboard.badge")}</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-semibold text-white">{t("dashboard.title")}</h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/66">
            {t("dashboard.subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app/scan/new" className="rounded-full bg-white px-5 py-3 text-sm font-medium text-[#09101d]">{t("dashboard.cta.startScan")}</Link>
            <Link href="/app/scan/history" className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/85">{t("dashboard.cta.history")}</Link>
            <Link href="/#workflow" className="rounded-full border border-white/10 px-5 py-3 text-sm font-medium text-white/85">{t("dashboard.cta.workflow")}</Link>
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <div className="flex items-center gap-3 text-white">
            <Layers3 className="h-5 w-5 text-[#7cf5d4]" />
            <h3 className="text-2xl font-semibold">{t("dashboard.snapshot.title")}</h3>
          </div>
          <div className="mt-6 space-y-4 text-sm text-white/68">
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              {t("dashboard.snapshot.plan", { value: planValue })}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              {t("dashboard.snapshot.remainingScans", { value: entitlement?.remainingScans ?? "—" })}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              {t("dashboard.snapshot.inFlight", { value: insights?.inFlightCount ?? "—" })}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              {t("dashboard.snapshot.recentFailures", { value: insights?.recentFailureCount ?? "—" })}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4">
              {t("dashboard.snapshot.regressions", { value: insights?.regressionCount ?? "—" })}
            </div>
          </div>
        </ShellCard>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <ShellCard key={card.titleKey} className="p-7">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
                <Icon className="h-6 w-6 text-[#6ca8ff]" />
              </div>
              <h3 className="mt-6 text-2xl font-semibold text-white">{t(card.titleKey)}</h3>
              <p className="mt-4 text-base leading-8 text-white/66">{t(card.bodyKey)}</p>
            </ShellCard>
          );
        })}
      </section>
    </main>
  );
}
