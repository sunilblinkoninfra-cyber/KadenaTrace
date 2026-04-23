import type { PublicCaseView, TraceRecord } from "@kadenatrace/shared";

type TraceSubmissionResponse = TraceRecord & {
  traceId: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:4000";

export async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export async function getPublicCases(): Promise<PublicCaseView[] | null> {
  return apiFetch<PublicCaseView[]>("/api/public/cases");
}

export async function getPublicCase(slug: string): Promise<PublicCaseView | null> {
  return apiFetch<PublicCaseView>(`/api/public/cases/${slug}`);
}

export async function fetchCase(slug: string): Promise<PublicCaseView | null> {
  return getPublicCase(slug);
}

export async function getTrace(traceId: string): Promise<TraceRecord | null> {
  return apiFetch<TraceRecord>(`/api/traces/${traceId}`);
}

export async function fetchTrace(payload: unknown): Promise<TraceSubmissionResponse> {
  const url = `${API_BASE_URL}/api/traces`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API error ${res.status}: ${text}`);
    }

    return (await res.json()) as TraceSubmissionResponse;
  } catch (err: unknown) {
    console.error("FetchTrace failed:", { url, err });
    throw err;
  }
}

export async function prepareDisputePayload(
  caseId: string,
  body: { signer: { accountName: string; publicKey: string; adapterName?: string } }
): Promise<unknown> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${base}/api/cases/${encodeURIComponent(caseId)}/disputes/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to prepare dispute payload.");
  }
  return response.json();
}

export async function submitDisputeCommand(
  caseId: string,
  body: {
    disputeId: string;
    signer: { accountName: string; publicKey: string };
    signedCommand: unknown;
  }
): Promise<{ disputeId: string; requestKey: string }> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  const response = await fetch(`${base}/api/cases/${encodeURIComponent(caseId)}/disputes/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Dispute submission failed.");
  }
  return response.json() as Promise<{ disputeId: string; requestKey: string }>;
}
