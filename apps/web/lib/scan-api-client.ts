import { createBrowserSupabaseClient } from "@/lib/supabase-browser";
import type {
  CreateScanInput,
  EntitlementSummary,
  ScanListPage,
  ScanRecord,
  SharedScanRecord
} from "@/lib/scan-types";

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

async function getOptionalAuthToken(): Promise<string | null> {
  try {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function parseErrorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return (body.error as string | undefined) ?? `Request failed: ${response.status}`;
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
    throw new Error(await parseErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function publicApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
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
type ListScansOptions = {
  status?: "All" | "Queued" | "Running" | "Completed" | "Failed";
  pageSize?: number;
  cursor?: string | null;
};

function buildListScansQuery(options: ListScansOptions = {}) {
  const params = new URLSearchParams();
  if (options.status && options.status !== "All") params.set("status", options.status);
  if (options.pageSize && Number.isFinite(options.pageSize)) params.set("pageSize", String(options.pageSize));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function listScansViaApi(options: ListScansOptions = {}): Promise<ScanListPage> {
  return apiRequest<ScanListPage>(`/api/scans${buildListScansQuery(options)}`);
}

export async function createShareLinkViaApi(scanId: string): Promise<{ shareToken: string; sharePath: string; expiresAt?: string | null }> {
  return apiRequest<{ shareToken: string; sharePath: string; expiresAt?: string | null }>(`/api/scans/${scanId}/share-link`, {
    method: "POST"
  });
}

export async function revokeShareLinkViaApi(scanId: string): Promise<void> {
  await apiRequest<void>(`/api/scans/${scanId}/share-link/revoke`, {
    method: "POST"
  });
}

export async function getSharedScanViaApi(shareToken: string): Promise<SharedScanRecord> {
  const encoded = encodeURIComponent(shareToken);
  const response = await publicApiRequest<{ scan: SharedScanRecord }>(`/api/shared/${encoded}`);
  return response.scan;
}

export async function getEntitlementSummaryViaApi(): Promise<EntitlementSummary> {
  const response = await apiRequest<{ entitlement: EntitlementSummary }>("/api/billing/entitlements");
  return response.entitlement;
}

export async function trackAnalyticsEvent(
  name: string,
  props: Record<string, unknown> = {}
): Promise<void> {
  const eventName = name.trim();
  if (!eventName) return;

  try {
    const token = await getOptionalAuthToken();
    const response = await fetch(`${getBackendUrl()}/api/analytics/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ name: eventName, props }),
      cache: "no-store"
    });

    if (!response.ok) {
      await parseErrorMessage(response);
    }
  } catch {
    // best-effort analytics should not affect UX
  }
}
