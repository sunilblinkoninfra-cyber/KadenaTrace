export function normalizeAddress(chain, address) {
    if (chain === "ethereum" || chain === "bsc") {
        return address.toLowerCase();
    }
    return address;
}
export function makeNodeId(chain, address) {
    return `${chain}:${normalizeAddress(chain, address)}`;
}
export function makeEdgeId(transfer) {
    return `${transfer.chain}:${transfer.txHash}:${normalizeAddress(transfer.chain, transfer.from)}:${normalizeAddress(transfer.chain, transfer.to)}:${transfer.asset}`;
}
export function inferNodeKind(address, entity) {
    if (entity) {
        return entity.kind;
    }
    if (address.startsWith("bridge:")) {
        return "bridge";
    }
    if (address.startsWith("unresolved:")) {
        return "terminal";
    }
    return "wallet";
}
export function buildNode(params) {
    const address = normalizeAddress(params.chain, params.address);
    const label = params.entity?.label ?? shortenAddress(address);
    return {
        id: makeNodeId(params.chain, address),
        chain: params.chain,
        address,
        kind: inferNodeKind(address, params.entity),
        label,
        tags: params.entity?.tags ?? [],
        riskScore: 0,
        riskConfidence: 0,
        riskLevel: "low",
        reasons: [],
        riskSignals: [],
        valueFromSeedPct: 0,
        evidenceRefs: params.entity?.sourceUrl
            ? [
                {
                    id: `entity:${makeNodeId(params.chain, address)}`,
                    label: `${label} label`,
                    type: "provider",
                    chain: params.chain,
                    url: params.entity.sourceUrl
                }
            ]
            : [],
        terminal: params.entity?.terminal ?? false
    };
}
export function buildEdge(transfer) {
    return {
        id: makeEdgeId(transfer),
        from: makeNodeId(transfer.chain, transfer.from),
        to: makeNodeId(transfer.chain, transfer.to),
        chain: transfer.chain,
        txHash: transfer.txHash,
        asset: transfer.asset,
        amount: transfer.amount,
        amountUsd: transfer.amountUsd,
        timestamp: transfer.timestamp,
        flags: [],
        riskScore: 0,
        riskConfidence: 0,
        reasons: [],
        riskSignals: [],
        valueFromSeedPct: 0,
        propagatedAmount: 0,
        evidenceRefs: [
            {
                id: `tx:${transfer.chain}:${transfer.txHash}`,
                label: `${transfer.chain} tx ${shortenHash(transfer.txHash)}`,
                type: "tx",
                txHash: transfer.txHash,
                chain: transfer.chain,
                url: transfer.sourceUrl
            }
        ],
        synthetic: transfer.transferType === "synthetic-bridge",
        bridgeTransferId: transfer.bridgeTransferId,
        metadata: {
            transferType: transfer.transferType,
            source: transfer.source
        }
    };
}
export function shortenAddress(address) {
    if (address.length <= 12) {
        return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
export function shortenHash(hash) {
    return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
