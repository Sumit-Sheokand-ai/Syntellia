"use client";

import { useEffect, useState } from "react";
import { ReportOverview } from "@/components/report/report-overview";
import { ShellCard } from "@/components/ui/shell-card";
import type { ScanRecord } from "@/lib/scan-types";
import {
  createShareLinkViaApi,
  getScanViaApi,
  revokeShareLinkViaApi,
  trackAnalyticsEvent
} from "@/lib/scan-api-client";

type ScanReportClientProps = {
  initialScan: ScanRecord;
};

function ProgressView({ scan }: { scan: ScanRecord }) {
  const progressCopy =
    scan.status === "Queued"
      ? "The scan is queued and waiting to start."
      : "The page is being fetched and analyzed now.";
  const startedAtMs = Date.parse(scan.startedAt ?? scan.createdAt);
  const elapsedMinutes = Number.isFinite(startedAtMs)
    ? Math.max(0, Math.round((Date.now() - startedAtMs) / 60_000))
    : 0;
  const estimatedTotalMinutes = Math.max(1, Math.ceil(scan.pageLimit * 0.6));

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1.45fr,0.95fr]">
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Scan in progress</p>
          <h1 className="mt-4 text-3xl font-semibold text-white md:text-5xl">Reviewing {scan.siteName}</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
            {progressCopy} Syntellia is collecting structure, trust cues, calls-to-action, readability, accessibility hints, and visible style tokens before building the customer-facing report.
          </p>
          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {[
              "Fetching the page HTML",
              "Scoring clarity, trust, and next-step signals",
              "Building plain-language recommendations"
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
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Elapsed: ~{elapsedMinutes} min</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Estimated total: ~{estimatedTotalMinutes} min</div>
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);

  useEffect(() => {
    if (scan.status === "Completed" || scan.status === "Failed") {
      return;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const nextScan = await getScanViaApi(scan.id);
        setScan(nextScan);
      } catch {
        // ignore transient poll errors
      }
    }, 1500);

    return () => window.clearInterval(intervalId);
  }, [scan.id, scan.status]);
  useEffect(() => {
    if (!scan.shareToken || typeof window === "undefined") return;
    const url = new URL(`/shared/view?token=${encodeURIComponent(scan.shareToken)}`, window.location.origin);
    setShareUrl(url.toString());
  }, [scan.shareToken]);

  useEffect(() => {
    if (scan.status !== "Completed") return;
    void trackAnalyticsEvent("scan_report_viewed", {
      scanId: scan.id,
      projectName: scan.projectName
    });
  }, [scan.id, scan.projectName, scan.status]);

  const prepareShareLink = async () => {
    try {
      setIsPreparingShare(true);
      setShareNotice(null);

      let sharePath = scan.shareToken
        ? `/shared/view?token=${encodeURIComponent(scan.shareToken)}`
        : "";

      if (!sharePath) {
        const created = await createShareLinkViaApi(scan.id);
        sharePath = created.sharePath;
        setScan((current) => ({
          ...current,
          shareToken: created.shareToken,
          shareTokenExpiresAt: created.expiresAt ?? undefined,
          shareRevokedAt: undefined
        }));
      }

      if (typeof window === "undefined") return;

      const shareLink = new URL(sharePath, window.location.origin).toString();
      setShareUrl(shareLink);

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
        setShareNotice("Share link copied to clipboard.");
      } else {
        setShareNotice("Share link is ready.");
      }

      void trackAnalyticsEvent("scan_share_link_created", {
        scanId: scan.id,
        projectName: scan.projectName
      });
    } catch (error) {
      setShareNotice(error instanceof Error ? error.message : "Unable to prepare share link.");
    } finally {
      setIsPreparingShare(false);
    }
  };

  const revokeShareLink = async () => {
    try {
      setIsRevokingShare(true);
      setShareNotice(null);
      await revokeShareLinkViaApi(scan.id);
      setScan((current) => ({
        ...current,
        shareToken: undefined,
        shareTokenExpiresAt: undefined,
        shareRevokedAt: new Date().toISOString()
      }));
      setShareUrl(null);
      setShareNotice("Share link revoked.");
      void trackAnalyticsEvent("scan_share_link_revoked", {
        scanId: scan.id,
        projectName: scan.projectName
      });
    } catch (error) {
      setShareNotice(error instanceof Error ? error.message : "Unable to revoke share link.");
    } finally {
      setIsRevokingShare(false);
    }
  };

  if (scan.status === "Failed") {
    return <FailureView scan={scan} />;
  }

  if (scan.status !== "Completed" || !scan.report) {
    return <ProgressView scan={scan} />;
  }
  return (
    <div className="space-y-6">
      <ShellCard className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-white/45">Share report</p>
            <p className="mt-2 text-sm text-white/66">
              Create a link to share this completed report with stakeholders who do not need a login.
            </p>
            {shareUrl ? (
              <p className="mt-3 text-xs break-all text-white/58">{shareUrl}</p>
            ) : null}
            {scan.shareTokenExpiresAt ? (
              <p className="mt-2 text-xs text-white/52">
                Expires: {new Date(scan.shareTokenExpiresAt).toLocaleString()}
              </p>
            ) : null}
            {shareNotice ? (
              <p className="mt-3 text-sm text-[#7cf5d4]">{shareNotice}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={prepareShareLink}
              disabled={isPreparingShare}
            >
              {isPreparingShare ? "Preparing link..." : shareUrl ? "Copy share link" : "Create share link"}
            </button>
            {shareUrl ? (
              <button
                type="button"
                className="rounded-full border border-[#ffb39f]/30 bg-[#ffb39f]/10 px-5 py-3 text-sm text-[#ffd6cb] transition hover:bg-[#ffb39f]/16 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={revokeShareLink}
                disabled={isRevokingShare}
              >
                {isRevokingShare ? "Revoking..." : "Revoke link"}
              </button>
            ) : null}
          </div>
        </div>
      </ShellCard>
      <ReportOverview report={scan.report} scanMeta={scan} />
    </div>
  );
}