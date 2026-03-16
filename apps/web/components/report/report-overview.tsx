"use client";
import { useMemo, useState } from "react";
import type {
  ExecutiveSummary,
  ImplementationSnippet,
  OpportunityMap,
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

function getImpactStyle(impact: "high" | "medium" | "low") {
  if (impact === "high") {
    return "border-l-4 border-l-[#ffb39f]";
  }
  if (impact === "medium") {
    return "border-l-4 border-l-[#ffd08a]";
  }
  return "border-l-4 border-l-[#7cf5d4]";
}

function SourceSnippetButton({ snippet }: { snippet?: string }) {
  const [open, setOpen] = useState(false);
  if (!snippet) return null;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label="View source snippet"
        title="View source snippet"
        className="absolute right-3 top-3 z-10 rounded-full border border-white/12 bg-white/6 px-2.5 py-1 font-mono text-[10px] text-white/45 transition hover:bg-white/12 hover:text-white/75"
        onClick={(e) => { e.preventDefault(); setOpen((v) => !v); }}
      >
        {"</>"}
      </button>
      {open ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3">
          <pre className="whitespace-pre-wrap break-all text-[11px] leading-5 text-[#7cf5d4]/70">
            <code>{snippet}</code>
          </pre>
        </div>
      ) : null}
    </>
  );
}

function createCssVarSegment(value: string, index: number) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);

  if (!normalized) return `token-${index + 1}`;
  return normalized;
}

function buildImplementationSnippetsFromTokens(
  colors: string[],
  fonts: string[],
  components: string[]
): ImplementationSnippet[] {
  const normalizedColors = colors.slice(0, 6);
  const normalizedFonts = fonts.slice(0, 3);
  const normalizedComponents = components.slice(0, 6);

  const colorLines = normalizedColors.length
    ? normalizedColors.map((color, index) => `  --brand-color-${index + 1}: ${color};`)
    : [
      "  --brand-color-1: #6ca8ff;",
      "  --brand-color-2: #7cf5d4;"
    ];

  const fontLines = normalizedFonts.length
    ? normalizedFonts.map((font, index) => `  --brand-font-${index + 1}: ${font};`)
    : ["  --brand-font-1: 'Segoe UI', sans-serif;"];

  const utilityLines = normalizedComponents.length
    ? normalizedComponents.map((component, index) => {
      const segment = createCssVarSegment(component, index);
      return `.ui-${segment} { /* map styles for ${component} */ }`;
    })
    : [".ui-panel { border-radius: 24px; }"];

  const code = [
    ":root {",
    ...colorLines,
    ...fontLines,
    "}",
    "",
    ".brand-surface {",
    "  background: linear-gradient(180deg, rgba(18, 24, 52, 0.88), rgba(10, 14, 33, 0.76));",
    "  border: 1px solid rgba(255, 255, 255, 0.1);",
    "  box-shadow: 0 20px 80px rgba(5, 8, 22, 0.32);",
    "}",
    "",
    ...utilityLines
  ].join("\n");

  return [
    {
      id: "ui-style-foundation-css",
      title: "Style foundation starter",
      description: "Starter CSS generated from extracted style tokens so engineering can implement the same visual language quickly.",
      language: "css",
      code
    }
  ];
}

