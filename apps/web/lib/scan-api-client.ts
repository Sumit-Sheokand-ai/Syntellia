import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type { ScanRecord, CreateScanInput } from "@/lib/scan-types";

function getBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!url) throw new Error("NEXT_PUBLIC_BACKEND_URL is not configured.");
  return url.replace(/\/$/, "");
}

async function getAuthToken(): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in.");
  return session.access_token;
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((body.error as string | undefined) ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function createScanViaApi(input: CreateScanInput): Promise<ScanRecord> {
  return apiRequest<ScanRecord>("/api/scans", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function getScanViaApi(scanId: string): Promise<ScanRecord> {
  return apiRequest<ScanRecord>(`/api/scans/${scanId}`);
}

export async function listScansViaApi(): Promise<ScanRecord[]> {
  const response = await apiRequest<{ scans: ScanRecord[] }>("/api/scans");
  return response.scans;
}
