import { DEFAULT_TRACE_OPTIONS } from "../config.js";
import { entityIndex } from "../fixtures/sample-trace.js";
import { annotateGraph, applyRiskAdjustments, extractSuspiciousPaths, filterFindingsForGraph, propagateValueFlow, pruneGraph } from "./analysis.js";
import { calculateVelocityMetrics } from "./crawler.js";
import { scoreGraph } from "./heuristics.js";
import { buildEdge, buildNode, makeNodeId, normalizeAddress } from "./normalizer.js";
import { scoreToRiskLevel } from "./scoring.js";
function mergeOptions(options) {
    return {
        ...DEFAULT_TRACE_OPTIONS,
        ...options
    };
}
export async function buildTraceGraph(provider, request) {
    const options = mergeOptions(request.options);
    const labels = entityIndex();
    const nodeMap = new Map();
    const edgeMap = new Map();
    const warnings = [];
    const sources = new Map();
    const frontier = [];
    const visited = new Map();
    const enqueue = (item) => {
        const key = `${item.chain}:${normalizeAddress(item.chain, item.address)}`;
        const existing = visited.get(key);
        const shouldVisit = !existing ||
            item.depth < existing.minDepth ||
            (!!item.after && (!existing.earliestAfter || item.after < existing.earliestAfter));
        if (shouldVisit && item.depth <= options.maxDepth) {
            visited.set(key, {
                minDepth: Math.min(item.depth, existing?.minDepth ?? item.depth),
                earliestAfter: !item.after || (existing?.earliestAfter && existing.earliestAfter < item.after)
                    ? existing?.earliestAfter
                    : item.after
            });
            frontier.push(item);
        }
    };
    if (request.seedType === "address") {
        enqueue({ chain: request.chain, address: request.seedValue, depth: 0 });
    }
    else {
        const seedTransfers = await provider.getTransactionActivity({
            chain: request.chain,
            txHash: request.seedValue
        });
        for (const transfer of seedTransfers) {
            addTransfer(transfer, labels, nodeMap, edgeMap, sources);
            enqueue({ chain: transfer.chain, address: transfer.to, depth: 1, after: transfer.timestamp });
        }
        if (seedTransfers.length === 0) {
            warnings.push("No transaction activity was found for the supplied hash.");
        }
        else if (options.includeBackwardContext) {
            await addBackwardContext(provider, labels, nodeMap, edgeMap, sources, seedTransfers);
        }
    }
    while (frontier.length > 0) {
        if (nodeMap.size >= options.maxNodes) {
            warnings.push(`Traversal stopped after reaching the configured node budget (${options.maxNodes}).`);
            break;
        }
        const current = frontier.shift();
        if (!current) {
            continue;
        }
        const nodeId = makeNodeId(current.chain, current.address);
        if (!nodeMap.has(nodeId)) {
            nodeMap.set(nodeId, buildNode({ chain: current.chain, address: current.address, entity: labels.get(nodeId) }));
        }
        const activity = await provider.listAddressActivity({
            chain: current.chain,
            address: current.address,
            fromTime: current.after,
            toTime: current.before
        });
        const outgoing = activity.filter((transfer) => normalizeAddress(transfer.chain, transfer.from) === normalizeAddress(current.chain, current.address));
        if (outgoing.length === 0 && current.depth === 0) {
            warnings.push("No outgoing activity was found for the supplied seed address.");
        }
        for (const transfer of outgoing) {
            addTransfer(transfer, labels, nodeMap, edgeMap, sources);
            const toNode = nodeMap.get(makeNodeId(transfer.chain, transfer.to));
            if (!toNode?.terminal && current.depth + 1 <= options.maxDepth) {
                enqueue({
                    chain: transfer.chain,
                    address: transfer.to,
                    depth: current.depth + 1,
                    after: transfer.timestamp,
                    before: addDays(transfer.timestamp, options.lookaheadWindowDays)
                });
            }
            if (transfer.bridgeTransferId) {
                const bridgeResolution = await provider.getBridgeResolution(transfer.bridgeTransferId);
                addBridgeResolution(bridgeResolution, labels, nodeMap, edgeMap, sources, transfer);
                if (bridgeResolution?.resolved && current.depth + 1 <= options.maxDepth) {
                    enqueue({
                        chain: bridgeResolution.destinationChain,
                        address: bridgeResolution.beneficiaryAddress,
                        depth: current.depth + 1,
                        after: bridgeResolution.timestamp,
                        before: addDays(bridgeResolution.timestamp, options.lookaheadWindowDays)
                    });
                }
            }
        }
    }
    const graph = {
        nodes: Array.from(nodeMap.values()),
        edges: Array.from(edgeMap.values()).sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    };
    const { seedNodeIds } = annotateGraph(graph, request);
    const scored = scoreGraph(graph);
    applyRiskAdjustments(graph, scored);
    for (const node of graph.nodes) {
        node.riskLevel = scoreToRiskLevel(node.riskScore);
    }
    propagateValueFlow(graph, seedNodeIds);
    const suspiciousPaths = extractSuspiciousPaths(graph, dedupeFindings(scored.findings), seedNodeIds, options.maxSuspiciousPaths);
    const pruned = pruneGraph(graph, suspiciousPaths, seedNodeIds, Math.min(options.graphPruneNodeLimit, options.maxNodes));
    const filteredFindings = filterFindingsForGraph(dedupeFindings(scored.findings), pruned.graph);
    const velocity = calculateVelocityMetrics(pruned.graph, request);
    if (pruned.pruning) {
        warnings.push(`Graph pruned from ${pruned.pruning.originalNodes} nodes to ${pruned.pruning.retainedNodes} nodes for investigation-focused rendering.`);
    }
    if (velocity.requiresImmediateExchangeContact) {
        warnings.push(velocity.recoveryPotential);
    }
    if (velocity.spvVerificationRequired) {
        warnings.push("Cross-chain exit timing should be anchored with an SPV-backed proof before publishing the final on-chain registry entry.");
    }
    return {
        graph: pruned.graph,
        findings: filteredFindings,
        metrics: buildMetrics(pruned.graph, suspiciousPaths, velocity, pruned.pruning),
        suspiciousPaths,
        sources: Array.from(sources.values()),
        warnings,
        pruning: pruned.pruning
    };
}
function addTransfer(transfer, labels, nodeMap, edgeMap, sources) {
    const fromId = makeNodeId(transfer.chain, transfer.from);
    const toId = makeNodeId(transfer.chain, transfer.to);
    if (!nodeMap.has(fromId)) {
        nodeMap.set(fromId, buildNode({ chain: transfer.chain, address: transfer.from, entity: labels.get(fromId) }));
    }
    if (!nodeMap.has(toId)) {
        nodeMap.set(toId, buildNode({ chain: transfer.chain, address: transfer.to, entity: labels.get(toId) }));
    }
    const edge = buildEdge(transfer);
    edgeMap.set(edge.id, edge);
    for (const ref of edge.evidenceRefs) {
        sources.set(ref.id, ref);
    }
}
async function addBackwardContext(provider, labels, nodeMap, edgeMap, sources, seedTransfers) {
    const uniqueOrigins = new Map();
    for (const transfer of seedTransfers) {
        const address = normalizeAddress(transfer.chain, transfer.from);
        uniqueOrigins.set(`${transfer.chain}|${address}|${transfer.timestamp}`, {
            chain: transfer.chain,
            address,
            timestamp: transfer.timestamp
        });
    }
    for (const entry of uniqueOrigins.values()) {
        const activity = await provider.listAddressActivity({
            chain: entry.chain,
            address: entry.address,
            toTime: entry.timestamp
        });
        const inbound = activity
            .filter((transfer) => normalizeAddress(transfer.chain, transfer.to) === normalizeAddress(transfer.chain, entry.address))
            .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
        if (inbound) {
            addTransfer(inbound, labels, nodeMap, edgeMap, sources);
        }
    }
}
function addBridgeResolution(bridgeResolution, labels, nodeMap, edgeMap, sources, sourceTransfer) {
    if (!bridgeResolution) {
        const unresolvedAddress = `unresolved:${sourceTransfer.bridgeTransferId ?? sourceTransfer.txHash}`;
        const unresolvedNode = buildNode({
            chain: sourceTransfer.chain,
            address: unresolvedAddress
        });
        unresolvedNode.label = "Unresolved Bridge Exit";
        unresolvedNode.terminal = true;
        unresolvedNode.kind = "terminal";
        const unresolvedNodeId = makeNodeId(sourceTransfer.chain, unresolvedAddress);
        nodeMap.set(unresolvedNodeId, unresolvedNode);
        edgeMap.set(`${sourceTransfer.id}:unresolved`, {
            id: `${sourceTransfer.id}:unresolved`,
            from: makeNodeId(sourceTransfer.chain, sourceTransfer.to),
            to: unresolvedNodeId,
            chain: sourceTransfer.chain,
            txHash: sourceTransfer.txHash,
            asset: sourceTransfer.asset,
            amount: sourceTransfer.amount,
            timestamp: sourceTransfer.timestamp,
            flags: ["unresolved-bridge"],
            riskScore: 15,
            riskConfidence: 0.4,
            reasons: ["Bridge usage detected, but the destination chain exit could not be resolved."],
            riskSignals: [],
            valueFromSeedPct: 0,
            propagatedAmount: 0,
            evidenceRefs: [],
            synthetic: true,
            bridgeTransferId: sourceTransfer.bridgeTransferId,
            metadata: {
                syntheticType: "unresolved-bridge"
            }
        });
        return;
    }
    const exitNodeId = makeNodeId(bridgeResolution.destinationChain, bridgeResolution.exitAddress ?? bridgeResolution.beneficiaryAddress);
    if (!nodeMap.has(exitNodeId)) {
        nodeMap.set(exitNodeId, buildNode({
            chain: bridgeResolution.destinationChain,
            address: bridgeResolution.exitAddress ?? bridgeResolution.beneficiaryAddress,
            entity: labels.get(exitNodeId)
        }));
    }
    const beneficiaryNodeId = makeNodeId(bridgeResolution.destinationChain, bridgeResolution.beneficiaryAddress);
    if (!nodeMap.has(beneficiaryNodeId)) {
        nodeMap.set(beneficiaryNodeId, buildNode({
            chain: bridgeResolution.destinationChain,
            address: bridgeResolution.beneficiaryAddress,
            entity: labels.get(beneficiaryNodeId)
        }));
    }
    const syntheticEdgeId = `${sourceTransfer.bridgeTransferId}:bridge-resolution`;
    edgeMap.set(syntheticEdgeId, {
        id: syntheticEdgeId,
        from: makeNodeId(sourceTransfer.chain, sourceTransfer.to),
        to: exitNodeId,
        chain: bridgeResolution.destinationChain,
        txHash: `${sourceTransfer.txHash}:bridge`,
        asset: bridgeResolution.asset,
        amount: bridgeResolution.amount,
        timestamp: bridgeResolution.timestamp,
        flags: ["bridge"],
        riskScore: 0,
        riskConfidence: 0,
        reasons: [],
        riskSignals: [],
        valueFromSeedPct: 0,
        propagatedAmount: 0,
        evidenceRefs: [
            {
                id: `bridge:${bridgeResolution.bridgeTransferId}`,
                label: `Bridge continuation ${bridgeResolution.bridgeTransferId}`,
                type: "bridge",
                chain: bridgeResolution.destinationChain,
                url: bridgeResolution.sourceUrl,
                note: "Synthetic cross-chain edge derived from bridge metadata."
            }
        ],
        synthetic: true,
        bridgeTransferId: bridgeResolution.bridgeTransferId,
        metadata: {
            trustedBridge: true
        }
    });
    if (exitNodeId !== beneficiaryNodeId) {
        edgeMap.set(`${sourceTransfer.bridgeTransferId}:bridge-withdrawal`, {
            id: `${sourceTransfer.bridgeTransferId}:bridge-withdrawal`,
            from: exitNodeId,
            to: beneficiaryNodeId,
            chain: bridgeResolution.destinationChain,
            txHash: `${sourceTransfer.txHash}:bridge-withdrawal`,
            asset: bridgeResolution.asset,
            amount: bridgeResolution.amount,
            timestamp: bridgeResolution.timestamp,
            flags: ["bridge"],
            riskScore: 0,
            riskConfidence: 0,
            reasons: [],
            riskSignals: [],
            valueFromSeedPct: 0,
            propagatedAmount: 0,
            evidenceRefs: [
                {
                    id: `bridge-withdrawal:${bridgeResolution.bridgeTransferId}`,
                    label: `Bridge withdrawal ${bridgeResolution.bridgeTransferId}`,
                    type: "bridge",
                    chain: bridgeResolution.destinationChain,
                    url: bridgeResolution.sourceUrl,
                    note: "Synthetic destination-side withdrawal derived from bridge metadata."
                }
            ],
            synthetic: true,
            bridgeTransferId: bridgeResolution.bridgeTransferId,
            metadata: {
                trustedBridge: true
            }
        });
    }
    sources.set(`bridge:${bridgeResolution.bridgeTransferId}`, {
        id: `bridge:${bridgeResolution.bridgeTransferId}`,
        label: `Bridge continuation ${bridgeResolution.bridgeTransferId}`,
        type: "bridge",
        chain: bridgeResolution.destinationChain,
        url: bridgeResolution.sourceUrl
    });
}
function addDays(timestamp, days) {
    const date = new Date(timestamp);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString();
}
function buildMetrics(graph, suspiciousPaths, velocity, pruning) {
    const chainsInvolved = Array.from(new Set(graph.nodes.map((node) => node.chain)));
    const highRiskNodes = graph.nodes.filter((node) => node.riskScore >= 60).length;
    const highRiskEdges = graph.edges.filter((edge) => edge.riskScore >= 60).length;
    const totalValueObserved = Number(graph.edges.reduce((sum, edge) => sum + edge.amount, 0).toFixed(4));
    const tracedValueToExchanges = Number(graph.edges
        .filter((edge) => graph.nodes.find((node) => node.id === edge.to)?.kind === "exchange")
        .reduce((sum, edge) => sum + edge.amount, 0)
        .toFixed(4));
    return {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        chainsInvolved,
        highRiskNodes,
        highRiskEdges,
        totalValueObserved,
        tracedValueToExchanges,
        prunedNodes: pruning?.prunedNodes ?? 0,
        prunedEdges: pruning?.prunedEdges ?? 0,
        suspiciousPathCount: suspiciousPaths.length,
        velocity
    };
}
function dedupeFindings(findings) {
    const seen = new Set();
    return findings.filter((finding) => {
        const key = `${finding.code}:${finding.relatedEdgeIds.join(",")}:${finding.relatedNodeIds.join(",")}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
