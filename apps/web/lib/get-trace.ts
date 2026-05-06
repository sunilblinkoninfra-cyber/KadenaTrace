import { fetchTrace, type TraceSubmissionResponse } from "./api";
import { getDemoTraceRecord } from "./demo-trace";

// In-memory cache to prevent duplicate API calls for the same trace
const traceCache = new Map<string, TraceSubmissionResponse>();

export async function getTrace(input: string) {
  if (traceCache.has(input)) {
    return { data: traceCache.get(input)!, isDemo: false };
  }

  try {
    const payload = {
      chain: "ethereum",
      seedType: "address",
      seedValue: input.trim()
    };
    const data = await fetchTrace(payload);
    
    // Store in cache
    traceCache.set(input, data);
    
    return { data, isDemo: false };
  } catch (err) {
    console.error("fetchTrace failed, falling back to demo:", err);
    // Add artificial delay to make the fallback feel natural
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const demoData = await getDemoTraceRecord();
    const mockResponse: TraceSubmissionResponse = {
      ...demoData,
      traceId: demoData.id,
    };
    
    return { data: mockResponse, isDemo: true };
  }
}