function getColorSwatchValue(value: string): string | null {
  const token = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(token)) return token;
  if (/^rgba?\(/i.test(token)) return token;
  if (/^hsla?\(/i.test(token)) return token;
  return null;
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
    implementationSnippets: buildImplementationSnippetsFromTokens(
      report.source.colors,
      report.source.fonts,
      report.components
    ),
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

function buildExecutiveSummaryFallback(report: ScanReport): ExecutiveSummary {
  const highlights = report.scores.slice(0, 3).map((score) => `${score.label}: ${score.value}/100 · ${score.trend}`);
  const risks = report.findings
    .filter((finding) => finding.severity === "high")
    .map((finding) => finding.title)
    .slice(0, 3);
  const opportunities = (report.prioritizedActions ?? []).slice(0, 3).map((action) => action.title);

  return {
    headline: `${report.siteName} has a clear foundation with focused opportunities to lift confidence and conversion.`,
    highlights,
    risks: risks.length ? risks : ["No major customer-facing risks surfaced in this scan."],
    opportunities: opportunities.length ? opportunities : ["Focus on incremental improvements to customer clarity."]
  };
}

function buildOpportunityMapFallback(report: ScanReport): OpportunityMap {
  const actions = report.prioritizedActions ?? [];
  const quickWins = actions.filter((action) => action.effort === "low").map((action) => action.title);
  const mediumTerm = actions.filter((action) => action.effort === "medium").map((action) => action.title);
  const bigBets = actions.filter((action) => action.effort === "high").map((action) => action.title);

  return {
    quickWins: quickWins.length ? quickWins : actions.slice(0, 2).map((action) => action.title),
    mediumTerm: mediumTerm.length ? mediumTerm : actions.slice(2, 4).map((action) => action.title),
    bigBets: bigBets.length ? bigBets : actions.slice(4, 6).map((action) => action.title)
  };
}

function sectionChip(value: string) {
  return (
    <span key={value} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
      {value}
    </span>
  );
}

function TokenChipButton({ value, swatch }: { value: string; swatch?: string | null }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };
  return (
    <div key={value} className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-2 text-sm text-white/75 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
      >
        {swatch ? (
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-white/15"
            style={{ backgroundColor: swatch }}
            aria-hidden
          />
        ) : null}
        {value}
        <span className="ml-0.5 font-mono text-[10px] text-white/35">{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <pre className="text-[11px] leading-5 text-[#7cf5d4]/80"><code>{value}</code></pre>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1 font-mono text-[10px] text-white/50 transition hover:bg-white/12 hover:text-white/80"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function colorTokenChip(value: string) {
  const swatch = getColorSwatchValue(value);
  return <TokenChipButton key={value} value={value} swatch={swatch} />;
}

export function ReportOverview({ report, scanMeta }: ReportOverviewProps) {
  const [activeTab, setActiveTab] = useState<"ui" | "security" | "bugs">("ui");
  const uiStyle = useMemo(() => report.uiStyle ?? buildUiStyleFallback(report), [report]);
  const securityTechnical = useMemo(
    () => report.securityTechnical ?? buildSecurityFallback(report),
    [report]
  );
  const executiveSummary = useMemo(
    () => report.executiveSummary ?? buildExecutiveSummaryFallback(report),
    [report]
  );
  const opportunityMap = useMemo(
    () => report.opportunityMap ?? buildOpportunityMapFallback(report),
    [report]
  );
  const prioritizedActions = useMemo(
    () => (report.prioritizedActions?.length ? report.prioritizedActions : uiStyle.prioritizedActions ?? []),
    [report, uiStyle]
  );
  const customerSignals = report.source.customerSignals;
  const trustCoverage = useMemo(
    () => customerSignals?.trustCoverage ?? {
      hasContactDetailsRate: 0,
      hasTestimonialsRate: 0,
      hasFaqRate: 0,
      hasPolicyPagesRate: 0
    },
    [customerSignals]
  );
  const readabilitySignals = useMemo(
    () => ({
      longParagraphCount: customerSignals?.readability.longParagraphCount ?? uiStyle.contentClarity.longParagraphCount ?? 0,
      avgWordsPerSentence: customerSignals?.readability.avgWordsPerSentence ?? 0,
      avgParagraphWords: customerSignals?.readability.avgParagraphWords ?? uiStyle.contentClarity.avgParagraphWords ?? 0
    }),
    [customerSignals, uiStyle]
  );
  const headingJumpCount = customerSignals?.structure?.headingJumpCount ?? 0;
  const complexForms = customerSignals?.forms?.complexForms ?? 0;
  const conversionFriction = customerSignals?.conversionFriction ?? {
    pagesWithoutClearCta: 0,
    pagesWithLongCopy: 0,
    pagesWithComplexForms: 0,
    trustWeakPages: 0
  };
  const uiScores = report.scores.filter((score) => score.label !== "How safe your site is");
  const securityScore = report.scores.find((score) => score.label === "How safe your site is");
  const uiSections = [
    { id: "report-section-executive", label: "Executive" },
    { id: "report-section-roadmap", label: "Roadmap" },
    { id: "report-section-scores", label: "Scores" },
    { id: "report-section-matrix", label: "Impact matrix" },
    { id: "report-section-signals", label: "Signals" },
    { id: "report-section-visual", label: "Visual language" },
    { id: "report-section-improvements", label: "Improvements" }
  ];

  const tabOrder: Array<"ui" | "security" | "bugs"> = ["ui", "security", "bugs"];
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = tabOrder.indexOf(activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setActiveTab(tabOrder[(currentIndex + 1) % tabOrder.length]);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setActiveTab(tabOrder[(currentIndex - 1 + tabOrder.length) % tabOrder.length]);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveTab("ui");
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveTab("bugs");
    }
  };

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
            <div className="flex flex-col gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/72">
                <div>{report.scope}</div>
                <div>{new Date(report.scannedAt).toLocaleString()}</div>
              </div>
              <div className="flex gap-2" data-print-hide>
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-xs font-medium text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `syntellia-${report.siteName}-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download raw data
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2 text-xs font-medium text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                  onClick={() => window.print()}
                >
                  Print / PDF
                </button>
              </div>
            </div>
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-white/45">Review snapshot</p>
          <div className="mt-6 space-y-3 text-sm text-white/72">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Status: {scanMeta?.status ?? "Created"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Project: {scanMeta?.projectName ?? "General"}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Scan type: Full check</div>
            {report.coverageScore ? (
              <div className={`rounded-2xl border px-4 py-3 ${
                report.coverageScore.pagesScanned >= report.coverageScore.pagesAttempted && report.coverageScore.blockedByRobots === 0
                  ? "border-white/10 bg-white/5"
                  : "border-[#ffd08a]/30 bg-[#ffd08a]/6"
              }`}>
                {report.coverageScore.pagesScanned}/{report.coverageScore.pagesAttempted} pages analyzed · {report.coverageScore.label}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Checking up to {scanMeta?.pageLimit ?? 10} pages</div>
            )}
          </div>
        </ShellCard>
      </div>

      {report.aiNarrative ? (
        <ShellCard className="p-7 border-[#7c6aff]/20 bg-[#7c6aff]/[0.04]">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#a78bfa]">
              AI Analysis · {report.aiNarrative.model}
            </span>
          </div>
          <p className="text-base leading-relaxed text-white/85">{report.aiNarrative.executiveSummary}</p>

          {report.aiNarrative.keyInsights.length > 0 ? (
            <ul className="mt-5 space-y-2">
              {report.aiNarrative.keyInsights.map((insight, i) => (
                <li key={i} className="flex gap-3 text-sm text-white/70">
                  <span className="text-[#7c6aff] mt-0.5 shrink-0">→</span>
                  {insight}
                </li>
              ))}
            </ul>
          ) : null}

          {report.aiNarrative.topActions.length > 0 ? (
            <div className="mt-6 space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/40">This week</p>
              {report.aiNarrative.topActions.map((action, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm text-white/75">
                  <span className="shrink-0 text-[#d4a853]">{i + 1}.</span>
                  {action}
                </div>
              ))}
            </div>
          ) : null}

          {report.aiNarrative.encouragements.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {report.aiNarrative.encouragements.map((enc, i) => (
                <div key={i} className="rounded-full border border-[#2dd4bf]/20 bg-[#2dd4bf]/[0.06] px-4 py-2 text-xs text-[#99ffe8]">
                  {enc}
                </div>
              ))}
            </div>
          ) : null}
        </ShellCard>
      ) : null}

      {report.performanceSummary ? (
        <ShellCard className="p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">Performance</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] text-white/40">Avg page load time</div>
              <div className={`mt-1.5 text-lg font-semibold ${
                report.performanceSummary.avgFetchMs < 500
                  ? "text-[#2dd4bf]"
                  : report.performanceSummary.avgFetchMs < 1500
                    ? "text-[#d4a853]"
                    : "text-[#ffb39f]"
              }`}>
                {report.performanceSummary.avgFetchMs < 1000
                  ? `${report.performanceSummary.avgFetchMs}ms`
                  : `${(report.performanceSummary.avgFetchMs / 1000).toFixed(1)}s`}
              </div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] text-white/40">Slowest page</div>
              <div className={`mt-1.5 text-lg font-semibold ${
                report.performanceSummary.slowestPageMs < 1000
                  ? "text-[#2dd4bf]"
                  : report.performanceSummary.slowestPageMs < 3000
                    ? "text-[#d4a853]"
                    : "text-[#ffb39f]"
              }`}>
                {report.performanceSummary.slowestPageMs < 1000
                  ? `${report.performanceSummary.slowestPageMs}ms`
                  : `${(report.performanceSummary.slowestPageMs / 1000).toFixed(1)}s`}
              </div>
              <div className="mt-1 text-[10px] text-white/35 truncate">{report.performanceSummary.slowestPageUrl}</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] text-white/40">Files loaded</div>
              <div className="mt-1.5 text-lg font-semibold text-white/80">
                {report.performanceSummary.totalResourcesEstimate}
              </div>
              <div className="mt-1 text-[10px] text-white/35">scripts + images</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <div className="text-[11px] text-white/40">Load speed</div>
              <div className={`mt-1.5 text-sm font-medium ${
                report.performanceSummary.avgFetchMs < 500
                  ? "text-[#2dd4bf]"
                  : report.performanceSummary.avgFetchMs < 1500
                    ? "text-[#d4a853]"
                    : "text-[#ffb39f]"
              }`}>
                {report.performanceSummary.avgFetchMs < 500
                  ? "Fast"
                  : report.performanceSummary.avgFetchMs < 1500
                    ? "Average"
                    : "Slow"}
              </div>
            </div>
          </div>
        </ShellCard>
      ) : null}

      <ShellCard className="p-3">
        <div className="grid grid-cols-3 gap-2 rounded-[18px] border border-white/8 bg-white/5 p-2" role="tablist" aria-label="Report sections">
          <button
            type="button"
            id="report-tab-ui"
            role="tab"
            aria-selected={activeTab === "ui"}
            aria-controls="report-panel-ui"
            tabIndex={activeTab === "ui" ? 0 : -1}
            className={`rounded-[14px] px-4 py-3 text-sm uppercase tracking-[0.22em] transition ${
              activeTab === "ui" ? "bg-white text-[#09101d]" : "bg-transparent text-white/72 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("ui")}
            onKeyDown={handleTabKeyDown}
          >
            UI & Styling
          </button>
          <button
            type="button"
            id="report-tab-security"
            role="tab"
            aria-selected={activeTab === "security"}
            aria-controls="report-panel-security"
            tabIndex={activeTab === "security" ? 0 : -1}
            className={`rounded-[14px] px-4 py-3 text-sm uppercase tracking-[0.22em] transition ${
              activeTab === "security" ? "bg-white text-[#09101d]" : "bg-transparent text-white/72 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("security")}
            onKeyDown={handleTabKeyDown}
          >
            Security
          </button>
          <button
            type="button"
            id="report-tab-bugs"
            role="tab"
            aria-selected={activeTab === "bugs"}
            aria-controls="report-panel-bugs"
            tabIndex={activeTab === "bugs" ? 0 : -1}
            className={`rounded-[14px] px-4 py-3 text-sm uppercase tracking-[0.22em] transition ${
              activeTab === "bugs" ? "bg-white text-[#09101d]" : "bg-transparent text-white/72 hover:bg-white/10"
            }`}
            onClick={() => setActiveTab("bugs")}
            onKeyDown={handleTabKeyDown}
          >
            Bugs & Reliability
          </button>
        </div>
      </ShellCard>

      {activeTab === "ui" ? (
        <div id="report-panel-ui" role="tabpanel" aria-labelledby="report-tab-ui" className="space-y-8">
          <ShellCard className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-white/45">Jump to</span>
              {uiSections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs text-white/72 transition hover:bg-white/12"
                >
                  {section.label}
                </a>
              ))}
            </div>
          </ShellCard>

          <div id="report-section-executive" className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
            <ShellCard className="p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Quick summary</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{executiveSummary.headline}</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm text-white/72">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/55">What&apos;s going well</p>
                  <ul className="mt-3 space-y-2">
                    {executiveSummary.highlights.map((item) => (
                      <li key={item} className="text-white/78">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/55">Things to fix</p>
                  <ul className="mt-3 space-y-2">
                    {executiveSummary.risks.map((item) => (
                      <li key={item} className="text-white/78">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/55">Biggest improvements</p>
                  <ul className="mt-3 space-y-2">
                    {executiveSummary.opportunities.map((item) => (
                      <li key={item} className="text-white/78">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </ShellCard>
            <ShellCard className="p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Where to improve</p>
              <div className="mt-6 space-y-4 text-sm text-white/75">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/55">Easy wins — do these first</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunityMap.quickWins.map(sectionChip)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/55">Worth doing next</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunityMap.mediumTerm.map(sectionChip)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/55">Bigger changes for bigger results</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunityMap.bigBets.map(sectionChip)}
                  </div>
                </div>
              </div>
            </ShellCard>
          </div>

          <ShellCard id="report-section-roadmap" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">What to do first</p>
                <h2 className="mt-3 text-2xl font-semibold text-white">Your step-by-step action plan</h2>
              </div>
              <p className="text-sm text-white/52">The 3 most important things to do</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {prioritizedActions.slice(0, 3).map((action, index) => (
                <div key={action.title} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Step {index + 1}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{action.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">{action.detail}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {getImpactLabel(action.impact)} impact
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      {action.effort} effort
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard className="p-8">
            <p className="text-sm uppercase tracking-[0.24em] text-white/45">UI & styling summary</p>
            <p className="mt-4 text-base leading-8 text-white/72">{uiStyle.summary}</p>
          </ShellCard>

          <ShellCard id="report-section-scores" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">Your website scores</h2>
              <p className="text-sm text-white/52">How your site performs across four key areas</p>
            </div>
            <div className="mt-6 grid gap-4 xl:grid-cols-4">
              {uiScores.map((score) => (
                <div key={score.label} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/45">{score.label}</p>
                  <p className="mt-3 text-4xl font-semibold text-white">{score.value}/100</p>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7cf5d4] via-[#6ca8ff] to-[#8cc6ff]"
                      style={{ width: `${Math.max(4, Math.min(100, score.value))}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-white/55">{score.trend}</p>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard id="report-section-matrix" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">Effort vs impact overview</h2>
              <p className="text-sm text-white/52">What gives the most results for the least work</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                {
                  label: "High impact · Low effort",
                  items: prioritizedActions.filter((action) => action.impact === "high" && action.effort === "low")
                },
                {
                  label: "High impact · Higher effort",
                  items: prioritizedActions.filter((action) => action.impact === "high" && action.effort !== "low")
                },
                {
                  label: "Medium impact",
                  items: prioritizedActions.filter((action) => action.impact === "medium")
                },
                {
                  label: "Low impact / maintain",
                  items: prioritizedActions.filter((action) => action.impact === "low")
                }
              ].map((bucket) => (
                <div key={bucket.label} className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">{bucket.label}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(bucket.items.length ? bucket.items : [{ title: "No actions in this segment yet" } as const]).slice(0, 4).map((item) => (
                      <span key={item.title} className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/72">
                        {item.title}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ShellCard>

          <ShellCard id="report-section-signals" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">What builds trust and what slows visitors down</h2>
              <p className="text-sm text-white/52">What reassures visitors and what makes them hesitate</p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages showing contact details: {trustCoverage.hasContactDetailsRate}%
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages showing customer reviews: {trustCoverage.hasTestimonialsRate}%
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages with a FAQ section: {trustCoverage.hasFaqRate}%
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages showing privacy or terms: {trustCoverage.hasPolicyPagesRate}%
                </div>
              </div>
              <div className="grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Paragraphs too long to read easily: {readabilitySignals.longParagraphCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Average sentence length: {readabilitySignals.avgWordsPerSentence} words
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Headings in wrong order: {headingJumpCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Forms with too many fields: {complexForms}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages with no clear next step: {conversionFriction.pagesWithoutClearCta}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages with too much text to read: {conversionFriction.pagesWithLongCopy}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages that feel untrustworthy: {conversionFriction.trustWeakPages}
                </div>
              </div>
            </div>
          </ShellCard>

          <div id="report-section-visual" className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Visual language</h2>
              <div className="mt-6 space-y-5">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Colors</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    {(uiStyle.styleTokens.colors.length ? uiStyle.styleTokens.colors : ["No readable colors found"]).map(colorTokenChip)}
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
              <h2 className="text-2xl font-semibold text-white">What&apos;s on your page</h2>
              <div className="mt-6 grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Headings found: {uiStyle.contentClarity.headingCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Average paragraph length: {uiStyle.contentClarity.avgParagraphWords} words
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Paragraphs too long to read easily: {uiStyle.contentClarity.longParagraphCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Buttons and links found: {uiStyle.interactionSignals.ctaLabels.length}
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Page headings</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(uiStyle.contentClarity.headingExamples.length
                      ? uiStyle.contentClarity.headingExamples
                      : ["No headings found"]).slice(0, 10).map(sectionChip)}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Buttons and links</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(uiStyle.interactionSignals.ctaLabels.length
                      ? uiStyle.interactionSignals.ctaLabels
                      : ["No buttons or links found"]).slice(0, 10).map(sectionChip)}
                  </div>
                </div>
              </div>
            </ShellCard>
          </div>

          <ShellCard id="report-section-improvements" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">Suggested improvements</h2>
              <p className="text-sm text-white/52">Most impactful changes first</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {prioritizedActions.map((action) => (
                <details key={action.title} className={`relative rounded-[24px] border border-white/10 bg-white/5 p-5 ${getImpactStyle(action.impact)}`}>
                  <SourceSnippetButton snippet={action.sourceSnippet} />
                  <summary className="cursor-pointer list-none">
                    <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                      {getImpactLabel(action.impact)} · {action.effort} effort
                    </div>
                    <h3 className="mt-4 text-xl font-medium text-white">{action.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                      Confidence {Math.round(action.confidence * 100)}%
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">Expand for implementation detail</p>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-white/65">{action.detail}</p>
                </details>
              ))}
            </div>
          </ShellCard>
        </div>
      ) : activeTab === "security" ? (
        <div id="report-panel-security" role="tabpanel" aria-labelledby="report-tab-security" className="space-y-8">
          <ShellCard className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-white/45">Jump to</span>
              {[
                { id: "security-section-posture", label: "Safety score" },
                { id: "security-section-headers", label: "Browser safety settings" },
                { id: "security-section-cookies", label: "Files, links & forms" },
                { id: "security-section-actions", label: "What to fix" },
                { id: "security-section-crawl", label: "Scan coverage" }
              ].map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs text-white/72 transition hover:bg-white/12"
                >
                  {section.label}
                </a>
              ))}
            </div>
          </ShellCard>

          <ShellCard id="security-section-posture" className="p-8">
            <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="rounded-[26px] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.24em] text-white/55">How safe your site is for visitors</p>
                <p className="mt-4 text-6xl font-semibold text-white">{securityTechnical.postureScore}/100</p>
                <p className="mt-4 text-sm leading-7 text-white/65">{securityTechnical.summary}</p>
                {securityScore ? (
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/45">{securityScore.trend}</p>
                ) : null}
              </div>
              <div>
                <p className="mb-3 text-sm text-white/52">How well your website guards people while they browse</p>
                <dl className="grid gap-3 md:grid-cols-2 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages using a secure connection</dt>
                    <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.transport.httpsCoverage}%</dd>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages that switch to secure automatically</dt>
                    <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.transport.redirectedToHttpsCount}</dd>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages that lost their secure connection</dt>
                    <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.transport.downgradedToHttpCount}</dd>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">How we checked</dt>
                    <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.transport.executionMode}{securityTechnical.transport.modeFallbackUsed ? " (fallback used)" : ""}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </ShellCard>

          <div id="security-section-headers" className="grid gap-5 lg:grid-cols-[1.05fr,0.95fr]">
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Browser safety settings</h2>
              <p className="mt-2 text-sm text-white/52">When these settings are missing, browsers can&apos;t protect your visitors properly — leaving them open to attacks and data theft</p>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/55">Missing safety settings</p>
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
                  <p className="text-sm uppercase tracking-[0.24em] text-white/55">Settings that are too weak to protect</p>
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
            <ShellCard id="security-section-cookies" className="p-8">
              <h2 className="text-2xl font-semibold text-white">Visitor files, links, and contact forms</h2>
              <p className="mt-2 text-sm text-white/52">Small files saved on visitors&apos; devices, links, and forms — if not protected, personal data can be stolen</p>
              <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Small files saved on visitors&apos; devices</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.cookies.totalSetCookie}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Protection on those files — HTTPS-only · Hidden from scripts · Blocked from other sites</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.cookies.secureRate}% · {securityTechnical.cookies.httpOnlyRate}% · {securityTechnical.cookies.sameSiteRate}%</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Links that could leak visitor sessions when opening a new tab</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.linksAndForms.unsafeTargetBlankCount}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Links that send visitors to an unprotected connection</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.linksAndForms.insecureLinkCount}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Forms that send data without protection</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.linksAndForms.insecureFormActionCount}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Mixed secure and insecure files on the same page</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.scriptSurface?.mixedContentCount ?? 0}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Files from other websites with no tamper protection</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.scriptSurface?.scriptsWithoutSriCount ?? 0} of {securityTechnical.scriptSurface?.externalScriptCount ?? 0}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages that allow any other website to read their data</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.cors?.riskyPageCount ?? 0}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages that may store sensitive data in the browser cache</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.cachePolicy?.riskyPageCount ?? 0}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Sign-in pages missing a hidden security check</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.authSurface?.passwordFlowMissingCsrfCount ?? 0}</dd>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages ready to enforce HTTPS permanently</dt>
                  <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.hsts?.preloadReadyCount ?? 0}</dd>
                </div>
              </dl>
              {(securityTechnical.scriptSurface?.externalScriptHosts?.length ?? 0) > 0 ? (
                <div className="mt-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Other websites loading files onto your site</p>
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

          <ShellCard id="security-section-actions" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">What to fix to protect your visitors</h2>
              <p className="text-sm text-white/52">Most urgent first</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {securityTechnical.recommendations.map((recommendation) => (
                <details key={recommendation.title} className="relative rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <SourceSnippetButton snippet={recommendation.sourceSnippet} />
                  <summary className="cursor-pointer list-none">
                    <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                      {getSeverityLabel(recommendation.impact)}
                    </div>
                    <h3 className="mt-4 text-xl font-medium text-white">{recommendation.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">Expand to see the fix</p>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-white/65">{recommendation.detail}</p>
                </details>
              ))}
            </div>
          </ShellCard>

          <ShellCard id="security-section-crawl" className="p-8">
            <h2 className="text-2xl font-semibold text-white">What the scan could and couldn&apos;t reach</h2>
            <p className="mt-2 text-sm text-white/52">Some pages may have been skipped — here&apos;s why</p>
            <dl className="mt-6 grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages your site told us not to check</dt>
                <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.crawlDiagnostics.blockedByRobots}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages that failed to load</dt>
                <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.crawlDiagnostics.pageErrors}</dd>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <dt className="text-[10px] uppercase tracking-[0.2em] text-white/45">Pages we checked for safety issues</dt>
                <dd className="mt-1 text-base font-medium text-white/80">{securityTechnical.pageHighlights.length}</dd>
              </div>
            </dl>
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
      ) : (
        <div id="report-panel-bugs" role="tabpanel" aria-labelledby="report-tab-bugs" className="space-y-8">
          {report.bugsReliability ? (
            <>
              <ShellCard className="p-8">
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">Reliability overview</p>
                <h2 className="mt-4 text-2xl font-semibold text-white">{report.bugsReliability.summary}</h2>
                {report.bugsReliability.bugCount === 0 ? (
                  <div className="mt-6 rounded-[22px] border border-[#7cf5d4]/25 bg-[#7cf5d4]/6 p-5 text-sm text-white/75">
                    Great news — every page loaded without errors.
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] ${
                      report.bugsReliability.bugs.some((b) => b.severity === "high")
                        ? "border-[#ffb39f]/30 bg-[#ffb39f]/8 text-[#ffb39f]"
                        : "border-[#ffd08a]/30 bg-[#ffd08a]/8 text-[#ffd08a]"
                    }`}>
                      {report.bugsReliability.bugCount} issue{report.bugsReliability.bugCount === 1 ? "" : "s"} found
                    </span>
                  </div>
                )}
              </ShellCard>

              {report.bugsReliability.bugs.length > 0 ? (
                <ShellCard className="p-8">
                  <h2 className="text-2xl font-semibold text-white">Page issues</h2>
                  <p className="mt-2 text-sm text-white/52">Things that could frustrate or confuse real visitors</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {report.bugsReliability.bugs.map((bug, index) => (
                      <details
                        key={`${bug.page}-${index}`}
                        className={`relative rounded-[24px] border bg-white/5 p-5 ${
                          bug.severity === "high"
                            ? "border-l-4 border-[#ffb39f]/25 border-l-[#ffb39f]"
                            : bug.severity === "medium"
                              ? "border-l-4 border-[#ffd08a]/25 border-l-[#ffd08a]"
                              : "border-l-4 border-[#7cf5d4]/25 border-l-[#7cf5d4]"
                        }`}
                      >
                        <SourceSnippetButton snippet={bug.sourceSnippet} />
                        <summary className="cursor-pointer list-none">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                              {getSeverityLabel(bug.severity)}
                            </span>
                            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
                              {bug.confidence}
                            </span>
                          </div>
                          <h3 className="mt-3 text-lg font-medium text-white">{bug.issue}</h3>
                          <p className="mt-1 truncate text-xs text-white/40">{bug.page}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">Expand for details and fix steps</p>
                        </summary>
                        <p className="mt-4 text-sm leading-7 text-white/65">{bug.detail}</p>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/45">How to fix</p>
                          <p className="mt-2 text-sm leading-7 text-white/72">{bug.remediation}</p>
                        </div>
                      </details>
                    ))}
                  </div>
                </ShellCard>
              ) : null}
            </>
          ) : (
            <ShellCard className="p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">Page problems found</p>
              <p className="mt-4 text-sm leading-7 text-white/65">
                Run a new scan to see a full list of page problems.
              </p>
            </ShellCard>
          )}
        </div>
      )}
    </div>
  );
}
