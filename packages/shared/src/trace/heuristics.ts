import { HEURISTIC_THRESHOLDS } from "../config.js";
import type { EdgeFlag, Finding, GraphEdge, GraphNode, RiskSignal, ScoredFinding } from "../domain.js";

interface TraceShape {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface NodeAdjustment {
  score: number;
  confidence: number;
  reasons: string[];
  signals: RiskSignal[];
}

interface EdgeAdjustment extends NodeAdjustment {
  flags: EdgeFlag[];
}

function upsertNodeAdjustment(
  map: ScoredFinding["nodeAdjustments"],
  nodeId: string,
  signal: RiskSignal
) {
  const current = map.get(nodeId) ?? { score: 0, confidence: 0, reasons: [], signals: [] };
  current.score += signal.weight;
  current.signals.push(signal);
  current.reasons.push(signal.reason);
  current.confidence = combineConfidence(current.signals);
  map.set(nodeId, current);
}

function upsertEdgeAdjustment(
  map: ScoredFinding["edgeAdjustments"],
  edgeId: string,
  signal: RiskSignal,
  flag: EdgeFlag
) {
  const current = map.get(edgeId) ?? { score: 0, confidence: 0, reasons: [], flags: [], signals: [] };
  current.score += signal.weight;
  current.signals.push(signal);
  current.reasons.push(signal.reason);
  if (!current.flags.includes(flag)) {
    current.flags.push(flag);
  }
  current.confidence = combineConfidence(current.signals);
  map.set(edgeId, current);
}

function createAccumulator(): ScoredFinding {
  return {
    findings: [],
    nodeAdjustments: new Map(),
    edgeAdjustments: new Map()
  };
}

export function scoreGraph(graph: TraceShape): ScoredFinding {
  const accumulator = createAccumulator();
  applyFanOut(graph, accumulator);
  applyFanIn(graph, accumulator);
  applyRapidHops(graph, accumulator);
  applyBridgeUsage(graph, accumulator);
  applyBridgeObfuscation(graph, accumulator);
  applyMixerInteraction(graph, accumulator);
  applySinkConsolidation(graph, accumulator);
  return accumulator;
}

function applyFanOut(graph: TraceShape, accumulator: ScoredFinding) {
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    const existing = outgoing.get(edge.from) ?? [];
    existing.push(edge);
    outgoing.set(edge.from, existing);
  }

  for (const [nodeId, edges] of outgoing) {
    const ordered = [...edges].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    const start = ordered[0]?.timestamp;
    const end = ordered[ordered.length - 1]?.timestamp;
    const uniqueRecipients = new Set(ordered.map((edge) => edge.to));
    if (!start || !end) {
      continue;
    }

    const deltaMinutes = (Date.parse(end) - Date.parse(start)) / 1000 / 60;
    if (
      uniqueRecipients.size >= HEURISTIC_THRESHOLDS.fanOutRecipients &&
      deltaMinutes <= HEURISTIC_THRESHOLDS.fanOutWindowMinutes
    ) {
      const signal = createSignal(
        "fan-out-burst",
        "Fan-out burst",
        `Fan-out burst to ${uniqueRecipients.size} recipients within ${Math.round(deltaMinutes)} minutes.`,
        32,
        0.86
      );
      accumulator.findings.push(createFinding(signal, "high", [nodeId, ...ordered.map((edge) => edge.to)], ordered));
      upsertNodeAdjustment(accumulator.nodeAdjustments, nodeId, signal);
      for (const edge of ordered) {
        upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, { ...signal, weight: 12 }, "fan-out");
      }
    }
  }
}

function applyFanIn(graph: TraceShape, accumulator: ScoredFinding) {
  const inbound = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    const existing = inbound.get(edge.to) ?? [];
    existing.push(edge);
    inbound.set(edge.to, existing);
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  for (const [nodeId, edges] of inbound) {
    const node = nodeById.get(nodeId);
    if (!node || node.kind === "exchange" || node.kind === "bridge" || node.kind === "multisig") {
      continue;
    }

    const uniqueSenders = new Set(edges.map((edge) => edge.from));
    if (uniqueSenders.size < HEURISTIC_THRESHOLDS.fanInSenders) {
      continue;
    }

    const signal = createSignal(
      "fan-in-consolidation",
      "Fan-in consolidation",
      `A non-exchange destination consolidated funds from ${uniqueSenders.size} senders.`,
      20,
      0.72
    );
    accumulator.findings.push(createFinding(signal, "medium", [nodeId, ...Array.from(uniqueSenders)], edges));
    upsertNodeAdjustment(accumulator.nodeAdjustments, nodeId, signal);
    for (const edge of edges) {
      upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, { ...signal, weight: 8 }, "fan-in");
    }
  }
}

