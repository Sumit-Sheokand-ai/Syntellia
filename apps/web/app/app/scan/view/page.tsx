"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ScanReportClient } from "@/components/report/scan-report-client";
import { ShellCard } from "@/components/ui/shell-card";
import { getScanViaApi, trackAnalyticsEvent } from "@/lib/scan-api-client";
import type { ScanRecord } from "@/lib/scan-types";

export default function ScanViewPage() {
  const searchParams = useSearchParams();
  const scanId = searchParams?.get("scanId") ?? null;
  const [scan, setScan] = useState<ScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId) {
      setError("No scan ID was provided in the URL.");
      return;
    }

    void trackAnalyticsEvent("scan_view_opened", { scanId });

    getScanViaApi(scanId)
      .then(setScan)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Scan not found.")
      );
  }, [scanId]);

  if (error) {
    return (
      <main>
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-[#ffb39f]">Unable to load scan</p>
          <p className="mt-4 text-base leading-8 text-white/68">{error}</p>
        </ShellCard>
      </main>
    );
  }

  if (!scan) {
    return (
      <main>
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Loading scan...</p>
          <p className="mt-4 text-base leading-8 text-white/68">Fetching the scan record from the server.</p>
        </ShellCard>
      </main>
    );
  }

  return (
    <main>
      <ScanReportClient initialScan={scan} />
    </main>
  );
}
