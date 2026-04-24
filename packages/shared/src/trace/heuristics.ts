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
  applyBridgeBurst(graph, accumulator);
  applyBridgeObfuscation(graph, accumulator);
  applyMixerInteraction(graph, accumulator);
  applySinkConsolidation(graph, accumulator);
  applyPeelChain(graph, accumulator);
  applyStructuring(graph, accumulator);
  applyCircularFlow(graph, accumulator);
  applyDormantReactivation(graph, accumulator);
  applyExchangeHopping(graph, accumulator);
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
  const coveredEdgeIds = new Set<string>();

  for (const startEdge of candidateEdges) {
    // Skip edges already covered by a previously found rapid-hop path
    if (coveredEdgeIds.has(startEdge.id)) {
      continue;
    }

    const path = [startEdge];
    const visitedNodeIds = new Set<string>([startEdge.from, startEdge.to]);
    let cursor = startEdge.to;
    let cursorTime = startEdge.timestamp;

    // Extend the path as far as possible within the time window
    for (let depth = 1; depth < HEURISTIC_THRESHOLDS.rapidHopMaxChainLength; depth++) {
      const nextCandidates = candidateEdges
        .filter(
          (candidate) =>
            candidate.from === cursor &&
            !coveredEdgeIds.has(candidate.id) &&
            !visitedNodeIds.has(candidate.to) // prevent cycles
        )
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

      const next = nextCandidates.find((candidate) => {
        const minutes = (Date.parse(candidate.timestamp) - Date.parse(cursorTime)) / 1000 / 60;
        return minutes >= 0 && minutes <= HEURISTIC_THRESHOLDS.rapidHopWindowMinutes;
      });

      if (!next) {
        break;
      }

      path.push(next);
      visitedNodeIds.add(next.to);
      cursor = next.to;
      cursorTime = next.timestamp;
    }

    if (path.length < HEURISTIC_THRESHOLDS.rapidHopMinimumEdges) {
      continue;
    }

    // Mark all edges in this path as covered so they are not re-used
    for (const item of path) {
      coveredEdgeIds.add(item.id);
    }

    const signal = createSignal(
      "rapid-hop-path",
      "Rapid hop path",
      `Rapid laundering path spans ${path.length} hops with less than ` +
        `${HEURISTIC_THRESHOLDS.rapidHopWindowMinutes} minutes between each hop.`,
      18,
      0.91
    );

    accumulator.findings.push(
      createFinding(
        signal,
        "critical",
        Array.from(new Set(path.flatMap((item) => [item.from, item.to]))),
        path
      )
    );

    for (const item of path) {
      upsertNodeAdjustment(accumulator.nodeAdjustments, item.from, signal);
      upsertNodeAdjustment(accumulator.nodeAdjustments, item.to, signal);
      upsertEdgeAdjustment(accumulator.edgeAdjustments, item.id, signal, "rapid-hop");
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

function applyBridgeBurst(graph: TraceShape, accumulator: ScoredFinding): void {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const bridgeEventMap = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    const fromNode = nodeById.get(edge.from);
    const toNode = nodeById.get(edge.to);
    const isBridgeEdge =
      Boolean(edge.bridgeTransferId) ||
      edge.flags.includes("bridge") ||
      fromNode?.kind === "bridge" ||
      toNode?.kind === "bridge";

    if (!isBridgeEdge) {
      continue;
    }

    const eventId = edge.bridgeTransferId ?? edge.id;
    const current = bridgeEventMap.get(eventId) ?? [];
    current.push(edge);
    bridgeEventMap.set(eventId, current);
  }

  const bridgeEvents = Array.from(bridgeEventMap.values())
    .map((edges) => ({
      edges,
      timestamp: [...edges].sort((left, right) => left.timestamp.localeCompare(right.timestamp))[0]?.timestamp
    }))
    .filter((event): event is { edges: GraphEdge[]; timestamp: string } => Boolean(event.timestamp))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  const coveredEventIds = new Set<string>();

  for (let index = 0; index < bridgeEvents.length; index += 1) {
    const startEvent = bridgeEvents[index];
    if (!startEvent) {
      continue;
    }
    const startEventId = startEvent.edges[0]?.bridgeTransferId ?? startEvent.edges[0]?.id;
    if (!startEventId || coveredEventIds.has(startEventId)) {
      continue;
    }

    const clusteredEvents = [startEvent];

    for (let cursor = index + 1; cursor < bridgeEvents.length; cursor += 1) {
      const candidate = bridgeEvents[cursor];
      if (!candidate) {
        continue;
      }
      const minutes =
        (Date.parse(candidate.timestamp) - Date.parse(startEvent.timestamp)) / 1000 / 60;

      if (minutes < 0 || minutes > HEURISTIC_THRESHOLDS.bridgeBurstWindowMinutes) {
        break;
      }

      clusteredEvents.push(candidate);
    }

    if (clusteredEvents.length < HEURISTIC_THRESHOLDS.bridgeBurstMinTransfers) {
      continue;
    }

    const relatedEdges = Array.from(
      new Map(
        clusteredEvents
          .flatMap((event) => event.edges)
          .map((edge) => [edge.id, edge] as const)
      ).values()
    );
    const relatedNodeIds = Array.from(
      new Set(relatedEdges.flatMap((edge) => [edge.from, edge.to]))
    );
    const uniqueChains = new Set(relatedEdges.map((edge) => edge.chain));
    const signal = createSignal(
      "bridge-burst",
      "Bridge burst",
      `Detected ${clusteredEvents.length} bridge-driven transfers across ${uniqueChains.size} chain windows ` +
        `within ${HEURISTIC_THRESHOLDS.bridgeBurstWindowMinutes} minutes — a rapid cross-chain fragmentation pattern ` +
        `used to break the audit trail.`,
      26,
      0.84
    );

    accumulator.findings.push(
      createFinding(signal, "high", relatedNodeIds, relatedEdges)
    );

    for (const edge of relatedEdges) {
      upsertNodeAdjustment(accumulator.nodeAdjustments, edge.from, signal);
      upsertNodeAdjustment(accumulator.nodeAdjustments, edge.to, signal);
      upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, signal, "bridge-burst");
    }

    for (const event of clusteredEvents) {
      if (!event) {
        continue;
      }
      const eventId = event.edges[0]?.bridgeTransferId ?? event.edges[0]?.id;
      if (eventId) {
        coveredEventIds.add(eventId);
      }
    }
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

function applyPeelChain(graph: TraceShape, accumulator: ScoredFinding): void {
  const candidateEdges = graph.edges.filter((candidate) => !isSuppressedEdge(candidate));
  const outboundByNode = new Map<string, GraphEdge[]>();
  const coveredEdgeIds = new Set<string>();

  for (const edge of candidateEdges) {
    const list = outboundByNode.get(edge.from) ?? [];
    list.push(edge);
    outboundByNode.set(edge.from, list);
  }

  for (const edge of candidateEdges) {
    if (coveredEdgeIds.has(edge.id)) {
      continue;
    }

    // Start a peel chain from this edge
    const chain: GraphEdge[] = [edge];
    const visitedNodeIds = new Set<string>([edge.from, edge.to]);
    let cursor = edge.to;

    for (let depth = 0; depth < 10; depth++) {
      const outbound = (outboundByNode.get(cursor) ?? [])
        .filter((candidate) => !isSuppressedEdge(candidate))
        .filter((candidate) => !coveredEdgeIds.has(candidate.id))
        .filter((candidate) => !visitedNodeIds.has(candidate.to))
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

      // Peel pattern: exactly one dominant outgoing edge forwarding most funds
      const dominant = outbound.find((candidate) => {
        const totalOut = outbound.reduce((sum, item) => sum + item.amount, 0);
        const retained = totalOut > 0 ? 1 - candidate.amount / totalOut : 1;
        return (
          retained <= HEURISTIC_THRESHOLDS.peelChainMaxRetainPct &&
          outbound.length <= 2 // at most one "change" output
        );
      });

      if (!dominant) {
        break;
      }

      chain.push(dominant);
      visitedNodeIds.add(dominant.to);
      cursor = dominant.to;
    }

    if (chain.length < HEURISTIC_THRESHOLDS.peelChainMinHops) {
      continue;
    }

    const signal = createSignal(
      "peel-chain",
      "Peel chain",
      `Peel chain of ${chain.length} hops: each hop forwards >85% of funds, ` +
        `retaining a small amount to obscure the total. Classic layering technique.`,
      26,
      0.84
    );

    accumulator.findings.push(
      createFinding(
        signal,
        "high",
        Array.from(new Set(chain.flatMap((item) => [item.from, item.to]))),
        chain
      )
    );
    for (const item of chain) {
      coveredEdgeIds.add(item.id);
    }
    for (const item of chain) {
      upsertNodeAdjustment(accumulator.nodeAdjustments, item.from, signal);
      upsertNodeAdjustment(accumulator.nodeAdjustments, item.to, signal);
      upsertEdgeAdjustment(accumulator.edgeAdjustments, item.id, signal, "peel-chain");
    }
  }
}

function applyStructuring(graph: TraceShape, accumulator: ScoredFinding): void {
  const outgoing = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    const list = outgoing.get(edge.from) ?? [];
    list.push(edge);
    outgoing.set(edge.from, list);
  }

  for (const [nodeId, edges] of outgoing) {
    if (edges.length < HEURISTIC_THRESHOLDS.structuringMinTransactions) {
      continue;
    }

    const roundEdges = edges.filter((edge) => {
      const remainder = edge.amount % 1;
      return (
        remainder <= HEURISTIC_THRESHOLDS.structuringRoundAmountTolerance ||
        remainder >= 1 - HEURISTIC_THRESHOLDS.structuringRoundAmountTolerance
      );
    });

    const roundRatio = roundEdges.length / edges.length;
    if (roundRatio < 0.7) {
      continue;
    }

    const signal = createSignal(
      "structuring",
      "Structuring / smurfing",
      `${roundEdges.length} of ${edges.length} outgoing transactions use ` +
        `suspiciously round amounts — a classic structuring pattern used to ` +
        `evade exchange AML reporting thresholds.`,
      22,
      0.78
    );

    accumulator.findings.push(
      createFinding(signal, "high", [nodeId, ...roundEdges.map((edge) => edge.to)], roundEdges)
    );
    upsertNodeAdjustment(accumulator.nodeAdjustments, nodeId, signal);
    for (const edge of roundEdges) {
      upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, signal, "structuring");
    }
  }
}