function applyRapidHops(graph: TraceShape, accumulator: ScoredFinding) {
  const candidateEdges = graph.edges.filter((edge) => !isSuppressedEdge(edge));
  for (const edge of candidateEdges) {
    const path = [edge];
    let cursor = edge.to;
    let cursorTime = edge.timestamp;

    while (path.length < HEURISTIC_THRESHOLDS.rapidHopMinimumEdges) {
      const nextCandidates = candidateEdges
        .filter((candidate) => candidate.from === cursor)
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      const next = nextCandidates.find((candidate) => {
        const minutes = (Date.parse(candidate.timestamp) - Date.parse(cursorTime)) / 1000 / 60;
        return minutes >= 0 && minutes <= HEURISTIC_THRESHOLDS.rapidHopWindowMinutes;
      });
      if (!next) {
        break;
      }

      path.push(next);
      cursor = next.to;
      cursorTime = next.timestamp;
    }

    if (path.length >= HEURISTIC_THRESHOLDS.rapidHopMinimumEdges) {
      const signal = createSignal(
        "rapid-hop-path",
        "Rapid hop path",
        `Rapid laundering path spans ${path.length} edges with less than ${HEURISTIC_THRESHOLDS.rapidHopWindowMinutes} minutes between hops.`,
        18,
        0.91
      );
      accumulator.findings.push(
        createFinding(signal, "critical", Array.from(new Set(path.flatMap((item) => [item.from, item.to]))), path)
      );
      for (const item of path) {
        upsertNodeAdjustment(accumulator.nodeAdjustments, item.from, signal);
        upsertNodeAdjustment(accumulator.nodeAdjustments, item.to, signal);
        upsertEdgeAdjustment(accumulator.edgeAdjustments, item.id, signal, "rapid-hop");
      }
      break;
    }
  }
}

function applyBridgeUsage(graph: TraceShape, accumulator: ScoredFinding) {
  for (const edge of graph.edges) {
    if (!edge.bridgeTransferId && !edge.synthetic) {
      continue;
    }

    const isKnownBridge = edge.metadata?.trustedBridge === true;
    const signal = createSignal(
      "bridge-usage",
      "Bridge usage",
      isKnownBridge
        ? "Funds crossed a labeled bridge route. This is context, not a standalone fraud signal."
        : "Funds crossed into or out of a supported bridge route.",
      isKnownBridge ? 4 : 8,
      isKnownBridge ? 0.35 : 0.5
    );
    accumulator.findings.push(createFinding(signal, "low", [edge.from, edge.to], [edge]));
    upsertNodeAdjustment(accumulator.nodeAdjustments, edge.from, { ...signal, weight: Math.max(2, signal.weight - 2) });
    upsertNodeAdjustment(accumulator.nodeAdjustments, edge.to, { ...signal, weight: Math.max(2, signal.weight - 2) });
    upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, signal, "bridge");
  }
}

function applyBridgeObfuscation(graph: TraceShape, accumulator: ScoredFinding) {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  for (const edge of graph.edges.filter((item) => item.bridgeTransferId || item.flags.includes("bridge"))) {
    const continuation = graph.edges
      .filter((candidate) => candidate.from === edge.to || candidate.from === nodeById.get(edge.to)?.id)
      .filter((candidate) => !isSuppressedEdge(candidate))
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
      .find((candidate) => {
        const deltaMinutes = (Date.parse(candidate.timestamp) - Date.parse(edge.timestamp)) / 1000 / 60;
        return deltaMinutes >= 0 && deltaMinutes <= HEURISTIC_THRESHOLDS.bridgeObfuscationWindowMinutes;
      });

    if (!continuation) {
      continue;
    }

    const destinationNode = nodeById.get(continuation.to);
    if (!destinationNode || (destinationNode.kind !== "exchange" && destinationNode.kind !== "mixer")) {
      continue;
    }

    const signal = createSignal(
      "bridge-obfuscation",
      "Bridge obfuscation",
      `Funds bridged and then reached a ${destinationNode.kind} within ${HEURISTIC_THRESHOLDS.bridgeObfuscationWindowMinutes} minutes.`,
      24,
      0.82
    );
    accumulator.findings.push(
      createFinding(signal, "high", [edge.from, edge.to, continuation.to], [edge, continuation])
    );
    upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, signal, "bridge-obfuscated");
    upsertEdgeAdjustment(accumulator.edgeAdjustments, continuation.id, { ...signal, weight: 16 }, destinationNode.kind === "exchange" ? "exchange-cashout" : "mixer");
    upsertNodeAdjustment(accumulator.nodeAdjustments, continuation.to, signal);
  }
}

