import { randomUUID } from "node:crypto";
import { buildTraceGraph } from "../trace/builder.js";
import { buildRiskAnalysis } from "../trace/explainable-risk.js";
import { computeTraceHash } from "./hashing.js";
export class TraceEngine {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async run(request, traceId = randomUUID()) {
        const result = await buildTraceGraph(this.provider, request);
        const riskAnalysis = buildRiskAnalysis(result.graph, result.suspiciousPaths);
        const traceHash = computeTraceHash(result.graph.edges).traceHash;
        return {
            traceId,
            seed: request,
            graph: result.graph,
            findings: result.findings,
            suspiciousPaths: result.suspiciousPaths,
            metrics: result.metrics,
            riskAnalysis,
            traceHash,
            verifiable: true,
            sources: result.sources,
            generatedAt: new Date().toISOString(),
            warnings: result.warnings,
            pruning: result.pruning
        };
    }
}
