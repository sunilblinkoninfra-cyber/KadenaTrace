export const DEFAULT_TRACE_OPTIONS = {
    maxDepth: 4,
    maxNodes: 250,
    lookaheadWindowDays: 7,
    includeBackwardContext: true,
    graphPruneNodeLimit: 120,
    maxSuspiciousPaths: 5
};
export const HEURISTIC_THRESHOLDS = {
    rapidHopWindowMinutes: 15,
    rapidHopMinimumEdges: 3,
    rapidHopMaxChainLength: 20,
    bridgeBurstMinTransfers: 2,
    bridgeBurstWindowMinutes: 20,
    fanOutRecipients: 5,
    fanInSenders: 4,
    fanOutWindowMinutes: 30,
    sinkConsolidationRatio: 0.6,
    bridgeObfuscationWindowMinutes: 45,
    peelChainMinHops: 3,
    peelChainMaxRetainPct: 0.15,
    structuringRoundAmountTolerance: 0.001,
    structuringMinTransactions: 3,
    circularFlowMaxMinutes: 120,
    dormantWalletMinDays: 30,
    exchangeHoppingMinExchanges: 2,
    exchangeHoppingWindowMinutes: 60,
    largeSplitMinOutputs: 3,
    largeSplitMinValueUsd: 1000,
    largeSplitMaxWindowMinutes: 60,
    largeSplitMinSplitRatio: 0.15
};
export const ANALYSIS_THRESHOLDS = {
    dustAbsoluteAmount: 0.02,
    dustShareOfSeed: 0.005,
    airdropRecipientThreshold: 4,
    airdropAmountShareOfSeed: 0.01,
    exchangeInboundCounterparties: 3,
    routerCounterparties: 3,
    partialGraphDefaultDepth: 2,
    partialGraphDefaultLimit: 60
};
export const QUEUE_NAME = "trace-jobs";
