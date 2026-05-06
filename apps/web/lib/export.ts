// export.ts -- Serialises trace graph data into downloadable JSON and CSV payloads.
import type { Finding, GraphEdge, GraphNode, TraceMetrics } from "@kadenatrace/shared/client";

export function serializeGraphExportJson(input: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings: Finding[];
  metrics: TraceMetrics;
}): string {
  return JSON.stringify(
    {
      nodes: input.nodes,
      edges: input.edges,
      findings: input.findings,
      metrics: input.metrics
    },
    null,
    2
  );
}

export function serializeNodesCsv(nodes: GraphNode[]): string {
  return serializeCsv(
    ["id", "address", "label", "kind", "riskLevel", "riskScore", "riskConfidence", "valueFromSeedPct", "tags"],
    nodes.map((node) => [
      node.id,
      node.address,
      node.label,
      node.kind,
      node.riskLevel,
      node.riskScore,
      node.riskConfidence,
      node.valueFromSeedPct,
      node.tags.join(";")
    ])
  );
}

export function serializeEdgesCsv(edges: GraphEdge[]): string {
  return serializeCsv(
    ["id", "from", "to", "txHash", "asset", "amount", "timestamp", "riskScore", "flags"],
    edges.map((edge) => [
      edge.id,
      edge.from,
      edge.to,
      edge.txHash,
      edge.asset,
      edge.amount,
      edge.timestamp,
      edge.riskScore,
      edge.flags.join(";")
    ])
  );
}

function serializeCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}

function escapeCsvValue(value: string | number): string {
  const normalized = String(value);
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}
