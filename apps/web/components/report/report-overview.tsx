"use client";
import { useMemo, useState } from "react";
import type {
  ScanReport,
  SecurityTechnicalReport,
  UiStyleReport
} from "@/lib/report-schema";
import { ShellCard } from "@/components/ui/shell-card";

type ReportOverviewProps = {
  report: ScanReport;
  scanMeta?: {
    id: string;
    url: string;
    scanSize: string;
    pageLimit: number;
    loginMode: string;
    focusArea: string;
    projectName?: string;
    status: string;
    error?: string;
  };
};

function getSeverityLabel(severity: "high" | "medium" | "low") {
  if (severity === "high") return "High impact";
  if (severity === "medium") return "Medium impact";
  return "Low impact";
}

function getImpactLabel(impact: "high" | "medium" | "low") {
  if (impact === "high") return "High impact";
  if (impact === "medium") return "Medium impact";
  return "Low impact";
}

function buildUiStyleFallback(report: ScanReport): UiStyleReport {
  return {
    summary: "UI/styling insights are derived from visual tokens, content structure, and interaction cues in the scanned pages.",
    styleTokens: {
      colors: report.source.colors,
      fonts: report.source.fonts,
      components: report.components,
      highlightWords: report.source.customerSignals?.highlightWords ?? []
    },
    contentClarity: {
      headingCount: report.source.headingCount,
      headingExamples: report.source.pages?.map((page) => page.pageTitle).slice(0, 10) ?? [],
      avgParagraphWords: report.source.customerSignals?.readability.avgParagraphWords ?? 0,
      longParagraphCount: 0
    },
    interactionSignals: {
      ctaLabels: report.source.customerSignals?.ctaLabels ?? [],
      navLabels: report.interactions.filter((item) => item.toLowerCase().includes("navigation")).slice(0, 8),
      buttonLabels: []
    },
    prioritizedActions: report.prioritizedActions ?? []
  };
}

function buildSecurityFallback(report: ScanReport): SecurityTechnicalReport {
  return {
    summary: "Security and technical checks are partially available for this report version. Re-scan for full hardening coverage.",
    postureScore: 70,
    transport: {
      httpsCoverage: report.source.finalUrl.startsWith("https://") ? 100 : 0,
      redirectedToHttpsCount: 0,
      downgradedToHttpCount: 0,
      requestedExecutionMode: report.source.crawl?.requestedExecutionMode ?? "fast-http",
      executionMode: report.source.crawl?.executionMode ?? "fast-http",
      modeFallbackUsed: report.source.crawl?.modeFallbackUsed ?? false
    },
    headers: {
      missing: [],
      weak: [],
      presentCoverage: []
    },
    cookies: {
      totalSetCookie: 0,
      secureRate: 100,
      httpOnlyRate: 100,
      sameSiteRate: 100,
      issues: []
    },
    linksAndForms: {
      unsafeTargetBlankCount: 0,
      insecureLinkCount: 0,
      insecureFormActionCount: 0
    },
    scriptSurface: {
      mixedContentCount: 0,
      externalScriptCount: 0,
      scriptsWithoutSriCount: 0,
      inlineScriptCount: 0,
      externalScriptHosts: []
    },
    cors: {
      riskyPageCount: 0
    },
    cachePolicy: {
      riskyPageCount: 0
    },
    authSurface: {
      passwordFlowPageCount: 0,
      passwordFlowMissingCsrfCount: 0
    },
    hsts: {
      preloadReadyCount: 0
    },
    crawlDiagnostics: {
      blockedByRobots: report.source.crawl?.blockedByRobots ?? 0,
      pageErrors: 0,
      notes: report.source.notes.slice(0, 10)
    },
    pageHighlights: (report.source.pages ?? []).slice(0, 10).map((page) => ({
      url: page.url,
      usesHttps: page.url.startsWith("https://"),
      missingHeaders: [],
      weakHeaderCount: 0,
      unsafeTargetBlank: 0,
      insecureLinks: 0,
      insecureForms: 0
    })),
    recommendations: [
      {
        title: "Run an updated scan for complete security diagnostics",
        detail: "This report predates the dedicated Security/Technical tab schema.",
        impact: "medium"
      }
    ]
  };
}

function sectionChip(value: string) {
  return (
    <span key={value} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
      {value}
    </span>
  );
}

