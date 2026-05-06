import { cache } from "react";

import { DEMO_TRACE_REQUEST, type TraceRecord } from "@kadenatrace/shared/client";
import demoData from "./demo-data.json";

const DEMO_TRACE_ID = "demo";

export const getDemoTraceRecord = cache(async (): Promise<TraceRecord> => {
  const result = demoData as any;
  const generatedAt = result.generatedAt || new Date().toISOString();

  return {
    id: DEMO_TRACE_ID,
    request: DEMO_TRACE_REQUEST,
    status: "completed",
    result,
    createdAt: generatedAt,
    updatedAt: generatedAt
  };
});

export function isDemoTraceId(traceId: string): boolean {
  return traceId === DEMO_TRACE_ID;
}
