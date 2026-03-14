export type CreateScanInput = {
  url: string;
  scanSize: string;
  loginMode: string;
  focusArea: string;
  scanPreset?: string;
  projectName?: string;
};

export type ScanStatus = "Queued" | "Running" | "Completed" | "Failed";

export type ScanRecord = {
  id: string;
  userId: string;
  siteName: string;
  url: string;
  scanSize: string;
  loginMode: string;
  focusArea: string;
  projectName: string;
  pageLimit: number;
  status: ScanStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  shareToken?: string;
  shareTokenExpiresAt?: string;
  shareRevokedAt?: string;
  report: import("@/lib/report-schema").ScanReport | null;
};
export type SharedScanRecord = Omit<ScanRecord, "userId">;

export type ScanListPage = {
  scans: ScanRecord[];
  nextCursor: string | null;
};

export type EntitlementSummary = {
  planName: string;
  monthlyScanLimit: number;
  monthlyScansUsed: number;
  remainingScans: number;
  periodStart: string;
};
