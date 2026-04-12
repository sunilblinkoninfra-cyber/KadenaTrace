import { ANALYSIS_THRESHOLDS } from "../config.js";
import type {
  EdgeFlag,
  Finding,
  GraphEdge,
  GraphNode,
  PruningSummary,
  RiskSignal,
  ScoredFinding,
  SuspiciousPath,
  TraceGraph,
  TraceRequest
} from "../domain.js";
import { makeNodeId, normalizeAddress } from "./normalizer.js";

interface GraphMaps {
  inboundByNode: Map<string, GraphEdge[]>;
  outboundByNode: Map<string, GraphEdge[]>;
  nodeById: Map<string, GraphNode>;
}

interface SliceGraphOptions {
  focusNodeId?: string;
  depth: number;
  limit: number;
  highRiskOnly?: boolean;
}

export function annotateGraph(graph: TraceGraph, request: TraceRequest): { seedNodeIds: string[] } {
  const maps = buildGraphMaps(graph);
  const seedNodeIds = getSeedNodeIds(graph, request);
  const seedOutgoingTotal = getSeedOutgoingTotal(graph, seedNodeIds);
  const dustThreshold = Math.max(
    ANALYSIS_THRESHOLDS.dustAbsoluteAmount,
    Number((seedOutgoingTotal * ANALYSIS_THRESHOLDS.dustShareOfSeed).toFixed(6))
  );

  labelBridgeTouchpoints(graph, maps);
  labelBehavioralRouters(graph, maps);
  labelBehavioralExchanges(graph, maps, dustThreshold);
  labelMultisigCandidates(graph, maps);
  applyDustFilter(graph, dustThreshold);
  applyAirdropFilter(graph, maps, Math.max(dustThreshold, seedOutgoingTotal * ANALYSIS_THRESHOLDS.airdropAmountShareOfSeed));

  return { seedNodeIds };
}

export function applyRiskAdjustments(graph: TraceGraph, scored: ScoredFinding) {
  for (const node of graph.nodes) {
    const adjustment = scored.nodeAdjustments.get(node.id);
    if (!adjustment) {
      continue;
    }

    node.riskScore = Math.min(100, adjustment.score);
    node.riskConfidence = roundMetric(adjustment.confidence);
    node.reasons = adjustment.reasons;
    node.riskSignals = adjustment.signals;
  }

  for (const edge of graph.edges) {
    const adjustment = scored.edgeAdjustments.get(edge.id);
    if (!adjustment) {
      continue;
    }

    edge.riskScore = Math.min(100, adjustment.score);
    edge.riskConfidence = roundMetric(adjustment.confidence);
    edge.reasons = adjustment.reasons;
    edge.riskSignals = adjustment.signals;
    edge.flags = uniqueList([...edge.flags, ...adjustment.flags]);
  }
}

export function propagateValueFlow(graph: TraceGraph, seedNodeIds: string[]) {
  const maps = buildGraphMaps(graph);
  const sortedEdges = [...graph.edges].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const remainingFlowByNode = new Map<string, number>();
  const receivedFlowByNode = new Map<string, number>();
  const remainingAmountByEdge = new Map<string, number>();

  for (const seedNodeId of seedNodeIds) {
    remainingFlowByNode.set(seedNodeId, 100);
    receivedFlowByNode.set(seedNodeId, 100);
  }

  for (const [nodeId, edges] of maps.outboundByNode) {
    const ordered = [...edges].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    let running = 0;
    const amounts = ordered.map((edge) => getEffectiveEdgeAmount(edge));
    for (let index = amounts.length - 1; index >= 0; index -= 1) {
      running += amounts[index] ?? 0;
      const edge = ordered[index];
      if (edge) {
        remainingAmountByEdge.set(edge.id, running);
      }
    }
    if (!remainingFlowByNode.has(nodeId)) {
      remainingFlowByNode.set(nodeId, 0);
    }
  }

  for (const edge of sortedEdges) {
    const availableFlow = remainingFlowByNode.get(edge.from) ?? 0;
    const remainingAmount = remainingAmountByEdge.get(edge.id) ?? 0;
    const effectiveAmount = getEffectiveEdgeAmount(edge);
    if (availableFlow <= 0 || remainingAmount <= 0 || effectiveAmount <= 0) {
      continue;
    }

    const propagatedPct = Math.min(availableFlow, (availableFlow * effectiveAmount) / remainingAmount);
    edge.valueFromSeedPct = roundMetric(propagatedPct);
    edge.propagatedAmount = Number(((edge.amount * propagatedPct) / 100).toFixed(6));

    remainingFlowByNode.set(edge.from, Math.max(0, availableFlow - propagatedPct));
    const destinationFlow = Math.min(100, (remainingFlowByNode.get(edge.to) ?? 0) + propagatedPct);
    remainingFlowByNode.set(edge.to, destinationFlow);
    receivedFlowByNode.set(edge.to, Math.min(100, (receivedFlowByNode.get(edge.to) ?? 0) + propagatedPct));
  }

  for (const node of graph.nodes) {
    node.valueFromSeedPct = roundMetric(receivedFlowByNode.get(node.id) ?? (seedNodeIds.includes(node.id) ? 100 : 0));
  }
}

