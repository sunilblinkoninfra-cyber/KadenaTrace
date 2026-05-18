import { type ReactElement } from "react";
import { motion } from "framer-motion";

import type { TraceGraph, TraceMetrics, TraceRequest } from "@kadenatrace/shared/client";

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
  const meanTimeToExit = metrics.velocity.meanTimeToExitMinutes;
  const efficiencyScore = metrics.velocity.criminalEfficiencyScore;

  const cardItems = [
    { label: "Graph Nodes", value: metrics.totalNodes },
    { label: "Graph Edges", value: metrics.totalEdges },
    { label: "Chains Involved", value: metrics.chainsInvolved.join(", ") },
    { label: "Value to Exchanges", value: metrics.tracedValueToExchanges },
    { label: "Suspicious Paths", value: metrics.suspiciousPathCount },
    { label: "Pruned Nodes", value: metrics.prunedNodes },
    { label: "Hops to Mixer", value: hopsToMixer ?? "N/A" },
    { label: "Bridge Crossings", value: bridgeCrossings },
    { label: "Mean Time to Exit", value: meanTimeToExit === null ? "Open" : formatMinutes(meanTimeToExit) },
    { label: "Efficiency Score", value: efficiencyScore === null ? "N/A" : `${efficiencyScore}/100` }
  ];

  return (
    <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cardItems.map((item, idx) => (
        <motion.article
          key={item.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: idx * 0.04 }}
          whileHover={{ y: -3, borderColor: "rgba(14, 165, 233, 0.4)", boxShadow: "0 10px 25px -5px rgba(14, 165, 233, 0.08)" }}
          className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/95 to-slate-50/50 p-4 shadow-sm hover:bg-white transition-colors group cursor-default"
        >
          {/* Decorative glowing gradient sphere inside the card */}
          <div className="absolute -right-6 -bottom-6 h-16 w-16 rounded-full bg-sky-400/5 blur-xl group-hover:bg-sky-400/12 transition-all duration-300" />
          
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
            {item.label}
          </span>
          <strong className="block mt-2.5 font-display text-2xl font-black text-slate-800 tracking-tight break-all">
            {item.value}
          </strong>
        </motion.article>
      ))}
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
      ? [buildNodeId(seed.chain, seed.seedValue)]
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

function formatMinutes(value: number): string {
  if (value < 60) {
    return `${value.toFixed(0)} min`;
  }

  if (value < 24 * 60) {
    return `${(value / 60).toFixed(value < 120 ? 1 : 0)} hr`;
  }

  return `${(value / (24 * 60)).toFixed(1)} d`;
}

function buildNodeId(chain: TraceRequest["chain"], address: string): string {
  return `${chain}:${address.toLowerCase()}`;
}
