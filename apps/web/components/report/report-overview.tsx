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
import { trackAnalyticsEvent } from "@/lib/scan-api-client";
import { ImplementationCodePanel } from "@/components/ui/implementation-code-panel";
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

function colorTokenChip(value: string) {
  const swatch = getColorSwatchValue(value);
  return (
    <span
      key={value}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-sm text-white/75"
    >
      {swatch ? (
        <span
          className="h-4 w-4 rounded-full border border-white/15"
          style={{ backgroundColor: swatch }}
          aria-hidden
        />
      ) : null}
      {value}
    </span>
  );
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
  const implementationSnippets = useMemo(
    () => uiStyle.implementationSnippets?.length
      ? uiStyle.implementationSnippets
      : buildImplementationSnippetsFromTokens(
        uiStyle.styleTokens.colors,
        uiStyle.styleTokens.fonts,
        uiStyle.styleTokens.components
      ),
    [uiStyle]
  );

  const uiScores = report.scores.filter((score) => score.label !== "Security posture");
  const securityScore = report.scores.find((score) => score.label === "Security posture");
  const uiSections = [
    { id: "report-section-executive", label: "Executive" },
    { id: "report-section-roadmap", label: "Roadmap" },
    { id: "report-section-scores", label: "Scores" },
    { id: "report-section-matrix", label: "Impact matrix" },
    { id: "report-section-signals", label: "Signals" },
    { id: "report-section-visual", label: "Visual language" },
    { id: "report-section-improvements", label: "Improvements" }
  ];

  const trackCodePanelToggle = (snippetId: string, expanded: boolean) => {
    void trackAnalyticsEvent("report_code_panel_toggled", {
      snippetId,
      expanded,
      siteName: report.siteName
    });
  };

  const trackCodeCopy = (snippetId: string, success: boolean) => {
    void trackAnalyticsEvent("report_code_copied", {
      snippetId,
      success,
      siteName: report.siteName
    });
  };
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
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Analysis mode: Comprehensive</div>
            {report.coverageScore ? (
              <div className={`rounded-2xl border px-4 py-3 ${
                report.coverageScore.pagesScanned >= report.coverageScore.pagesAttempted && report.coverageScore.blockedByRobots === 0
                  ? "border-white/10 bg-white/5"
                  : "border-[#ffd08a]/30 bg-[#ffd08a]/6"
              }`}>
                {report.coverageScore.pagesScanned}/{report.coverageScore.pagesAttempted} pages analyzed · {report.coverageScore.label}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Coverage target: up to {scanMeta?.pageLimit ?? 10} pages</div>
            )}
          </div>
        </ShellCard>
      </div>

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
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Executive snapshot</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">{executiveSummary.headline}</h2>
              <div className="mt-6 grid gap-4 md:grid-cols-3 text-sm text-white/72">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Highlights</p>
                  <ul className="mt-3 space-y-2">
                    {executiveSummary.highlights.map((item) => (
                      <li key={item} className="text-white/78">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Watch-outs</p>
                  <ul className="mt-3 space-y-2">
                    {executiveSummary.risks.map((item) => (
                      <li key={item} className="text-white/78">{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/45">Best opportunities</p>
                  <ul className="mt-3 space-y-2">
                    {executiveSummary.opportunities.map((item) => (
                      <li key={item} className="text-white/78">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </ShellCard>
            <ShellCard className="p-8">
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Opportunity map</p>
              <div className="mt-6 space-y-4 text-sm text-white/75">
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">Quick wins</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunityMap.quickWins.map(sectionChip)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">Medium-term lifts</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunityMap.mediumTerm.map(sectionChip)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">Big bets</div>
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
                <h2 className="mt-3 text-2xl font-semibold text-white">A focused next-step roadmap</h2>
              </div>
              <p className="text-sm text-white/52">Top 3 actions</p>
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
              <h2 className="text-2xl font-semibold text-white">Design executive summary</h2>
              <p className="text-sm text-white/52">Clarity, trust, action, and accessibility at a glance</p>
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
              <h2 className="text-2xl font-semibold text-white">Impact matrix</h2>
              <p className="text-sm text-white/52">Prioritize by business impact and delivery effort</p>
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
              <h2 className="text-2xl font-semibold text-white">Trust and friction signals</h2>
              <p className="text-sm text-white/52">Customer reassurance + conversion drag</p>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <div className="grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Contact visibility: {trustCoverage.hasContactDetailsRate}% of pages
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Testimonials presence: {trustCoverage.hasTestimonialsRate}% of pages
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  FAQ coverage: {trustCoverage.hasFaqRate}% of pages
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Policy visibility: {trustCoverage.hasPolicyPagesRate}% of pages
                </div>
              </div>
              <div className="grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Long paragraphs: {readabilitySignals.longParagraphCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Avg words per sentence: {readabilitySignals.avgWordsPerSentence}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Heading jumps: {headingJumpCount}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Complex forms: {complexForms}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages without clear CTA: {conversionFriction.pagesWithoutClearCta}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Pages with long copy friction: {conversionFriction.pagesWithLongCopy}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Trust-weak pages: {conversionFriction.trustWeakPages}
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
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/45">Developer implementation snippets</p>
                  <div className="mt-4 space-y-3">
                    {implementationSnippets.map((snippet) => (
                      <ImplementationCodePanel
                        key={snippet.id}
                        snippet={snippet}
                        onToggle={(expanded) => trackCodePanelToggle(snippet.id, expanded)}
                        onCopy={(success) => trackCodeCopy(snippet.id, success)}
                      />
                    ))}
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

          <ShellCard id="report-section-improvements" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">UI-first improvements</h2>
              <p className="text-sm text-white/52">Prioritized by customer-facing impact</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {prioritizedActions.map((action) => (
                <details key={action.title} className={`rounded-[24px] border border-white/10 bg-white/5 p-5 ${getImpactStyle(action.impact)}`}>
                  <summary className="cursor-pointer list-none">
                    <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                      {getImpactLabel(action.impact)} · {action.effort} effort
                    </div>
                    <h3 className="mt-4 text-xl font-medium text-white">{action.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                      Confidence {Math.round(action.confidence * 100)}%
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">Open to view implementation detail</p>
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
                { id: "security-section-posture", label: "Posture score" },
                { id: "security-section-headers", label: "Header hardening" },
                { id: "security-section-cookies", label: "Cookies & links" },
                { id: "security-section-actions", label: "Recommended actions" },
                { id: "security-section-crawl", label: "Crawl diagnostics" }
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
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">Security posture score</p>
                <p className="mt-4 text-6xl font-semibold text-white">{securityTechnical.postureScore}/100</p>
                <p className="mt-4 text-sm leading-7 text-white/65">{securityTechnical.summary}</p>
                {securityScore ? (
                  <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/45">{securityScore.trend}</p>
                ) : null}
              </div>
              <div>
                <p className="mb-3 text-sm text-white/52">How well the site protects visitors in transit</p>
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
            </div>
          </ShellCard>

          <div id="security-section-headers" className="grid gap-5 lg:grid-cols-[1.05fr,0.95fr]">
            <ShellCard className="p-8">
              <h2 className="text-2xl font-semibold text-white">Header hardening coverage</h2>
              <p className="mt-2 text-sm text-white/52">Missing headers let browsers make unsafe assumptions — increasing XSS, clickjacking, and data-leak risk for visitors</p>
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
            <ShellCard id="security-section-cookies" className="p-8">
              <h2 className="text-2xl font-semibold text-white">Cookies, links, and forms</h2>
              <p className="mt-2 text-sm text-white/52">Unsecured cookies and insecure links expose session data and visitor information in transit</p>
              <div className="mt-6 grid gap-3 text-sm text-white/75">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Cookies observed: {securityTechnical.cookies.totalSetCookie}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Cookie flags · Secure {securityTechnical.cookies.secureRate}% · HttpOnly {securityTechnical.cookies.httpOnlyRate}% · SameSite {securityTechnical.cookies.sameSiteRate}%
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Unsafe new-tab links: {securityTechnical.linksAndForms.unsafeTargetBlankCount}
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
                  External scripts each a supply-chain dependency — without SRI: {securityTechnical.scriptSurface?.scriptsWithoutSriCount ?? 0} of {securityTechnical.scriptSurface?.externalScriptCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Overly open cross-site access pages: {securityTechnical.cors?.riskyPageCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Cache-policy risk pages: {securityTechnical.cachePolicy?.riskyPageCount ?? 0}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  Sign-in pages missing CSRF signal: {securityTechnical.authSurface?.passwordFlowMissingCsrfCount ?? 0}
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

          <ShellCard id="security-section-actions" className="p-8">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-white">Recommended security actions</h2>
              <p className="text-sm text-white/52">Prioritized by risk to visitors</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {securityTechnical.recommendations.map((recommendation) => (
                <details key={recommendation.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <summary className="cursor-pointer list-none">
                    <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                      {getSeverityLabel(recommendation.impact)}
                    </div>
                    <h3 className="mt-4 text-xl font-medium text-white">{recommendation.title}</h3>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">Open to view what to do</p>
                  </summary>
                  <p className="mt-4 text-sm leading-7 text-white/65">{recommendation.detail}</p>
                </details>
              ))}
            </div>
          </ShellCard>

          <ShellCard id="security-section-crawl" className="p-8">
            <h2 className="text-2xl font-semibold text-white">Crawl diagnostics</h2>
            <p className="mt-2 text-sm text-white/52">How much of the site was reached during the scan</p>
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
      ) : (
        <div id="report-panel-bugs" role="tabpanel" aria-labelledby="report-tab-bugs" className="space-y-8">
          {report.bugsReliability ? (
            <>
              <ShellCard className="p-8">
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">Bugs & reliability summary</p>
                <h2 className="mt-4 text-2xl font-semibold text-white">{report.bugsReliability.summary}</h2>
                {report.bugsReliability.bugCount === 0 ? (
                  <div className="mt-6 rounded-[22px] border border-[#7cf5d4]/25 bg-[#7cf5d4]/6 p-5 text-sm text-white/75">
                    All scanned pages loaded successfully with no crawl errors detected.
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
                  <p className="mt-2 text-sm text-white/52">Problems found during the crawl that visitors may also encounter</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {report.bugsReliability.bugs.map((bug, index) => (
                      <details
                        key={`${bug.page}-${index}`}
                        className={`rounded-[24px] border bg-white/5 p-5 ${
                          bug.severity === "high"
                            ? "border-l-4 border-[#ffb39f]/25 border-l-[#ffb39f]"
                            : bug.severity === "medium"
                              ? "border-l-4 border-[#ffd08a]/25 border-l-[#ffd08a]"
                              : "border-l-4 border-[#7cf5d4]/25 border-l-[#7cf5d4]"
                        }`}
                      >
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
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-white/40">Open to see details and fix</p>
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
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Bugs & reliability</p>
              <p className="mt-4 text-sm leading-7 text-white/65">
                Bug and reliability data is available for scans run with the latest analysis engine. Re-run your scan to see page-level issue detection.
              </p>
            </ShellCard>
          )}
        </div>
      )}
    </div>
  );
}