export function extractSuspiciousPaths(
  graph: TraceGraph,
  findings: Finding[],
  seedNodeIds: string[],
  maxPaths: number
): SuspiciousPath[] {
  const maps = buildGraphMaps(graph);
  const candidatePaths: SuspiciousPath[] = [];
  const seen = new Set<string>();

  for (const seedNodeId of seedNodeIds) {
    walkPaths(graph, maps, findings, seedNodeId, seedNodeId, [seedNodeId], [], new Set([seedNodeId]), candidatePaths, seen);
  }

  const ranked = candidatePaths
    .filter((path) => path.riskScore >= 25 || path.valueFromSeedPct >= 10)
    .sort((left, right) => {
      if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
      }
      if (right.valueFromSeedPct !== left.valueFromSeedPct) {
        return right.valueFromSeedPct - left.valueFromSeedPct;
      }
      return right.confidence - left.confidence;
    })
    .slice(0, maxPaths);

  const highlighted = new Set(ranked.flatMap((path) => path.edgeIds));
  for (const edge of graph.edges) {
    if (highlighted.has(edge.id) && !edge.flags.includes("path-highlight")) {
      edge.flags.push("path-highlight");
    }
  }

  return ranked;
}

export function pruneGraph(
  graph: TraceGraph,
  suspiciousPaths: SuspiciousPath[],
  seedNodeIds: string[],
  maxNodes: number
): { graph: TraceGraph; pruning?: PruningSummary } {
  if (graph.nodes.length <= maxNodes) {
    return { graph };
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const rankedNodes = [...graph.nodes].sort(
    (left, right) => rankNodeForRetention(right) - rankNodeForRetention(left)
  );
  const keepNodeIds = new Set<string>(seedNodeIds);

  for (const path of suspiciousPaths) {
    for (const nodeId of path.nodeIds) {
      keepNodeIds.add(nodeId);
    }
  }

  for (const node of rankedNodes) {
    if (keepNodeIds.size >= maxNodes) {
      break;
    }
    if (shouldAlwaysRetainNode(node)) {
      keepNodeIds.add(node.id);
    }
  }

  for (const node of rankedNodes) {
    if (keepNodeIds.size >= maxNodes) {
      break;
    }
    keepNodeIds.add(node.id);
  }

  let keptEdges = graph.edges.filter((edge) => keepNodeIds.has(edge.from) && keepNodeIds.has(edge.to));
  keptEdges = keptEdges.filter(
    (edge) =>
      edge.flags.includes("path-highlight") ||
      edge.riskScore >= 20 ||
      edge.valueFromSeedPct >= 5 ||
      !isLowValueNoise(edge)
  );

  const connectedNodes = new Set<string>();
  for (const edge of keptEdges) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }
  for (const seedNodeId of seedNodeIds) {
    connectedNodes.add(seedNodeId);
  }

  const prunedGraph = {
    nodes: graph.nodes.filter((node) => connectedNodes.has(node.id)),
    edges: keptEdges
  };

  return {
    graph: prunedGraph,
    pruning: {
      originalNodes: graph.nodes.length,
      originalEdges: graph.edges.length,
      retainedNodes: prunedGraph.nodes.length,
      retainedEdges: prunedGraph.edges.length,
      prunedNodes: graph.nodes.length - prunedGraph.nodes.length,
      prunedEdges: graph.edges.length - prunedGraph.edges.length,
      reason: "Retained seed context, high-risk nodes, special labels, and top suspicious paths for investigation review."
    }
  };
}