function applyCircularFlow(graph: TraceShape, accumulator: ScoredFinding): void {
  const candidateEdges = graph.edges.filter((candidate) => !isSuppressedEdge(candidate));

  for (const edge of candidateEdges) {
    // Find any later edge that returns funds to edge.from
    const returning = candidateEdges.find((candidate) => {
      if (candidate.to !== edge.from || candidate.id === edge.id) {
        return false;
      }
      const minutesLater =
        (Date.parse(candidate.timestamp) - Date.parse(edge.timestamp)) / 1000 / 60;
      return minutesLater > 0 && minutesLater <= HEURISTIC_THRESHOLDS.circularFlowMaxMinutes;
    });

    if (!returning) {
      continue;
    }

    const signal = createSignal(
      "circular-flow",
      "Circular flow",
      `Funds sent from ${edge.from.split(":")[1]?.slice(0, 10) ?? edge.from} ` +
        `returned to the same wallet within ${HEURISTIC_THRESHOLDS.circularFlowMaxMinutes} minutes. ` +
        `Indicates wash trading or self-dealing to create artificial transaction history.`,
      30,
      0.88
    );

    accumulator.findings.push(
      createFinding(signal, "high", [edge.from, edge.to, returning.from], [edge, returning])
    );
    upsertNodeAdjustment(accumulator.nodeAdjustments, edge.from, signal);
    upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, signal, "circular-flow");
    upsertEdgeAdjustment(accumulator.edgeAdjustments, returning.id, signal, "circular-flow");
  }
}

