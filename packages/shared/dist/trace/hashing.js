import { sha256Hex } from "../utils/hash.js";
export function computeTraceHash(edges) {
    const sortedEdges = [...edges]
        .map(toCanonicalTraceEdge)
        .sort(compareCanonicalEdges);
    const canonicalJson = canonicalJsonStringify(sortedEdges);
    return {
        traceHash: sha256Hex(canonicalJson),
        canonicalJson,
        sortedEdges
    };
}
function toCanonicalTraceEdge(edge) {
    return {
        amount: roundAmount(edge.amount),
        asset: edge.asset,
        bridgeTransferId: edge.bridgeTransferId ?? null,
        chain: edge.chain,
        from: edge.from,
        synthetic: edge.synthetic === true,
        timestamp: edge.timestamp,
        to: edge.to,
        txHash: edge.txHash
    };
}
function compareCanonicalEdges(left, right) {
    return (compareStrings(left.from, right.from) ||
        compareStrings(left.to, right.to) ||
        compareStrings(left.timestamp, right.timestamp) ||
        compareNumbers(left.amount, right.amount) ||
        compareStrings(left.asset, right.asset) ||
        compareStrings(left.txHash, right.txHash) ||
        compareStrings(left.chain, right.chain) ||
        compareStrings(left.bridgeTransferId ?? "", right.bridgeTransferId ?? "") ||
        compareNumbers(left.synthetic ? 1 : 0, right.synthetic ? 1 : 0));
}
function canonicalJsonStringify(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalJsonStringify(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([left], [right]) => compareStrings(left, right));
    return `{${entries
        .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJsonStringify(entryValue)}`)
        .join(",")}}`;
}
function compareStrings(left, right) {
    return left.localeCompare(right);
}
function compareNumbers(left, right) {
    return left - right;
}
function roundAmount(value) {
    return Number(value.toFixed(12));
}
