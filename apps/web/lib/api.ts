import type { PublicCaseView, TraceRecord } from "@kadenatrace/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://kadenatrace-api.onrender.com";

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

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getPublicCases() {
  return apiFetch<PublicCaseView[]>("/api/public/cases");
}

export async function getPublicCase(slug: string) {
  return apiFetch<PublicCaseView>(`/api/public/cases/${slug}`);
}

export async function fetchCase(slug: string) {
  return getPublicCase(slug);
}

export async function getTrace(traceId: string) {
  return apiFetch<TraceRecord>(`/api/traces/${traceId}`);
}

export async function fetchTrace(payload: any) {
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

    return await res.json();
  } catch (err: any) {
    console.error("FetchTrace failed:", { url, err });
    throw err;
  }
}