function applyDormantReactivation(graph: TraceShape, accumulator: ScoredFinding): void {
  const inboundByNode = new Map<string, GraphEdge[]>();
  const outboundByNode = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    const inbound = inboundByNode.get(edge.to) ?? [];
    inbound.push(edge);
    inboundByNode.set(edge.to, inbound);

    const outbound = outboundByNode.get(edge.from) ?? [];
    outbound.push(edge);
    outboundByNode.set(edge.from, outbound);
  }

  for (const nodeId of inboundByNode.keys()) {
    const inbound = inboundByNode.get(nodeId) ?? [];
    const outbound = outboundByNode.get(nodeId) ?? [];

    if (inbound.length === 0 || outbound.length === 0) {
      continue;
    }

    const lastReceived = inbound
      .map((edge) => edge.timestamp)
      .sort()
      .at(-1);

    if (!lastReceived) {
      continue;
    }

    const firstSentAfter = outbound
      .filter((edge) => edge.timestamp > lastReceived)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp))[0];

    if (!firstSentAfter) {
      continue;
    }

    const dormantDays =
      (Date.parse(firstSentAfter.timestamp) - Date.parse(lastReceived)) /
      1000 /
      60 /
      60 /
      24;

    if (dormantDays < HEURISTIC_THRESHOLDS.dormantWalletMinDays) {
      continue;
    }

    const signal = createSignal(
      "dormant-reactivation",
      "Dormant wallet reactivation",
      `Wallet was dormant for ${Math.round(dormantDays)} days then suddenly ` +
        `forwarded funds — a sleeper wallet pattern common in staged long-term laundering.`,
      28,
      0.81
    );

    accumulator.findings.push(
      createFinding(signal, "high", [nodeId, firstSentAfter.to], [firstSentAfter])
    );
    upsertNodeAdjustment(accumulator.nodeAdjustments, nodeId, signal);
    upsertEdgeAdjustment(
      accumulator.edgeAdjustments,
      firstSentAfter.id,
      signal,
      "dormant-reactivation"
    );
  }
}

