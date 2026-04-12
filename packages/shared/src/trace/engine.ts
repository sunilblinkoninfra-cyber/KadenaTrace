import { randomUUID } from "node:crypto";
import type { ActivityProvider, TraceRequest, TraceResult } from "../domain.js";
import { buildTraceGraph } from "./builder.js";

export class TraceEngine {
  constructor(private readonly provider: ActivityProvider) {}

  async run(request: TraceRequest, traceId: string = randomUUID()): Promise<TraceResult> {
    const result = await buildTraceGraph(this.provider, request);

    return {
      traceId,
      seed: request,
      graph: result.graph,
      findings: result.findings,
      suspiciousPaths: result.suspiciousPaths,
      metrics: result.metrics,
      sources: result.sources,
      generatedAt: new Date().toISOString(),
      warnings: result.warnings,
      pruning: result.pruning
    };
  }
}