export function sliceGraph(graph: TraceGraph, options: SliceGraphOptions): TraceGraph {
  const maps = buildGraphMaps(graph);
  const limit = Math.max(10, options.limit);
  const keepNodeIds = new Set<string>();
  const keepEdgeIds = new Set<string>();

  if (options.focusNodeId && maps.nodeById.has(options.focusNodeId)) {
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: options.focusNodeId, depth: 0 }];
    keepNodeIds.add(options.focusNodeId);

    while (queue.length > 0 && keepNodeIds.size < limit) {
      const current = queue.shift();
      if (!current || current.depth >= options.depth) {
        continue;
      }

      const edges = [
        ...(maps.outboundByNode.get(current.nodeId) ?? []),
        ...(maps.inboundByNode.get(current.nodeId) ?? [])
      ];

      for (const edge of edges) {
        if (options.highRiskOnly && edge.riskScore < 20 && !edge.flags.includes("path-highlight")) {
          continue;
        }

        const nextNodeId = edge.from === current.nodeId ? edge.to : edge.from;
        keepEdgeIds.add(edge.id);
        if (!keepNodeIds.has(nextNodeId) && keepNodeIds.size < limit) {
          keepNodeIds.add(nextNodeId);
          queue.push({ nodeId: nextNodeId, depth: current.depth + 1 });
        }
      }
    }
  } else {
    const rankedNodes = [...graph.nodes]
      .filter((node) => !options.highRiskOnly || node.riskScore >= 30 || node.valueFromSeedPct >= 10)
      .sort((left, right) => rankNodeForRetention(right) - rankNodeForRetention(left))
      .slice(0, limit);
    for (const node of rankedNodes) {
      keepNodeIds.add(node.id);
    }
    for (const edge of graph.edges) {
      if (keepNodeIds.has(edge.from) && keepNodeIds.has(edge.to)) {
        keepEdgeIds.add(edge.id);
      }
    }
  }

  return {
    nodes: graph.nodes.filter((node) => keepNodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => keepEdgeIds.has(edge.id))
  };
}

export function filterFindingsForGraph(findings: Finding[], graph: TraceGraph): Finding[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  return findings.filter(
    (finding) =>
      finding.relatedNodeIds.some((nodeId) => nodeIds.has(nodeId)) ||
      finding.relatedEdgeIds.some((edgeId) => edgeIds.has(edgeId))
  );
}

function buildGraphMaps(graph: TraceGraph): GraphMaps {
  const inboundByNode = new Map<string, GraphEdge[]>();
  const outboundByNode = new Map<string, GraphEdge[]>();
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const edge of graph.edges) {
    const inbound = inboundByNode.get(edge.to) ?? [];
    inbound.push(edge);
    inboundByNode.set(edge.to, inbound);

    const outbound = outboundByNode.get(edge.from) ?? [];
    outbound.push(edge);
    outboundByNode.set(edge.from, outbound);
  }

  return { inboundByNode, outboundByNode, nodeById };
}

function getSeedNodeIds(graph: TraceGraph, request: TraceRequest) {
  if (request.seedType === "address") {
    return [makeNodeId(request.chain, request.seedValue)];
  }

  const matches = graph.edges.filter((edge) => edge.txHash.toLowerCase() === request.seedValue.toLowerCase());
  const sourceNodes = Array.from(new Set(matches.map((edge) => edge.from)));
  return sourceNodes.length > 0 ? sourceNodes : [];
}

function getSeedOutgoingTotal(graph: TraceGraph, seedNodeIds: string[]) {
  return graph.edges
    .filter((edge) => seedNodeIds.includes(edge.from))
    .reduce((sum, edge) => sum + edge.amount, 0);
}

function labelBridgeTouchpoints(graph: TraceGraph, maps: GraphMaps) {
  for (const edge of graph.edges) {
    if (!edge.bridgeTransferId && !edge.flags.includes("bridge")) {
      continue;
    }

    edge.metadata = {
      ...(edge.metadata ?? {}),
      trustedBridge: true
    };

    for (const nodeId of [edge.from, edge.to]) {
      const node = maps.nodeById.get(nodeId);
      if (!node) {
        continue;
      }
      node.tags = uniqueList([...node.tags, "bridge-touchpoint"]);
    }
  }
}

function labelBehavioralRouters(graph: TraceGraph, maps: GraphMaps) {
  for (const node of graph.nodes) {
    if (node.kind !== "wallet" && node.kind !== "contract") {
      continue;
    }
    if (node.tags.includes("bridge") || node.tags.includes("mixer") || node.tags.includes("exchange")) {
      continue;
    }

    const inbound = maps.inboundByNode.get(node.id) ?? [];
    const outbound = maps.outboundByNode.get(node.id) ?? [];
    const uniqueSenders = new Set(inbound.map((edge) => edge.from));
    const uniqueRecipients = new Set(outbound.map((edge) => edge.to));

    if (
      uniqueSenders.size >= ANALYSIS_THRESHOLDS.routerCounterparties &&
      uniqueRecipients.size >= ANALYSIS_THRESHOLDS.routerCounterparties
    ) {
      node.kind = "router";
      node.tags = uniqueList([...node.tags, "router", "behavioral-label"]);
      node.metadata = {
        ...(node.metadata ?? {}),
        behavioralLabel: "router"
      };
    }
  }
}

