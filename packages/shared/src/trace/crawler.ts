// crawler.ts -- Derives time-to-exit, fan-out velocity, and hop timeline metrics from traced graph paths.
import type {
  Chain,
  GraphEdge,
  GraphNode,
  TerminalEndpointType,
  TimeToExitPath,
  TraceGraph,
  TraceRequest,
  VelocityMetrics,
  VelocityTimelineEntry
} from "../domain.js";
import { makeNodeId } from "./normalizer.js";

interface PathState {
  nodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  incidentEdgeId: string;
  incidentTxHash: string;
  incidentTimestamp: string;
  visitedNodeIds: Set<string>;
}

const MINUTES_PER_DAY = 24 * 60;

export function calculateVelocityMetrics(graph: TraceGraph, seed: TraceRequest): VelocityMetrics {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const outboundByNode = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const outbound = outboundByNode.get(edge.from) ?? [];
    outbound.push(edge);
    outboundByNode.set(edge.from, outbound);
  }

  for (const edges of outboundByNode.values()) {
    edges.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  const incidentEdges = getIncidentEdges(graph, seed, outboundByNode);
  const terminalPaths = traceTerminalPaths(nodeById, edgeById, outboundByNode, incidentEdges);
  const meanTimeToExitMinutes = terminalPaths.length > 0 ? roundMetric(mean(terminalPaths.map((path) => path.minutesToExit))) : null;
  const fastestTimeToExitMinutes =
    terminalPaths.length > 0 ? roundMetric(Math.min(...terminalPaths.map((path) => path.minutesToExit))) : null;
  const slowestTimeToExitMinutes =
    terminalPaths.length > 0 ? roundMetric(Math.max(...terminalPaths.map((path) => path.minutesToExit))) : null;
  const fanOutBranchAverageMinutes = calculateFanOutAverageMinutes(graph, outboundByNode, terminalPaths);
  const referenceVelocity = fanOutBranchAverageMinutes ?? meanTimeToExitMinutes;
  const criminalEfficiencyScore =
    referenceVelocity === null ? null : clampToRange(100 - Math.round((Math.min(referenceVelocity, MINUTES_PER_DAY) / MINUTES_PER_DAY) * 100), 0, 100);
  const urgency = deriveUrgency(meanTimeToExitMinutes);
  const requiresImmediateExchangeContact = terminalPaths.some(
    (path) => path.terminalType === "cex" && path.minutesToExit <= 30
  );
  const crossChainExitDetected = terminalPaths.some((path) => path.crossChainExit);
  const spvVerificationRequired = terminalPaths.some((path) => path.spvVerificationRequired);
  const timeline = buildVelocityTimeline(graph, nodeById, terminalPaths);

  return {
    incidentTimestamp: incidentEdges[0]?.timestamp ?? null,
    meanTimeToExitMinutes,
    fastestTimeToExitMinutes,
    slowestTimeToExitMinutes,
    fanOutBranchAverageMinutes,
    criminalEfficiencyScore,
    urgencyLabel: urgency.label,
    urgencyRiskLevel: urgency.riskLevel,
    terminalPathCount: terminalPaths.length,
    crossChainExitDetected,
    spvVerificationRequired,
    requiresImmediateExchangeContact,
    recoveryPotential: deriveRecoveryPotential(terminalPaths, requiresImmediateExchangeContact),
    terminalPaths,
    timeline
  };
}

