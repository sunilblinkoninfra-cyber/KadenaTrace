// hashing.ts -- Builds deterministic graph commitments so investigators can independently verify a trace hash.
import type { GraphEdge } from "../domain.js";
import { sha256Hex } from "./hash.js";

interface CanonicalTraceEdge {
  amount: number;
  asset: string;
  bridgeTransferId: string | null;
  chain: GraphEdge["chain"];
  from: string;
  synthetic: boolean;
  timestamp: string;
  to: string;
  txHash: string;
}

export interface TraceHashCommitment {
  traceHash: string;
  canonicalJson: string;
  sortedEdges: CanonicalTraceEdge[];
}

export function computeTraceHash(edges: GraphEdge[]): TraceHashCommitment {
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

function toCanonicalTraceEdge(edge: GraphEdge): CanonicalTraceEdge {
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

function compareCanonicalEdges(left: CanonicalTraceEdge, right: CanonicalTraceEdge): number {
  return (
    compareStrings(left.from, right.from) ||
    compareStrings(left.to, right.to) ||
    compareStrings(left.timestamp, right.timestamp) ||
    compareNumbers(left.amount, right.amount) ||
    compareStrings(left.asset, right.asset) ||
    compareStrings(left.txHash, right.txHash) ||
    compareStrings(left.chain, right.chain) ||
    compareStrings(left.bridgeTransferId ?? "", right.bridgeTransferId ?? "") ||
    compareNumbers(left.synthetic ? 1 : 0, right.synthetic ? 1 : 0)
  );
}

function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJsonStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => compareStrings(left, right));
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalJsonStringify(entryValue)}`)
    .join(",")}}`;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function roundAmount(value: number): number {
  return Number(value.toFixed(12));
}
