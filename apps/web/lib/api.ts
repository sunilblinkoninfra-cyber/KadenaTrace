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

interface FetchJsonOptions {
  retries?: number;
  delayMs?: number;
  cache?: RequestCache;
}

interface ApiErrorPayload {
  message?: string;
}

class ApiRequestError extends Error {
  constructor(message: string, readonly retriable: boolean) {
    super(message);
    this.name = "ApiRequestError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const DEFAULT_RETRIES = 3;
const DEFAULT_DELAY_MS = 700;
const ENGINE_UNAVAILABLE_MESSAGE =
  "Tracing engine temporarily unavailable. Please retry or use the demo case.";

export async function apiFetch<T>(path: string): Promise<T | null> {
  if (!API_BASE_URL) {
    console.warn("KadenaTrace API URL is not configured. Set NEXT_PUBLIC_API_URL to enable live tracing.");
    return null;
  }

  const url = `${API_BASE_URL}${path}`;

  try {
    return await fetchJson<T>(url, { method: "GET" }, { cache: "no-store" });
  } catch (error) {
    console.error("apiFetch failed", { url, error });
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

  const items = Array.isArray(response) ? response : response.items;
  const validated = items.filter(isPublicCaseView);
  if (validated.length === items.length) {
    return validated;
  }
  return validated.length > 0 ? validated : null;
}

export async function getPublicCase(slug: string): Promise<PublicCaseView | null> {
  const response = await apiFetch<unknown>(`/api/public/cases/${slug}`);
  return isPublicCaseView(response) ? response : null;
}

export async function fetchCase(slug: string): Promise<PublicCaseView | null> {
  return getPublicCase(slug);
}

export async function getTrace(traceId: string): Promise<TraceRecord | null> {
  const response = await apiFetch<unknown>(`/api/traces/${traceId}`);
  return isTraceRecord(response) ? response : null;
}

export async function fetchTrace(payload: unknown): Promise<TraceSubmissionResponse> {
  if (!API_BASE_URL) {
    console.error("fetchTrace aborted: NEXT_PUBLIC_API_URL is not configured.");
    throw new Error(ENGINE_UNAVAILABLE_MESSAGE);
  }

  const url = `${API_BASE_URL}/api/traces`;

  try {
    const result = await fetchJson<TraceSubmissionResponse>(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      },
      { retries: DEFAULT_RETRIES, delayMs: DEFAULT_DELAY_MS, cache: "no-store" }
    );

    if (!isTraceSubmissionResponse(result)) {
      console.error("fetchTrace received an invalid response payload", { url, result });
      throw new Error("Tracing engine returned an invalid response. Please retry.");
    }

    return result;
  } catch (error) {
    console.error("fetchTrace failed", { url, error });
    throw error;
  }
}

export async function prepareDisputePayload(
  caseId: string,
  body: DisputePayloadRequest
): Promise<PreparedDisputePayloadResponse> {
  if (!API_BASE_URL) {
    throw new Error(ENGINE_UNAVAILABLE_MESSAGE);
  }

  const response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/disputes/payload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as ApiErrorPayload).message ?? "Failed to prepare dispute payload.");
  }
  return (await response.json()) as PreparedDisputePayloadResponse;
}

export async function submitDisputeCommand(
  caseId: string,
  body: DisputeSubmitRequest
): Promise<DisputeSubmitResponse> {
  if (!API_BASE_URL) {
    throw new Error(ENGINE_UNAVAILABLE_MESSAGE);
  }

  const response = await fetch(`${API_BASE_URL}/api/cases/${encodeURIComponent(caseId)}/disputes/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as ApiErrorPayload).message ?? "Dispute submission failed.");
  }
  return (await response.json()) as DisputeSubmitResponse;
}

async function fetchJson<T>(
  url: string,
  init: RequestInit,
  options: FetchJsonOptions = {}
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        cache: options.cache ?? "no-store"
      });

      if (!response.ok) {
        if (shouldRetryStatus(response.status) && attempt < retries) {
          console.warn("Retrying failed API request", { url, status: response.status, attempt });
          await delay(delayMs * attempt);
          continue;
        }

        const bodyText = await response.text();
        let payload: ApiErrorPayload | undefined;
        try {
          payload = bodyText ? (JSON.parse(bodyText) as ApiErrorPayload) : undefined;
        } catch {
          payload = undefined;
        }

        const message =
          response.status >= 500 || response.status === 429
            ? ENGINE_UNAVAILABLE_MESSAGE
            : (payload?.message ?? bodyText ?? `API error ${response.status}`);
        throw new ApiRequestError(message, shouldRetryStatus(response.status));
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiRequestError && !error.retriable) {
        throw error;
      }

      if (attempt >= retries) {
        throw error instanceof Error ? error : new Error(ENGINE_UNAVAILABLE_MESSAGE);
      }

      console.warn("Retrying API request after network failure", { url, attempt, error });
      await delay(delayMs * attempt);
    }
  }

  throw new Error(ENGINE_UNAVAILABLE_MESSAGE);
}

function shouldRetryStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTraceSubmissionResponse(value: unknown): value is TraceSubmissionResponse {
  return isTraceRecord(value) && typeof (value as { traceId?: unknown }).traceId === "string";
}

function isTraceRecord(value: unknown): value is TraceRecord {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<TraceRecord>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.status === "string" &&
    Boolean(candidate.request) &&
    typeof candidate.request?.seedType === "string" &&
    typeof candidate.request?.seedValue === "string"
  );
}

function isPublicCaseView(value: unknown): value is PublicCaseView {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PublicCaseView>;
  return (
    typeof candidate.caseId === "string" &&
    typeof candidate.slug === "string" &&
    typeof candidate.title === "string" &&
    Boolean(candidate.seed) &&
    typeof candidate.seed?.seedType === "string" &&
    Boolean(candidate.trace) &&
    Array.isArray(candidate.trace?.graph?.nodes) &&
    Array.isArray(candidate.trace?.graph?.edges)
  );
}
