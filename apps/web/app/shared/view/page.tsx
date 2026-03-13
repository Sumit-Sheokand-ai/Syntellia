"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ReportOverview } from "@/components/report/report-overview";
import { ShellCard } from "@/components/ui/shell-card";
import { getSharedScanViaApi, trackAnalyticsEvent } from "@/lib/scan-api-client";
import type { SharedScanRecord } from "@/lib/scan-types";
function SharedReportContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") ?? "";
  const [scan, setScan] = useState<SharedScanRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const shareToken = token.trim();
    if (!shareToken) {
      setError("A share token is required.");
      return;
    }

    getSharedScanViaApi(shareToken)
      .then((result) => {
        setScan(result);
        void trackAnalyticsEvent("shared_report_viewed", {
          scanId: result.id,
          projectName: result.projectName
        });
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load shared report.");
      });
  }, [token]);

  if (error) {
    return (
      <main className="space-y-6 px-6 py-8 md:px-10 xl:px-14">
        <div className="mx-auto max-w-6xl space-y-6">
          <ShellCard className="p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-[#ffb39f]">Shared report unavailable</p>
            <p className="mt-4 text-base leading-8 text-white/68">{error}</p>
            <Link href="/" className="mt-6 inline-flex rounded-full border border-white/12 px-5 py-3 text-sm text-white/86">
              Back to Syntellia
            </Link>
          </ShellCard>
        </div>
      </main>
    );
  }

  if (!scan || !scan.report) {
    return (
      <main className="space-y-6 px-6 py-8 md:px-10 xl:px-14">
        <div className="mx-auto max-w-6xl space-y-6">
          <ShellCard className="p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-white/45">Loading shared report...</p>
            <p className="mt-4 text-base leading-8 text-white/68">Preparing the report for view.</p>
          </ShellCard>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6 px-6 py-8 md:px-10 xl:px-14">
      <div className="mx-auto max-w-6xl space-y-6">
        <ShellCard className="p-6">
          <p className="text-sm uppercase tracking-[0.26em] text-white/45">Shared Syntellia report</p>
          <p className="mt-3 text-sm leading-7 text-white/68">
            This report was shared from Syntellia and can be viewed without signing in.
          </p>
        </ShellCard>
        <ReportOverview
          report={scan.report}
          scanMeta={{
            id: scan.id,
            url: scan.url,
            scanSize: scan.scanSize,
            pageLimit: scan.pageLimit,
            loginMode: scan.loginMode,
            focusArea: scan.focusArea,
            projectName: scan.projectName,
            status: scan.status,
            error: scan.error
          }}
        />
      </div>
    </main>
  );
}

export default function SharedReportPage() {
  return (
    <Suspense
      fallback={(
        <main className="space-y-6 px-6 py-8 md:px-10 xl:px-14">
          <div className="mx-auto max-w-6xl space-y-6">
            <ShellCard className="p-8">
              <p className="text-sm uppercase tracking-[0.3em] text-white/45">Loading shared report...</p>
              <p className="mt-4 text-base leading-8 text-white/68">Preparing the report for view.</p>
            </ShellCard>
          </div>
        </main>
      )}
    >
      <SharedReportContent />
    </Suspense>
  );
}
