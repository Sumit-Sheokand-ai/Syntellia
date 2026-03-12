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
};

export type ScanReport = {
  siteName: string;
  scannedAt: string;
  scope: string;
  summary: string;
  scores: ReportScore[];
  tokenGroups: ReportTokenGroup[];
  findings: ReportFinding[];
  components: string[];
  interactions: string[];
  source: ExtractedPageSource;
};