function labelBehavioralExchanges(graph: TraceGraph, maps: GraphMaps, dustThreshold: number) {
  for (const node of graph.nodes) {
    if (node.tags.includes("exchange") || node.tags.includes("bridge") || node.tags.includes("mixer")) {
      continue;
    }

    const inbound = (maps.inboundByNode.get(node.id) ?? []).filter((edge) => edge.amount > dustThreshold);
    const outbound = (maps.outboundByNode.get(node.id) ?? []).filter((edge) => edge.amount > dustThreshold);
    const uniqueSenders = new Set(inbound.map((edge) => edge.from));

    if (uniqueSenders.size >= ANALYSIS_THRESHOLDS.exchangeInboundCounterparties && outbound.length <= 1) {
      node.kind = "exchange";
      node.terminal = true;
      node.tags = uniqueList([...node.tags, "exchange", "behavioral-label", "sink"]);
      node.metadata = {
        ...(node.metadata ?? {}),
        behavioralLabel: "exchange"
      };
    }
  }
}

function labelMultisigCandidates(graph: TraceGraph, maps: GraphMaps) {
  for (const node of graph.nodes) {
    if (node.kind !== "contract") {
      continue;
    }

    const label = node.label.toLowerCase();
    const matchesKnownPattern = label.includes("safe") || label.includes("multisig") || node.tags.includes("multisig");
    const inboundCount = new Set((maps.inboundByNode.get(node.id) ?? []).map((edge) => edge.from)).size;
    const outboundCount = new Set((maps.outboundByNode.get(node.id) ?? []).map((edge) => edge.to)).size;

    if (matchesKnownPattern || (inboundCount >= 2 && outboundCount >= 2 && node.riskScore < 30)) {
      node.kind = "multisig";
      node.tags = uniqueList([...node.tags, "multisig"]);
      node.metadata = {
        ...(node.metadata ?? {}),
        multisigCandidate: true
      };
    }
  }
}

function applyDustFilter(graph: TraceGraph, dustThreshold: number) {
  for (const edge of graph.edges) {
    if (edge.amount > dustThreshold) {
      continue;
    }

    if (!edge.flags.includes("dust")) {
      edge.flags.push("dust");
    }
    edge.metadata = {
      ...(edge.metadata ?? {}),
      filter: "dust"
    };
  }
}

function applyAirdropFilter(graph: TraceGraph, maps: GraphMaps, amountThreshold: number) {
  for (const node of graph.nodes) {
    const outbound = (maps.outboundByNode.get(node.id) ?? []).filter((edge) => edge.asset !== "ETH" && edge.asset !== "BNB");
    const uniqueRecipients = new Set(outbound.map((edge) => edge.to));
    if (uniqueRecipients.size < ANALYSIS_THRESHOLDS.airdropRecipientThreshold) {
      continue;
    }

    const maxAmount = outbound.reduce((value, edge) => Math.max(value, edge.amount), 0);
    if (maxAmount > amountThreshold) {
      continue;
    }

    node.tags = uniqueList([...node.tags, "airdrop-distributor"]);
    node.metadata = {
      ...(node.metadata ?? {}),
      filterHint: "airdrop-distributor"
    };

    for (const edge of outbound) {
      if (!edge.flags.includes("airdrop")) {
        edge.flags.push("airdrop");
      }
      edge.metadata = {
        ...(edge.metadata ?? {}),
        filter: "airdrop"
      };
    }
  }
}

function walkPaths(
  graph: TraceGraph,
  maps: GraphMaps,
  findings: Finding[],
  seedNodeId: string,
  currentNodeId: string,
  nodeIds: string[],
  edgeIds: string[],
  visited: Set<string>,
  paths: SuspiciousPath[],
  seen: Set<string>
) {
  if (edgeIds.length >= 6) {
    maybePushPath(graph, findings, seedNodeId, nodeIds, edgeIds, paths, seen);
    return;
  }

  const currentNode = maps.nodeById.get(currentNodeId);
  const outgoing = (maps.outboundByNode.get(currentNodeId) ?? [])
    .filter((edge) => !visited.has(edge.to) && !isLowValueNoise(edge))
    .sort((left, right) => rankEdgeForPath(right) - rankEdgeForPath(left))
    .slice(0, 4);

  if (!currentNode || currentNode.terminal || outgoing.length === 0) {
    maybePushPath(graph, findings, seedNodeId, nodeIds, edgeIds, paths, seen);
    return;
  }

  for (const edge of outgoing) {
    const nextVisited = new Set(visited);
    nextVisited.add(edge.to);
    walkPaths(
      graph,
      maps,
      findings,
      seedNodeId,
      edge.to,
      [...nodeIds, edge.to],
      [...edgeIds, edge.id],
      nextVisited,
      paths,
      seen
    );
  }

  maybePushPath(graph, findings, seedNodeId, nodeIds, edgeIds, paths, seen);
}