export function ReportOverview({ report, scanMeta }: ReportOverviewProps) {
  const [activeTab, setActiveTab] = useState<"ui" | "security">("ui");
  const uiStyle = useMemo(() => report.uiStyle ?? buildUiStyleFallback(report), [report]);
  const securityTechnical = useMemo(
    () => report.securityTechnical ?? buildSecurityFallback(report),
    [report]
  );

  const uiScores = report.scores.filter((score) => score.label !== "Security posture");
  const securityScore = report.scores.find((score) => score.label === "Security posture");

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-[1.5fr,1fr]">
        <ShellCard className="p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-white/45">Customer experience report</p>
              <h1 className="text-3xl font-semibold text-white md:text-5xl">{report.siteName}</h1>
              <p className="max-w-3xl text-base leading-8 text-white/68">{report.summary}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/72">
              <div>{report.scope}</div>
              <div>{new Date(report.scannedAt).toLocaleString()}</div>
            </div>
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Review snapshot</p>
          <div className="mt-6 space-y-3 text-sm text-white/72">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Status: {scanMeta?.status ?? "Created"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Project: {scanMeta?.projectName ?? "General"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Scan size: {scanMeta?.scanSize ?? report.scope}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Pages reviewed: up to {scanMeta?.pageLimit ?? 1}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Login: {scanMeta?.loginMode ?? "No login needed"}</div>
          </div>
        </ShellCard>
      </div>

      <ShellCard className="p-3">
        <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/8 bg-white/5 p-2" role="tablist" aria-label="Report sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ui"}
            className={`rounded-[14px] px-4 py-3 text-sm uppercase tracking-[0.22em] transition ${
              activeTab === "ui" ? "bg-white text-[#09101d]" : "bg-transparent text-white/72 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("ui")}
          >
            Tab 1 · UI & Styling
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "security"}
            className={`rounded-[14px] px-4 py-3 text-sm uppercase tracking-[0.22em] transition ${
              activeTab === "security" ? "bg-white text-[#09101d]" : "bg-transparent text-white/72 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("security")}
          >
            Tab 2 · Security & Technical
          </button>
        </div>
      </ShellCard>

      {activeTab === "ui" ? (
        <div className="space-y-8">
          <ShellCard className="p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-white/45">UI & styling summary</p>
            <p className="mt-4 text-base leading-8 text-white/72">{uiStyle.summary}</p>
          </ShellCard>

          <div className="grid gap-5 xl:grid-cols-4">
            {uiScores.map((score) => (
              <ShellCard key={score.label} className="p-6">
                <p className="text-sm uppercase tracking-[0.26em] text-white/45">{score.label}</p>
                <div className="mt-5 space-y-2">
                  <span className="block text-5xl font-semibold text-white">{score.value}/100</span>
                  <span className="text-sm text-white/55">{score.trend}</span>
                </div>
              </ShellCard>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Visual language</h2>
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Colors</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {(uiStyle.styleTokens.colors.length ? uiStyle.styleTokens.colors : ["No readable colors found"]).map(sectionChip)}
                  </div>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Fonts</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {(uiStyle.styleTokens.fonts.length ? uiStyle.styleTokens.fonts : ["No readable fonts found"]).map(sectionChip)}
                  </div>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Components</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {(uiStyle.styleTokens.components.length ? uiStyle.styleTokens.components : ["No strong component patterns detected"]).map(sectionChip)}
                  </div>
                </div>
              </div>
            </ShellCard>
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Content and interaction quality</h2>
              <div className="mt-6 grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Headings detected: {uiStyle.contentClarity.headingCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Avg paragraph words: {uiStyle.contentClarity.avgParagraphWords}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Long paragraph count: {uiStyle.contentClarity.longParagraphCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  CTA labels: {uiStyle.interactionSignals.ctaLabels.length}
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Top headings / page titles</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(uiStyle.contentClarity.headingExamples.length
                      ? uiStyle.contentClarity.headingExamples
                      : ["No headings extracted"]).slice(0, 10).map(sectionChip)}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Interaction cues</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(uiStyle.interactionSignals.ctaLabels.length
                      ? uiStyle.interactionSignals.ctaLabels
                      : ["No CTA labels extracted"]).slice(0, 10).map(sectionChip)}
                  </div>
                </div>
              </div>
            </ShellCard>
          </div>

          <ShellCard className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">UI-first improvements</h2>
              <p className="text-sm text-white/52">Prioritized by customer-facing impact</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(uiStyle.prioritizedActions.length ? uiStyle.prioritizedActions : report.prioritizedActions ?? []).map((action) => (
                <div key={action.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                    {getImpactLabel(action.impact)} · {action.effort} effort
                  </div>
                  <h3 className="mt-4 text-xl font-medium text-white">{action.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/65">{action.detail}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-white/45">
                    Confidence {Math.round(action.confidence * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </ShellCard>
        </div>
      ) : (
        <div className="space-y-8">
          <ShellCard className="p-8">
            <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">Security posture score</p>
                <p className="mt-4 text-6xl font-semibold text-white">{securityTechnical.postureScore}/100</p>
                <p className="mt-4 text-sm leading-7 text-white/65">{securityTechnical.summary}</p>
                {securityScore ? (
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/45">{securityScore.trend}</p>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-2 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">HTTPS coverage: {securityTechnical.transport.httpsCoverage}%</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Redirected to HTTPS: {securityTechnical.transport.redirectedToHttpsCount}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Downgraded to HTTP: {securityTechnical.transport.downgradedToHttpCount}</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Execution mode: {securityTechnical.transport.executionMode}
                  {securityTechnical.transport.modeFallbackUsed ? " (fallback used)" : ""}
                </div>
              </div>
            </div>
          </ShellCard>

          <div className="grid gap-5 lg:grid-cols-[1.05fr,0.95fr]">
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Header hardening coverage</h2>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Missing headers</p>
                  <div className="mt-3 space-y-2">
                    {(securityTechnical.headers.missing.length
                      ? securityTechnical.headers.missing
                      : [{ key: "none", label: "No missing headers detected", impact: "low" as const, pages: 0 }]
                    ).map((entry) => (
                      <div key={`${entry.key}-missing`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">
                        {entry.label}
                        {entry.pages > 0 ? ` · ${entry.pages} page${entry.pages === 1 ? "" : "s"}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Weak header values</p>
                  <div className="mt-3 space-y-2">
                    {(securityTechnical.headers.weak.length
                      ? securityTechnical.headers.weak
                      : [{ key: "none", label: "No weak header values detected", issue: "", pages: 0 }]
                    ).map((entry) => (
                      <div key={`${entry.key}-${entry.issue}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/78">
                        {entry.label}
                        {entry.issue ? ` · ${entry.issue}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ShellCard>
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Cookies, links, and forms</h2>
              <div className="mt-6 grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Cookies observed: {securityTechnical.cookies.totalSetCookie}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Cookie flags · Secure {securityTechnical.cookies.secureRate}% · HttpOnly {securityTechnical.cookies.httpOnlyRate}% · SameSite {securityTechnical.cookies.sameSiteRate}%
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Unsafe target=_blank links: {securityTechnical.linksAndForms.unsafeTargetBlankCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Insecure HTTP links: {securityTechnical.linksAndForms.insecureLinkCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Insecure HTTP form actions: {securityTechnical.linksAndForms.insecureFormActionCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Mixed-content assets: {securityTechnical.scriptSurface?.mixedContentCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  External scripts without SRI: {securityTechnical.scriptSurface?.scriptsWithoutSriCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  CORS risky pages: {securityTechnical.cors?.riskyPageCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Cache-policy risk pages: {securityTechnical.cachePolicy?.riskyPageCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Password-flow pages missing CSRF signal: {securityTechnical.authSurface?.passwordFlowMissingCsrfCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  HSTS preload-ready pages: {securityTechnical.hsts?.preloadReadyCount ?? 0}
                </div>
              </div>
              {(securityTechnical.scriptSurface?.externalScriptHosts?.length ?? 0) > 0 ? (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">External script hosts (sample)</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {securityTechnical.scriptSurface?.externalScriptHosts?.map(sectionChip)}
                  </div>
                </div>
              ) : null}
              {securityTechnical.cookies.issues.length ? (
                <div className="mt-5 space-y-2">
                  {securityTechnical.cookies.issues.map((issue) => (
                    <div key={issue} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                      {issue}
                    </div>
                  ))}
                </div>
              ) : null}
            </ShellCard>
          </div>

          <ShellCard className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">Security and technical actions</h2>
              <p className="text-sm text-white/52">Hardening priorities and crawl diagnostics</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {securityTechnical.recommendations.map((recommendation) => (
                <div key={recommendation.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                    {getSeverityLabel(recommendation.impact)}
                  </div>
                  <h3 className="mt-4 text-xl font-medium text-white">{recommendation.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-white/65">{recommendation.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-3 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Robots blocked: {securityTechnical.crawlDiagnostics.blockedByRobots}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Page errors: {securityTechnical.crawlDiagnostics.pageErrors}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Security highlights tracked: {securityTechnical.pageHighlights.length}
              </div>
            </div>
            {securityTechnical.crawlDiagnostics.notes.length ? (
              <div className="mt-5 space-y-2">
                {securityTechnical.crawlDiagnostics.notes.map((note) => (
                  <div key={note} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/65">
                    {note}
                  </div>
                ))}
              </div>
            ) : null}
          </ShellCard>
        </div>
      )}
    </div>
  );
}
