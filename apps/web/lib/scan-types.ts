export type CreateScanInput = {
  url: string;
  scanSize: string;
  loginMode: string;
  focusArea: string;
};

export type ScanStatus = "Queued" | "Running" | "Completed" | "Failed";

export type ScanRecord = {
  id: string;
  siteName: string;
  url: string;
  scanSize: string;
  loginMode: string;
  focusArea: string;
  pageLimit: number;
  status: ScanStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  report: import("@/lib/report-schema").ScanReport | null;
};