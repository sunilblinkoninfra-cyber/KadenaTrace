import { cache } from "react";

import {
  DEMO_TRACE_REQUEST,
  FixtureActivityProvider,
  TraceEngine,
  type TraceRecord
} from "@kadenatrace/shared";

const DEMO_TRACE_ID = "demo";

export const getDemoTraceRecord = cache(async (): Promise<TraceRecord> => {
  const engine = new TraceEngine(new FixtureActivityProvider());
  const result = await engine.run(DEMO_TRACE_REQUEST, DEMO_TRACE_ID);
  const generatedAt = result.generatedAt;

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