function maybePushPath(
  graph: TraceGraph,
  findings: Finding[],
  seedNodeId: string,
  nodeIds: string[],
  edgeIds: string[],
  paths: SuspiciousPath[],
  seen: Set<string>
) {
  if (edgeIds.length === 0) {
    return;
  }

  const edges = edgeIds
    .map((edgeId) => graph.edges.find((edge) => edge.id === edgeId))
    .filter((edge): edge is GraphEdge => Boolean(edge));
  const nodes = nodeIds
    .map((nodeId) => graph.nodes.find((node) => node.id === nodeId))
    .filter((node): node is GraphNode => Boolean(node));
  const riskScore = Math.round(
    edges.reduce((sum, edge) => sum + edge.riskScore, 0) +
      nodes.reduce((sum, node) => sum + node.riskScore * 0.2, 0)
  );
  const confidence = roundMetric(
    combineConfidence([
      ...edges.flatMap((edge) => edge.riskSignals),
      ...nodes.flatMap((node) => node.riskSignals)
    ])
  );
  const valueFromSeedPct = roundMetric(Math.max(...edges.map((edge) => edge.valueFromSeedPct), 0));
  const dominantReason = deriveDominantReason(edges, nodes, findings);
  const key = `${seedNodeId}:${edgeIds.join(">")}`;

  if (seen.has(key) || (riskScore < 25 && valueFromSeedPct < 10)) {
    return;
  }
  seen.add(key);

  paths.push({
    id: `path:${paths.length + 1}:${seedNodeId}`,
    startNodeId: seedNodeId,
    endNodeId: nodeIds[nodeIds.length - 1] ?? seedNodeId,
    nodeIds,
    edgeIds,
    chains: uniqueList(edges.map((edge) => edge.chain)),
    riskScore,
    confidence,
    valueFromSeedPct,
    dominantReason
  });
}

function deriveDominantReason(edges: GraphEdge[], nodes: GraphNode[], findings: Finding[]) {
  const signals = [...edges.flatMap((edge) => edge.riskSignals), ...nodes.flatMap((node) => node.riskSignals)];
  if (signals.length > 0) {
    return [...signals].sort((left, right) => right.weight * right.confidence - left.weight * left.confidence)[0]?.reason ?? "Suspicious path";
  }

  const edgeIdSet = new Set(edges.map((edge) => edge.id));
  const matchedFinding = findings.find((finding) => finding.relatedEdgeIds.some((edgeId) => edgeIdSet.has(edgeId)));
  return matchedFinding?.explanation ?? "Suspicious path";
}

function shouldAlwaysRetainNode(node: GraphNode) {
  return (
    node.riskScore >= 40 ||
    node.valueFromSeedPct >= 15 ||
    node.kind === "bridge" ||
    node.kind === "mixer" ||
    node.kind === "exchange" ||
    node.kind === "router" ||
    node.kind === "multisig"
  );
}

function rankNodeForRetention(node: GraphNode) {
  const kindBonus =
    node.kind === "mixer" || node.kind === "bridge"
      ? 30
      : node.kind === "exchange" || node.kind === "router" || node.kind === "multisig"
        ? 20
        : 0;
  return node.riskScore * 2 + node.valueFromSeedPct + kindBonus;
}

function rankEdgeForPath(edge: GraphEdge) {
  return edge.riskScore * 2 + edge.valueFromSeedPct + (edge.flags.includes("bridge-obfuscated") ? 20 : 0);
}

function getEffectiveEdgeAmount(edge: GraphEdge) {
  return isLowValueNoise(edge) ? 0 : edge.amount;
}

function isLowValueNoise(edge: GraphEdge) {
  return edge.flags.includes("dust") || edge.flags.includes("airdrop");
}

function uniqueList<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function combineConfidence(signals: RiskSignal[]) {
  if (signals.length === 0) {
    return 0;
  }

  return signals.reduce((aggregate, signal) => aggregate * (1 - signal.confidence), 1) === 1
    ? 0
    : 1 - signals.reduce((aggregate, signal) => aggregate * (1 - signal.confidence), 1);
}

function roundMetric(value: number) {
  return Number(value.toFixed(4));
}
