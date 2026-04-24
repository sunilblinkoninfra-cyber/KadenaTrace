import type { FastifyInstance } from "fastify";

import {
  ANALYSIS_THRESHOLDS,
  buildErrorResponse,
  Errors,
  filterFindingsForGraph,
  sliceGraph,
  traceRequestSchema,
  type TraceRecord
} from "@kadenatrace/shared";

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
        const error = Errors.validationError(
          "body",
          "Invalid request body",
          parsed.error.flatten()
        );
        const { statusCode, body } = buildErrorResponse(error);
        return reply.code(statusCode).send(body);
      }

try {
        const trace = await traceService.createTrace(parsed.data);
        return reply.send({
          traceId: trace.id,
          id: trace.id,
          createdAt: trace.createdAt,
          updatedAt: trace.updatedAt,
          status: trace.status,
          request: trace.request,
          result: trace.result ?? undefined,
          error: trace.error ?? undefined
        });
      } catch (error) {
        request.log.error(error);
        const { statusCode, body } = buildErrorResponse(error);
        return reply.code(statusCode).send(body);
      }
    }
  );

  app.get("/api/traces/:traceId", async (request, reply) => {
    const params = request.params as { traceId: string };

    if (!params.traceId || params.traceId.length < 3) {
      const error = Errors.validationError(
        "traceId",
        "Trace ID must be at least 3 characters",
        params.traceId
      );
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }

    try {
      const trace = await traceService.getTrace(params.traceId);
      if (!trace) {
        const error = Errors.traceNotFound(params.traceId);
        const { statusCode, body } = buildErrorResponse(error);
        return reply.code(statusCode).send(body);
      }

      const query = normalizeTraceQuery(request.query);
      if (query.error) {
        const error = Errors.validationError("query", query.error);
        const { statusCode, body } = buildErrorResponse(error);
        return reply.code(statusCode).send(body);
      }

      if (!trace.result || (!query.focusNodeId && !query.highRiskOnly)) {
        return reply.send(toApiTraceResponse(trace));
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

      return reply.send(toApiTraceResponse({
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
      }));
    } catch (error) {
      request.log.error(error);
      const { statusCode, body } = buildErrorResponse(error);
      return reply.code(statusCode).send(body);
    }
  });
}

function toApiTraceResponse(trace: TraceRecord) {
  return {
    ...trace,
    trace: trace.result
      ? {
          graph: trace.result.graph,
          findings: trace.result.findings,
          suspiciousPaths: trace.result.suspiciousPaths,
          metrics: trace.result.metrics,
          sources: trace.result.sources,
          warnings: trace.result.warnings,
          generatedAt: trace.result.generatedAt
        }
      : null,
    riskAnalysis: trace.result?.riskAnalysis ?? null,
    traceHash: trace.result?.traceHash ?? null,
    verifiable: Boolean(trace.result?.traceHash)
  };
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
