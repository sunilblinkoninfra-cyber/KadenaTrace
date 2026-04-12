import type { FastifyInstance } from "fastify";

import { ANALYSIS_THRESHOLDS, filterFindingsForGraph, sliceGraph, traceRequestSchema } from "@kadenatrace/shared";

import type { TraceService } from "../services/trace-service.js";

export async function registerTraceRoutes(app: FastifyInstance, traceService: TraceService) {
  app.post(
    "/api/traces",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const parsed = traceRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const trace = await traceService.createTrace(parsed.data);
      return reply.send({ traceId: trace.id, status: trace.status });
    }
  );

  app.get("/api/traces/:traceId", async (request, reply) => {
    const params = request.params as { traceId: string };
    const trace = await traceService.getTrace(params.traceId);
    if (!trace) {
      return reply.code(404).send({ error: "Trace not found." });
    }

    const query = normalizeTraceQuery(request.query);
    if (query.error) {
      return reply.code(400).send({ error: query.error });
    }

    if (!trace.result || (!query.focusNodeId && !query.highRiskOnly)) {
      return reply.send(trace);
    }

    const slicedGraph = sliceGraph(trace.result.graph, {
      focusNodeId: query.focusNodeId,
      depth: query.depth,
      limit: query.limit,
      highRiskOnly: query.highRiskOnly
    });
    const filteredFindings = filterFindingsForGraph(trace.result.findings, slicedGraph);
    const filteredPaths = trace.result.suspiciousPaths.filter((path) =>
      path.edgeIds.some((edgeId) => slicedGraph.edges.some((edge) => edge.id === edgeId))
    );

    return reply.send({
      ...trace,
      result: {
        ...trace.result,
        graph: slicedGraph,
        findings: filteredFindings,
        suspiciousPaths: filteredPaths,
        warnings: [
          ...trace.result.warnings,
          `Partial graph view generated with depth ${query.depth} and limit ${query.limit}.`
        ]
      }
    });
  });

}

function normalizeTraceQuery(input: unknown) {
  const query = (input ?? {}) as Record<string, unknown>;
  const focusNodeId =
    typeof query.focusNodeId === "string" && query.focusNodeId.trim().length >= 3 ? query.focusNodeId : undefined;
  const depth = clampInteger(query.depth, ANALYSIS_THRESHOLDS.partialGraphDefaultDepth, 1, 4);
  const limit = clampInteger(query.limit, ANALYSIS_THRESHOLDS.partialGraphDefaultLimit, 10, 200);
  const highRiskOnly =
    query.highRiskOnly === true ||
    query.highRiskOnly === "true" ||
    query.highRiskOnly === 1 ||
    query.highRiskOnly === "1";

  if (query.focusNodeId && !focusNodeId) {
    return {
      error: "focusNodeId must be at least 3 characters long."
    };
  }

  return {
    focusNodeId,
    depth,
    limit,
    highRiskOnly
  };
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}