function applyExchangeHopping(graph: TraceShape, accumulator: ScoredFinding): void {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outboundByNode = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges.filter((candidate) => !isSuppressedEdge(candidate))) {
    const list = outboundByNode.get(edge.from) ?? [];
    list.push(edge);
    outboundByNode.set(edge.from, list);
  }

  for (const [nodeId, edges] of outboundByNode) {
    const exchangeEdges = edges.filter((edge) => {
      const target = nodeById.get(edge.to);
      return target?.kind === "exchange" || target?.tags.includes("exchange");
    });

    if (exchangeEdges.length < HEURISTIC_THRESHOLDS.exchangeHoppingMinExchanges) {
      continue;
    }

    const sorted = [...exchangeEdges].sort((left, right) =>
      left.timestamp.localeCompare(right.timestamp)
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last) {
      continue;
    }

    const windowMinutes =
      (Date.parse(last.timestamp) - Date.parse(first.timestamp)) / 1000 / 60;

    if (windowMinutes > HEURISTIC_THRESHOLDS.exchangeHoppingWindowMinutes) {
      continue;
    }

    const uniqueExchanges = new Set(exchangeEdges.map((edge) => edge.to));

    const signal = createSignal(
      "exchange-hopping",
      "Exchange hopping",
      `Funds deposited into ${uniqueExchanges.size} different exchanges within ` +
        `${Math.round(windowMinutes)} minutes — fragmenting the KYC trail across ` +
        `exchange reporting silos to obscure the total amount moved.`,
      24,
      0.83
    );

    accumulator.findings.push(
      createFinding(
        signal,
        "high",
        [nodeId, ...Array.from(uniqueExchanges)],
        exchangeEdges
      )
    );
    upsertNodeAdjustment(accumulator.nodeAdjustments, nodeId, signal);
    for (const edge of exchangeEdges) {
      upsertEdgeAdjustment(accumulator.edgeAdjustments, edge.id, signal, "exchange-hopping");
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
