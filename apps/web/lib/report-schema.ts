export type ReportScore = {
  label: string;
  value: number;
  trend: string;
};

export type ReportTokenGroup = {
  label: string;
  values: string[];
};

export type ReportFinding = {
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
};
export type PrioritizedAction = {
  title: string;
  detail: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  confidence: number;
};
export type ImplementationSnippet = {
  id: string;
  title: string;
  description?: string;
  language: string;
  code: string;
};

export type ExecutiveSummary = {
  headline: string;
  highlights: string[];
  risks: string[];
  opportunities: string[];
};

export type OpportunityMap = {
  quickWins: string[];
  mediumTerm: string[];
  bigBets: string[];
};

export type CrawlSourceMeta = {
  pagesScanned: number;
  pagesAttempted: number;
  blockedByRobots: number;
  maxDepth: number;
  maxReachedDepth: number;
  durationMs: number;
  requestedExecutionMode: string;
  executionMode: string;
  modeFallbackUsed: boolean;
};

export type CrawledPageSummary = {
  url: string;
  pageTitle: string;
  statusCode: number;
  ctaCount: number;
  trustSignalCount: number;
};

export type ExtractedPageSource = {
  finalUrl: string;
  statusCode: number;
  pageTitle: string;
  metaDescription: string;
  headingCount: number;
  linkCount: number;
  buttonCount: number;
  formCount: number;
  imageCount: number;
  colors: string[];
  fonts: string[];
  notes: string[];
  crawl?: CrawlSourceMeta;
  pages?: CrawledPageSummary[];
  customerSignals?: {
    ctaLabels: string[];
    trustSignals: string[];
    highlightWords: string[];
    trustCoverage?: {
      hasContactDetailsRate: number;
      hasTestimonialsRate: number;
      hasFaqRate: number;
      hasPolicyPagesRate: number;
    };
    readability: {
      paragraphCount: number;
      avgParagraphWords: number;
      longParagraphCount?: number;
      avgWordsPerSentence?: number;
    };
    accessibility: {
      altCoverage: number;
      formLabelCoverage: number;
    };
    structure?: {
      headingJumpCount: number;
    };
    forms?: {
      complexForms: number;
    };
  };
};

export type UiStyleReport = {
  summary: string;
  styleTokens: {
    colors: string[];
    fonts: string[];
    components: string[];
    highlightWords: string[];
  };
  implementationSnippets?: ImplementationSnippet[];
  contentClarity: {
    headingCount: number;
    headingExamples: string[];
    avgParagraphWords: number;
    longParagraphCount: number;
  };
  interactionSignals: {
    ctaLabels: string[];
    navLabels: string[];
    buttonLabels: string[];
  };
  prioritizedActions: PrioritizedAction[];
};

export type SecurityTechnicalReport = {
  summary: string;
  postureScore: number;
  transport: {
    httpsCoverage: number;
    redirectedToHttpsCount: number;
    downgradedToHttpCount: number;
    requestedExecutionMode: string;
    executionMode: string;
    modeFallbackUsed: boolean;
  };
  headers: {
    missing: Array<{
      key: string;
      label: string;
      impact: "high" | "medium" | "low";
      pages: number;
    }>;
    weak: Array<{
      key: string;
      label: string;
      issue: string;
      pages: number;
    }>;
    presentCoverage: Array<{
      key: string;
      label: string;
      pages: number;
    }>;
  };
  cookies: {
    totalSetCookie: number;
    secureRate: number;
    httpOnlyRate: number;
    sameSiteRate: number;
    issues: string[];
  };
  linksAndForms: {
    unsafeTargetBlankCount: number;
    insecureLinkCount: number;
    insecureFormActionCount: number;
  };
  scriptSurface?: {
    mixedContentCount: number;
    externalScriptCount: number;
    scriptsWithoutSriCount: number;
    inlineScriptCount: number;
    externalScriptHosts: string[];
  };
  cors?: {
    riskyPageCount: number;
  };
  cachePolicy?: {
    riskyPageCount: number;
  };
  authSurface?: {
    passwordFlowPageCount: number;
    passwordFlowMissingCsrfCount: number;
  };
  hsts?: {
    preloadReadyCount: number;
  };
  crawlDiagnostics: {
    blockedByRobots: number;
    pageErrors: number;
    notes: string[];
  };
  pageHighlights: Array<{
    url: string;
    usesHttps: boolean;
    missingHeaders: string[];
    weakHeaderCount: number;
    unsafeTargetBlank: number;
    insecureLinks: number;
    insecureForms: number;
    mixedContent?: number;
    scriptsWithoutSri?: number;
    corsIssueCount?: number;
  }>;
  recommendations: Array<{
    title: string;
    detail: string;
    impact: "high" | "medium" | "low";
  }>;
};

export type ScanReport = {
  reportVersion?: string;
  siteName: string;
  scannedAt: string;
  scope: string;
  summary: string;
  scores: ReportScore[];
  tokenGroups: ReportTokenGroup[];
  prioritizedActions?: PrioritizedAction[];
  findings: ReportFinding[];
  components: string[];
  interactions: string[];
  executiveSummary?: ExecutiveSummary;
  opportunityMap?: OpportunityMap;
  uiStyle?: UiStyleReport;
  securityTechnical?: SecurityTechnicalReport;
  source: ExtractedPageSource;
};
