"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { ScanReportClient } from "@/components/report/scan-report-client";
import { ShellCard } from "@/components/ui/shell-card";
import { getScanViaApi, trackAnalyticsEvent } from "@/lib/scan-api-client";
import type { ScanRecord } from "@/lib/scan-types";

export default function ScanViewPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const scanId = searchParams?.get("scanId") ?? null;
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      setError(t("scan.view.error.missingId"));
      return;
    }

    void trackAnalyticsEvent("scan_view_opened", { scanId });

    getScanViaApi(scanId)
      .then(setScan)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : t("scan.view.error.notFound"))
      );
  }, [scanId, t]);

  if (error) {
    return (
      <main id="main-content">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[#ffb39f]">{t("scan.view.error.title")}</p>
          <p className="mt-4 text-base leading-8 text-white/68" role="alert" aria-live="assertive">{error}</p>
        </ShellCard>
      </main>
    );
  }

  if (!scan) {
    return (
      <main id="main-content">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45" role="status" aria-live="polite">{t("scan.view.loading.title")}</p>
          <p className="mt-4 text-base leading-8 text-white/68">{t("scan.view.loading.subtitle")}</p>
        </ShellCard>
      </main>
    );
  }

  return (
    <main id="main-content">
      <ScanReportClient initialScan={scan} />
    </main>
  );
}
