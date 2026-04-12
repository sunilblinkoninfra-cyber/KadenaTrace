import { type ReactElement } from "react";

import type { TraceGraph, TraceMetrics, TraceRequest } from "@kadenatrace/shared";
import { makeNodeId } from "@kadenatrace/shared";

export function SummaryCards({
  metrics,
  graph,
  seed
}: {
  metrics: TraceMetrics;
  graph: TraceGraph;
  seed: TraceRequest;
}): ReactElement {
  const hopsToMixer = getHopsToMixer(graph, seed);
  const bridgeCrossings = graph.edges.filter((edge) => edge.flags.includes("bridge")).length;

  return (
    <section className="summary-cards">
      <article className="summary-card">
        <span className="muted">Nodes</span>
        <strong>{metrics.totalNodes}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Edges</span>
        <strong>{metrics.totalEdges}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Chains</span>
        <strong>{metrics.chainsInvolved.join(", ")}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Value to exchanges</span>
        <strong>{metrics.tracedValueToExchanges}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Suspicious paths</span>
        <strong>{metrics.suspiciousPathCount}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Pruned nodes</span>
        <strong>{metrics.prunedNodes}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Hops to mixer</span>
        <strong>{hopsToMixer ?? "N/A"}</strong>
      </article>
      <article className="summary-card">
        <span className="muted">Bridge crossings</span>
        <strong>{bridgeCrossings}</strong>
      </article>
    </section>
  );
}

function getHopsToMixer(graph: TraceGraph, seed: TraceRequest): number | null {
  const mixerNodeIds = new Set(
    graph.nodes.filter((node) => node.kind === "mixer" || node.tags.includes("mixer")).map((node) => node.id)
  );
  if (mixerNodeIds.size === 0) {
    return null;
  }

  const seedNodeIds =
    seed.seedType === "address"
      ? [makeNodeId(seed.chain, seed.seedValue)]
      : Array.from(
          new Set(
            graph.edges
              .filter((edge) => edge.txHash.toLowerCase() === seed.seedValue.toLowerCase())
              .map((edge) => edge.from)
          )
        );

  if (seedNodeIds.length === 0) {
    return null;
  }

  const outboundByNode = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    const outbound = outboundByNode.get(edge.from) ?? [];
    outbound.push(edge.to);
    outboundByNode.set(edge.from, outbound);
  });

  const visited = new Set<string>(seedNodeIds);
  const queue = seedNodeIds.map((nodeId) => ({ nodeId, depth: 0 }));

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    if (mixerNodeIds.has(current.nodeId)) {
      return current.depth;
    }

    (outboundByNode.get(current.nodeId) ?? []).forEach((nextNodeId) => {
      if (visited.has(nextNodeId)) {
        return;
      }
      visited.add(nextNodeId);
      queue.push({ nodeId: nextNodeId, depth: current.depth + 1 });
    });
  }

  return null;
}
