import type { PublicCaseView, TraceRecord } from "@kadenatrace/shared";

type TraceSubmissionResponse = TraceRecord & {
  traceId: string;
};

type PublicCaseListResponse =
  | PublicCaseView[]
  | {
      items: PublicCaseView[];
      nextCursor?: string;
      hasMore: boolean;
    };

interface DisputePayloadRequest {
  reasonHash: string;
  signer: {
    accountName: string;
    publicKey: string;
    adapterName?: string;
  };
}

interface PreparedDisputePayloadResponse {
  disputeId: string;
  unsignedCommand: unknown;
  txPreview: string;
}

interface DisputeSubmitRequest {
  disputeId: string;
  signer: {
    accountName: string;
    publicKey: string;
  };
  signedCommand: unknown;
}

interface DisputeSubmitResponse {
  disputeId: string;
  requestKey?: string;
}

const DEFAULT_PRODUCTION_API_BASE_URL = "https://kadenatrace-api.onrender.com";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:4000" : DEFAULT_PRODUCTION_API_BASE_URL);

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
  const response = await apiFetch<PublicCaseListResponse>("/api/public/cases");
  if (!response) {
    return null;
  }

  return Array.isArray(response) ? response : response.items;
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
  body: DisputePayloadRequest
): Promise<PreparedDisputePayloadResponse> {
  const response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/disputes/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Failed to prepare dispute payload.");
  }
  return (await response.json()) as PreparedDisputePayloadResponse;
}

export async function submitDisputeCommand(
  caseId: string,
  body: DisputeSubmitRequest
): Promise<DisputeSubmitResponse> {
  const response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/disputes/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Dispute submission failed.");
  }
  return (await response.json()) as DisputeSubmitResponse;
}
