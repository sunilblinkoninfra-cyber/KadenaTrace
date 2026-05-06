import type { TraceGraph, Finding, SuspiciousPath, GraphNode, GraphEdge } from "@kadenatrace/shared/client";
import type { TraceSubmissionResponse } from "./api";

export interface AdaptedTraceData {
  traceId: string;
  graph: TraceGraph;
  findings: Finding[];
  suspiciousPaths: SuspiciousPath[];
}

export function adaptTraceData(raw: TraceSubmissionResponse): AdaptedTraceData {
  const result = raw.result;
  
  if (!result) {
    return {
      traceId: raw.traceId || raw.id,
      graph: { nodes: [], edges: [] },
      findings: [],
      suspiciousPaths: []
    };
  }

  // 1. Normalize graph nodes
  const nodes = result.graph.nodes.map((node: GraphNode) => ({
    ...node,
    riskScore: node.riskScore ?? 0,
    riskConfidence: node.riskConfidence ?? 0,
    riskLevel: node.riskLevel || "low",
    riskSignals: node.riskSignals || [],
  }));

  // 2. Normalize graph edges
  const edges = result.graph.edges.map((edge: GraphEdge) => ({
    ...edge,
    riskScore: edge.riskScore ?? 0,
    timestamp: edge.timestamp ? new Date(edge.timestamp).toISOString() : new Date().toISOString(),
    amount: edge.amount ?? 0,
  }));

  // 3. Normalize findings
  const findings = (result.findings || []).map((finding: Finding) => ({
    ...finding
  }));

  // 4. Normalize suspicious paths
  const suspiciousPaths = (result.suspiciousPaths || []).map((path: SuspiciousPath) => ({
    ...path,
    riskScore: path.riskScore ?? 0,
    edgeIds: path.edgeIds || [],
    nodeIds: path.nodeIds || [],
  }));

  return {
    traceId: raw.traceId || raw.id,
    graph: {
      nodes,
      edges
    },
    findings,
    suspiciousPaths
  };
}
