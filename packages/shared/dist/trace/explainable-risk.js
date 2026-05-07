export function buildRiskAnalysis(graph, suspiciousPaths) {
    const suspiciousWallets = graph.nodes
        .filter((node) => node.riskScore >= 20 || node.riskSignals.length > 0)
        .sort((left, right) => right.riskScore - left.riskScore || right.riskConfidence - left.riskConfidence)
        .slice(0, 8)
        .map(toExplainableWallet);
    const suspiciousPathItems = suspiciousPaths
        .slice()
        .sort((left, right) => right.riskScore - left.riskScore || right.confidence - left.confidence)
        .map(toExplainablePath);
    const overallScore = calculateOverallScore(suspiciousWallets, suspiciousPathItems);
    const overallRisk = toInvestigatorRisk(overallScore);
    const summary = buildSummary(overallRisk, suspiciousWallets, suspiciousPathItems);
    return {
        overallRisk,
        overallScore,
        summary,
        suspiciousWallets,
        suspiciousPaths: suspiciousPathItems
    };
}
function toExplainableWallet(node) {
    const signals = uniqueStrings(node.riskSignals.map((signal) => signal.code.replace(/-/g, " ")));
    const primaryReason = node.reasons[0] ?? `Elevated risk score of ${node.riskScore}/100 derived from observed fund-flow behavior.`;
    return {
        wallet: node.address,
        label: node.label,
        risk: toInvestigatorRisk(node.riskScore),
        score: Math.round(node.riskScore),
        reason: combineExplanation(primaryReason, signals),
        signals,
        confidence: Number((node.riskConfidence * 100).toFixed(2)),
        relatedNodeIds: [node.id]
    };
}
function toExplainablePath(path) {
    const signals = uniqueStrings(extractSignalsFromReason(path.dominantReason));
    return {
        pathId: path.id,
        wallet: path.endNodeId,
        risk: toInvestigatorRisk(path.riskScore),
        score: Math.round(path.riskScore),
        reason: combineExplanation(path.dominantReason, signals),
        signals,
        confidence: Number((path.confidence * 100).toFixed(2)),
        edgeIds: path.edgeIds,
        nodeIds: path.nodeIds
    };
}
function calculateOverallScore(suspiciousWallets, suspiciousPaths) {
    const walletScore = suspiciousWallets[0]?.score ?? 0;
    const pathScore = suspiciousPaths[0]?.score ?? 0;
    const blended = Math.max(walletScore, Math.round(walletScore * 0.6 + pathScore * 0.4));
    return Math.min(100, blended);
}
function buildSummary(overallRisk, suspiciousWallets, suspiciousPaths) {
    const walletSignals = uniqueStrings(suspiciousWallets.flatMap((item) => item.signals)).slice(0, 4);
    const pathSignals = uniqueStrings(suspiciousPaths.flatMap((item) => item.signals)).slice(0, 3);
    const combinedSignals = uniqueStrings([...walletSignals, ...pathSignals]);
    if (combinedSignals.length === 0) {
        return `Overall risk is ${overallRisk} based on the graph topology and observed terminal endpoints.`;
    }
    return `Overall risk is ${overallRisk} because the trace combines ${combinedSignals.join(", ")} across the highest-risk wallets and movement paths.`;
}
function combineExplanation(primaryReason, signals) {
    if (signals.length === 0) {
        return primaryReason;
    }
    return `${primaryReason} Signals observed: ${signals.join(", ")}.`;
}
function extractSignalsFromReason(reason) {
    const dictionary = [
        "fan-out",
        "rapid hop",
        "bridge usage",
        "bridge obfuscation",
        "mixer",
        "sink consolidation",
        "fan-in"
    ];
    return dictionary.filter((signal) => reason.toLowerCase().includes(signal.replace(/ /g, "")) || reason.toLowerCase().includes(signal));
}
function toInvestigatorRisk(score) {
    if (score >= 60) {
        return "HIGH";
    }
    if (score >= 30) {
        return "MEDIUM";
    }
    return "LOW";
}
function uniqueStrings(values) {
    return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}
