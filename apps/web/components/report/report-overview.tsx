import type { ScanReport } from "@/lib/report-schema";
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

export function ReportOverview({ report, scanMeta }: ReportOverviewProps) {
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
            {report.source.crawl ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Crawl: {report.source.crawl.pagesScanned} scanned, depth {report.source.crawl.maxReachedDepth}/{report.source.crawl.maxDepth}
              </div>
            ) : null}
          </div>
          <p className="mt-6 text-sm uppercase tracking-[0.3em] text-white/45">Customer journey cues</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-sm text-white/75">
            {[scanMeta?.focusArea ?? "Overall feel", ...(report.source.customerSignals?.ctaLabels.slice(0, 2) ?? []), ...report.interactions.slice(0, 1)].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {item}
              </div>
            ))}
          </div>
        </ShellCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {report.scores.map((score) => (
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
          <h2 className="text-2xl font-semibold text-white">What customers will notice</h2>
          <div className="mt-6 space-y-5">
            {report.tokenGroups.map((group) => (
              <div key={group.label} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">{group.label}</div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {group.values.map((value) => (
                    <span key={value} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/75">
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <h2 className="text-2xl font-semibold text-white">Key page building blocks</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {report.components.map((component) => (
              <span key={component} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/78">
                {component}
              </span>
            ))}
          </div>
        </ShellCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
        <ShellCard className="p-8">
          <h2 className="text-2xl font-semibold text-white">Evidence from the live page</h2>
          <div className="mt-6 space-y-5">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm uppercase tracking-[0.24em] text-white/45">Fetched page title</div>
              <div className="mt-3 text-xl text-white">{report.source.pageTitle}</div>
              <div className="mt-4 text-sm leading-7 text-white/64">
                {report.source.metaDescription || "No meta description was found in the page source."}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-sm text-white/75">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Headings: {report.source.headingCount}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Links: {report.source.linkCount}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Buttons: {report.source.buttonCount}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Forms: {report.source.formCount}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Images: {report.source.imageCount}</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">HTTP status: {report.source.statusCode}</div>
            </div>
            {report.source.customerSignals ? (
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Customer-readiness metrics</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    CTA labels found: {report.source.customerSignals.ctaLabels.length}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Trust cues found: {report.source.customerSignals.trustSignals.length}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Avg paragraph size: {report.source.customerSignals.readability.avgParagraphWords} words
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Alt text coverage: {report.source.customerSignals.accessibility.altCoverage}%
                  </div>
                </div>
              </div>
            ) : null}
            {report.source.crawl ? (
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Crawl coverage</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Pages scanned: {report.source.crawl.pagesScanned}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Pages attempted: {report.source.crawl.pagesAttempted}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Robots blocked: {report.source.crawl.blockedByRobots}
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                    Mode: {report.source.crawl.executionMode}
                  </div>
                </div>
              </div>
            ) : null}
            {report.source.pages?.length ? (
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Scanned pages</div>
                <div className="mt-4 space-y-3">
                  {report.source.pages.slice(0, 6).map((page) => (
                    <div key={page.url} className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/75">
                      <div className="text-white">{page.pageTitle}</div>
                      <div className="mt-1 text-white/55">{page.url}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/45">
                        Status {page.statusCode} · CTA {page.ctaCount} · Trust cues {page.trustSignalCount}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </ShellCard>
        <ShellCard className="p-8">
          <h2 className="text-2xl font-semibold text-white">Brand and visual cues</h2>
          <div className="mt-6 space-y-5">
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-white/45">Colors</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {report.source.colors.length ? (
                  report.source.colors.map((color) => (
                    <span key={color} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/78">
                      {color}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/58">No readable colors found</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-sm uppercase tracking-[0.24em] text-white/45">Fonts</div>
              <div className="mt-4 flex flex-wrap gap-3">
                {report.source.fonts.length ? (
                  report.source.fonts.map((font) => (
                    <span key={font} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/78">
                      {font}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/58">No readable fonts found</span>
                )}
              </div>
            </div>
            {report.source.customerSignals?.highlightWords.length ? (
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Value words detected</div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {report.source.customerSignals.highlightWords.map((word) => (
                    <span key={word} className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/78">
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {report.source.notes.length ? (
              <div>
                <div className="text-sm uppercase tracking-[0.24em] text-white/45">Extraction notes</div>
                <div className="mt-4 space-y-3 text-sm leading-7 text-white/65">
                  {report.source.notes.map((note) => (
                    <div key={note} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </ShellCard>
      </div>

      <ShellCard className="p-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-white">What to improve first</h2>
          <p className="text-sm text-white/52">Plain-language actions prioritized by customer impact</p>
        </div>
        {report.prioritizedActions?.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {report.prioritizedActions.map((action) => (
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
        ) : null}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {report.findings.map((finding) => (
            <div key={finding.title} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
              <div className="inline-flex rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
                {getSeverityLabel(finding.severity)}
              </div>
              <h3 className="mt-4 text-xl font-medium text-white">{finding.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/65">{finding.detail}</p>
            </div>
          ))}
        </div>
      </ShellCard>
    </div>
  );
}