function getIncidentEdges(
  graph: TraceGraph,
  seed: TraceRequest,
  outboundByNode: Map<string, GraphEdge[]>
): GraphEdge[] {
  if (seed.seedType === "tx") {
    return [...graph.edges]
      .filter((edge) => edge.txHash.toLowerCase() === seed.seedValue.toLowerCase())
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  }

  const seedNodeId = makeNodeId(seed.chain, seed.seedValue);
  return [...(outboundByNode.get(seedNodeId) ?? [])].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function traceTerminalPaths(
  nodeById: Map<string, GraphNode>,
  edgeById: Map<string, GraphEdge>,
  outboundByNode: Map<string, GraphEdge[]>,
  incidentEdges: GraphEdge[]
): TimeToExitPath[] {
  const terminalPaths: TimeToExitPath[] = [];
  const queue: PathState[] = [];
  const seenPaths = new Set<string>();

  for (const edge of incidentEdges) {
    queue.push({
      nodeId: edge.to,
      nodeIds: [edge.from, edge.to],
      edgeIds: [edge.id],
      incidentEdgeId: edge.id,
      incidentTxHash: edge.txHash,
      incidentTimestamp: edge.timestamp,
      visitedNodeIds: new Set([edge.from, edge.to])
    });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentNode = nodeById.get(current.nodeId);
    const terminalType = currentNode ? getTerminalEndpointType(currentNode) : null;
    const lastEdgeId = current.edgeIds[current.edgeIds.length - 1];
    const lastEdge = lastEdgeId ? edgeById.get(lastEdgeId) : undefined;

    if (terminalType && lastEdge) {
      const key = `${current.incidentEdgeId}:${current.edgeIds.join(">")}`;
      if (!seenPaths.has(key)) {
        seenPaths.add(key);
        const chainPath = uniqueChains(
          current.edgeIds
            .map((edgeId) => edgeById.get(edgeId))
            .filter((edge): edge is GraphEdge => Boolean(edge))
            .map((edge) => edge.chain)
        );
        terminalPaths.push({
          id: `tte:${terminalPaths.length + 1}`,
          incidentEdgeId: current.incidentEdgeId,
          terminalEdgeId: lastEdge.id,
          incidentTxHash: current.incidentTxHash,
          terminalTxHash: lastEdge.txHash,
          incidentTimestamp: current.incidentTimestamp,
          terminalTimestamp: lastEdge.timestamp,
          minutesToExit: minutesBetween(current.incidentTimestamp, lastEdge.timestamp),
          hopCount: current.edgeIds.length,
          nodeIds: current.nodeIds,
          edgeIds: current.edgeIds,
          chainPath,
          terminalNodeId: current.nodeId,
          terminalLabel: currentNode?.label ?? current.nodeId,
          terminalType,
          crossChainExit: new Set(chainPath).size > 1,
          spvVerificationRequired: new Set(chainPath).size > 1
        });
      }
      continue;
    }

    const outgoing = outboundByNode.get(current.nodeId) ?? [];
    for (const edge of outgoing) {
      if (current.visitedNodeIds.has(edge.to)) {
        continue;
      }

      const nextVisited = new Set(current.visitedNodeIds);
      nextVisited.add(edge.to);
      queue.push({
        nodeId: edge.to,
        nodeIds: [...current.nodeIds, edge.to],
        edgeIds: [...current.edgeIds, edge.id],
        incidentEdgeId: current.incidentEdgeId,
        incidentTxHash: current.incidentTxHash,
        incidentTimestamp: current.incidentTimestamp,
        visitedNodeIds: nextVisited
      });
    }
  }

  return terminalPaths.sort((left, right) => left.minutesToExit - right.minutesToExit);
}

function buildVelocityTimeline(
  graph: TraceGraph,
  nodeById: Map<string, GraphNode>,
  terminalPaths: TimeToExitPath[]
): VelocityTimelineEntry[] {
  const highlightedEdgeIds = terminalPaths.flatMap((path) => path.edgeIds);
  const candidateEdgeIds = highlightedEdgeIds.length > 0 ? Array.from(new Set(highlightedEdgeIds)) : graph.edges.map((edge) => edge.id);
  const edges = candidateEdgeIds
    .map((edgeId) => graph.edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is GraphEdge => Boolean(edge))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  let previousTimestamp: string | null = null;

  return edges.map((edge) => {
    const destinationNode = nodeById.get(edge.to);
    const terminalType = destinationNode ? getTerminalEndpointType(destinationNode) : null;
    const entry: VelocityTimelineEntry = {
      id: `timeline:${edge.id}`,
      edgeId: edge.id,
      fromNodeId: edge.from,
      toNodeId: edge.to,
      fromLabel: nodeById.get(edge.from)?.label ?? edge.from,
      toLabel: destinationNode?.label ?? edge.to,
      chain: edge.chain,
      txHash: edge.txHash,
      asset: edge.asset,
      amount: edge.amount,
      timestamp: edge.timestamp,
      gapMinutesFromPrevious: previousTimestamp ? minutesBetween(previousTimestamp, edge.timestamp) : null,
      terminalType: terminalType ?? undefined
    };

    previousTimestamp = edge.timestamp;
    return entry;
  });
}

function calculateFanOutAverageMinutes(
  graph: TraceGraph,
  outboundByNode: Map<string, GraphEdge[]>,
  terminalPaths: TimeToExitPath[]
): number | null {
  const fanOutRoots = new Set<string>();

  for (const node of graph.nodes) {
    const outgoing = outboundByNode.get(node.id) ?? [];
    const uniqueRecipients = new Set(outgoing.map((edge) => edge.to));
    if (uniqueRecipients.size > 3) {
      fanOutRoots.add(node.id);
    }
  }

  if (fanOutRoots.size === 0) {
    return null;
  }

  const matchingPaths = terminalPaths.filter((path) => path.nodeIds.some((nodeId) => fanOutRoots.has(nodeId)));
  if (matchingPaths.length === 0) {
    return null;
  }

  return roundMetric(mean(matchingPaths.map((path) => path.minutesToExit)));
}

function deriveUrgency(meanTimeToExitMinutes: number | null): { label: string; riskLevel: VelocityMetrics["urgencyRiskLevel"] } {
  if (meanTimeToExitMinutes === null) {
    return {
      label: "Awaiting terminal endpoint",
      riskLevel: "low"
    };
  }

  if (meanTimeToExitMinutes < 60) {
    return {
      label: "Professional/Automated",
      riskLevel: "critical"
    };
  }

  if (meanTimeToExitMinutes > MINUTES_PER_DAY) {
    return {
      label: "Manual/Staged",
      riskLevel: "medium"
    };
  }

  return {
    label: "Active Laundering Window",
    riskLevel: "high"
  };
}

function deriveRecoveryPotential(terminalPaths: TimeToExitPath[], requiresImmediateExchangeContact: boolean): string {
  if (requiresImmediateExchangeContact) {
    return "High-speed exit detected. Immediate exchange contact required.";
  }

  const exchangePath = terminalPaths.find((path) => path.terminalType === "cex");
  if (exchangePath) {
    return "Exchange endpoint identified. Preserve evidence and submit the public case URL to the exchange response team.";
  }

  const bridgePath = terminalPaths.find((path) => path.terminalType === "bridge");
  if (bridgePath) {
    return "Bridge exit identified. Prepare cross-chain evidence and verify terminal block-times against the destination-chain SPV proof before anchoring.";
  }

  return "No centralized cash-out endpoint identified yet. Continue monitoring follow-on branches.";
}

function getTerminalEndpointType(node: GraphNode): TerminalEndpointType | null {
  if (node.kind === "exchange" || node.tags.includes("exchange")) {
    return "cex";
  }

  if (node.kind === "bridge" || node.tags.includes("bridge")) {
    return "bridge";
  }

  if (node.tags.includes("burn") || node.address === "k:null" || /^0x0{40}$/i.test(node.address)) {
    return "burn";
  }

  if (node.tags.includes("dex-lp") || node.tags.includes("liquidity-pool") || node.tags.includes("lp")) {
    return "dex-lp";
  }

  if (node.terminal && node.kind !== "mixer") {
    return "terminal";
  }

  return null;
}

function uniqueChains(chains: Chain[]): Chain[] {
  return Array.from(new Set(chains));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function minutesBetween(fromTimestamp: string, toTimestamp: string): number {
  const from = new Date(fromTimestamp).getTime();
  const to = new Date(toTimestamp).getTime();
  return roundMetric(Math.max(0, (to - from) / 60000));
}

function roundMetric(value: number): number {
  return Number(value.toFixed(2));
}

function clampToRange(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