function applyMixerInteraction(graph: TraceShape, accumulator: ScoredFinding) {
  for (const node of graph.nodes) {
    if (!node.tags.includes("mixer") && node.kind !== "mixer") {
      continue;
    }

    const inbound = graph.edges.filter((edge) => edge.to === node.id && !isSuppressedEdge(edge));
    const signal = createSignal(
      "mixer-touchpoint",
      "Mixer touchpoint",
      "Funds interacted with a wallet or contract labeled as a mixer.",
      40,
      0.96
    );
    accumulator.findings.push(createFinding(signal, "critical", [node.id, ...inbound.map((edge) => edge.from)], inbound));
    upsertNodeAdjustment(accumulator.nodeAdjustments, node.id, signal);
    for (const edge of inbound) {
      upsertNodeAdjustment(accumulator.nodeAdjustments, edge.from, { ...signal, weight: 12 });
      upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, { ...signal, weight: 24 }, "mixer");
    }
  }
}

function applySinkConsolidation(graph: TraceShape, accumulator: ScoredFinding) {
  const totalValue = graph.edges.filter((edge) => !isSuppressedEdge(edge)).reduce((sum, edge) => sum + edge.amount, 0);
  if (totalValue <= 0) {
    return;
  }

  const inboundTotals = new Map<string, number>();
  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    inboundTotals.set(edge.to, (inboundTotals.get(edge.to) ?? 0) + edge.amount);
  }

  for (const node of graph.nodes) {
    const inbound = inboundTotals.get(node.id) ?? 0;
    const ratio = inbound / totalValue;
    const supportingEdges = graph.edges.filter((edge) => edge.to === node.id && !isSuppressedEdge(edge));
    const hasRiskyPrecursor = supportingEdges.some(
      (edge) =>
        edge.flags.includes("rapid-hop") ||
        edge.flags.includes("mixer") ||
        edge.flags.includes("bridge-obfuscated") ||
        edge.riskScore >= 30
    );

    if (ratio >= HEURISTIC_THRESHOLDS.sinkConsolidationRatio && node.tags.includes("sink") && hasRiskyPrecursor) {
      const signal = createSignal(
        "sink-consolidation",
        "Sink consolidation",
        node.kind === "exchange"
          ? `A cashout path consolidated ${(ratio * 100).toFixed(1)}% of observed value into an exchange destination.`
          : `A sink wallet absorbed ${(ratio * 100).toFixed(1)}% of observed value.`,
        22,
        node.kind === "exchange" ? 0.74 : 0.8
      );
      accumulator.findings.push(
        createFinding(signal, "high", [node.id, ...supportingEdges.map((edge) => edge.from)], supportingEdges)
      );
      upsertNodeAdjustment(accumulator.nodeAdjustments, node.id, signal);
      for (const edge of supportingEdges) {
        upsertEdgeAdjustment(
          accumulator.edgeAdjustments,
          edge.id,
          { ...signal, weight: 12 },
          node.kind === "exchange" ? "exchange-cashout" : "sink"
        );
      }
    }
  }
}

function createSignal(code: string, title: string, reason: string, weight: number, confidence: number): RiskSignal {
  return {
    code,
    title,
    reason,
    weight,
    confidence
  };
}

function createFinding(
  signal: RiskSignal,
  severity: Finding["severity"],
  relatedNodeIds: string[],
  edges: GraphEdge[]
): Finding {
  return {
    code: signal.code,
    severity,
    explanation: signal.reason,
    confidence: signal.confidence,
    relatedNodeIds,
    relatedEdgeIds: edges.map((edge) => edge.id),
    evidenceRefs: edges.flatMap((edge) => edge.evidenceRefs)
  };
}

function isSuppressedEdge(edge: GraphEdge) {
  return edge.flags.includes("dust") || edge.flags.includes("airdrop");
}

function combineConfidence(signals: RiskSignal[]) {
  if (signals.length === 0) {
    return 0;
  }

  return 1 - signals.reduce((aggregate, signal) => aggregate * (1 - signal.confidence), 1);
}
