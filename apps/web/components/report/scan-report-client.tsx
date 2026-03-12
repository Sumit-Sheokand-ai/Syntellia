"use client";

import { useEffect, useState } from "react";
import { ReportOverview } from "@/components/report/report-overview";
import { ShellCard } from "@/components/ui/shell-card";
import type { ScanRecord } from "@/lib/scan-types";

type ScanReportClientProps = {
  initialScan: ScanRecord;
};

function ProgressView({ scan }: { scan: ScanRecord }) {
  const progressCopy =
    scan.status === "Queued"
      ? "The scan is queued and waiting to start."
      : "The page is being fetched and analyzed now.";

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1.45fr,0.95fr]">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Scan in progress</p>
          <h1 className="mt-4 text-3xl font-semibold text-white md:text-5xl">Reviewing {scan.siteName}</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
            {progressCopy} Syntellia is pulling the page title, metadata, links, buttons, forms, and any readable style tokens before building the full report.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              "Fetching the page HTML",
              "Reading structure and action points",
              "Pulling visible style signals"
            ].map((step, index) => (
              <div key={step} className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/76">
                <div className="text-xs uppercase tracking-[0.24em] text-white/40">Step {index + 1}</div>
                <div className="mt-3 text-base text-white">{step}</div>
              </div>
            ))}
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Current status</p>
          <div className="mt-6 space-y-3 text-sm text-white/72">
            <div className="rounded-2xl border border-[#7cf5d4]/25 bg-[#7cf5d4]/8 px-4 py-3">Status: {scan.status}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Scan size: {scan.scanSize}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Main focus: {scan.focusArea}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Page limit: up to {scan.pageLimit}</div>
          </div>
          <p className="mt-6 text-sm leading-7 text-white/58">This view refreshes automatically. The full summary will appear as soon as the page data is ready.</p>
        </ShellCard>
      </div>

      <ShellCard className="p-8">
        <div className="text-sm uppercase tracking-[0.24em] text-white/45">Target page</div>
        <div className="mt-4 text-lg text-white/86">{scan.url}</div>
      </ShellCard>
    </div>
  );
}

function FailureView({ scan }: { scan: ScanRecord }) {
  return (
    <ShellCard className="p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-[#ffb39f]">Scan failed</p>
      <h1 className="mt-4 text-3xl font-semibold text-white">We could not finish this page review.</h1>
      <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
        The scan reached the target URL but could not turn it into a usable report. This usually happens when the page blocks automated fetches or requires a live browser session.
      </p>
      <div className="mt-8 rounded-[24px] border border-[#ffb39f]/20 bg-[#ffb39f]/8 p-5 text-sm leading-7 text-[#ffd3c8]">
        {scan.error ?? "The page could not be fetched."}
      </div>
    </ShellCard>
  );
}

export function ScanReportClient({ initialScan }: ScanReportClientProps) {
  const [scan, setScan] = useState(initialScan);

  useEffect(() => {
    if (scan.status === "Completed" || scan.status === "Failed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/scans/${scan.id}`, { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const nextScan = (await response.json()) as ScanRecord;
      setScan(nextScan);
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [scan.id, scan.status]);

  if (scan.status === "Failed") {
    return <FailureView scan={scan} />;
  }

  if (scan.status !== "Completed" || !scan.report) {
    return <ProgressView scan={scan} />;
  }

  return <ReportOverview report={scan.report} scanMeta={scan} />;
}