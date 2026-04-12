import type { Chain, GraphEdge, GraphNode, KnownEntity, NodeKind, NormalizedTransfer } from "../domain.js";

export function normalizeAddress(chain: Chain, address: string): string {
  if (chain === "ethereum" || chain === "bsc") {
    return address.toLowerCase();
  }

  return address;
}

export function makeNodeId(chain: Chain, address: string): string {
  return `${chain}:${normalizeAddress(chain, address)}`;
}

export function makeEdgeId(transfer: Pick<NormalizedTransfer, "chain" | "txHash" | "from" | "to" | "asset">): string {
  return `${transfer.chain}:${transfer.txHash}:${normalizeAddress(transfer.chain, transfer.from)}:${normalizeAddress(transfer.chain, transfer.to)}:${transfer.asset}`;
}

export function inferNodeKind(address: string, entity?: KnownEntity): NodeKind {
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

export function buildNode(params: {
  chain: Chain;
  address: string;
  entity?: KnownEntity;
}): GraphNode {
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

export function buildEdge(transfer: NormalizedTransfer): GraphEdge {
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

export function shortenAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}
