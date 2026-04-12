import { z } from "zod";

export const supportedChains = ["ethereum", "bsc", "kadena", "bitcoin"] as const;
export type Chain = (typeof supportedChains)[number];

export const nodeKinds = ["wallet", "contract", "bridge", "mixer", "exchange", "router", "multisig", "terminal"] as const;
export type NodeKind = (typeof nodeKinds)[number];

export const seedTypes = ["address", "tx"] as const;
export type SeedType = (typeof seedTypes)[number];

export const findingSeverities = ["low", "medium", "high", "critical"] as const;
export type FindingSeverity = (typeof findingSeverities)[number];

export const riskLevels = ["low", "medium", "high", "critical"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export const edgeFlags = [
  "bridge",
  "rapid-hop",
  "fan-out",
  "fan-in",
  "mixer",
  "sink",
  "unresolved-bridge",
  "dust",
  "airdrop",
  "exchange-cashout",
  "bridge-obfuscated",
  "path-highlight",
  "internal-transfer"
] as const;
export type EdgeFlag = (typeof edgeFlags)[number];

export interface RiskSignal {
  code: string;
  title: string;
  reason: string;
  confidence: number;
  weight: number;
}

export interface EvidenceRef {
  id: string;
  label: string;
  type: "provider" | "tx" | "bridge" | "case" | "contract";
  url?: string;
  txHash?: string;
  chain?: Chain;
  note?: string;
}

export interface GraphNode {
  id: string;
  chain: Chain;
  address: string;
  kind: NodeKind;
  label: string;
  tags: string[];
  riskScore: number;
  riskConfidence: number;
  riskLevel: RiskLevel;
  reasons: string[];
  riskSignals: RiskSignal[];
  valueFromSeedPct: number;
  evidenceRefs: EvidenceRef[];
  terminal?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  chain: Chain;
  txHash: string;
  asset: string;
  amount: number;
  amountUsd?: number;
  timestamp: string;
  flags: EdgeFlag[];
  riskScore: number;
  riskConfidence: number;
  reasons: string[];
  riskSignals: RiskSignal[];
  valueFromSeedPct: number;
  propagatedAmount: number;
  evidenceRefs: EvidenceRef[];
  synthetic?: boolean;
  bridgeTransferId?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Finding {
  code: string;
  severity: FindingSeverity;
  explanation: string;
  confidence: number;
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
  evidenceRefs: EvidenceRef[];
}

export interface SuspiciousPath {
  id: string;
  startNodeId: string;
  endNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  chains: Chain[];
  riskScore: number;
  confidence: number;
  valueFromSeedPct: number;
  dominantReason: string;
}

export interface PruningSummary {
  originalNodes: number;
  originalEdges: number;
  retainedNodes: number;
  retainedEdges: number;
  prunedNodes: number;
  prunedEdges: number;
  reason: string;
}

export interface TraceMetrics {
  totalNodes: number;
  totalEdges: number;
  chainsInvolved: Chain[];
  highRiskNodes: number;
  highRiskEdges: number;
  totalValueObserved: number;
  tracedValueToExchanges: number;
  prunedNodes: number;
  prunedEdges: number;
  suspiciousPathCount: number;
}

export interface TraceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface TraceResult {
  traceId: string;
  seed: TraceRequest;
  graph: TraceGraph;
  findings: Finding[];
  suspiciousPaths: SuspiciousPath[];
  metrics: TraceMetrics;
  sources: EvidenceRef[];
  generatedAt: string;
  warnings: string[];
  pruning?: PruningSummary;
}

export interface TraceRecord {
  id: string;
  request: TraceRequest;
  status: "queued" | "running" | "completed" | "failed";
  result?: TraceResult;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseAnchor {
  requestKey: string;
  chainId: string;
  networkId: string;
  status: "pending" | "submitted" | "confirmed" | "local-simulation" | "failed";
  blockHeight?: number;
  metadataHash: string;
  publicUri: string;
  txPreview?: string;
  submittedAt: string;
  signerAccount?: string;
  signerPublicKey?: string;
  error?: string;
}

export interface RiskAttestation {
  attestationId?: string;
  caseId: string;
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  signer: string;
  createdAt: string;
  note?: string;
  requestKey?: string;
  chainId?: string;
  networkId?: string;
  blockHeight?: number;
  status?: "submitted" | "confirmed" | "failed";
  submittedAt?: string;
  signerPublicKey?: string;
}

export interface CaseRecord {
  caseId: string;
  slug: string;
  title: string;
  summary: string;
  seed: TraceRequest;
  traceId: string;
  traceSnapshot: TraceResult;
  publicUri: string;
  metadataHash: string;
  narrative: string;
  sourceRefs: EvidenceRef[];
  anchor?: CaseAnchor;
  attestations: RiskAttestation[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicCaseView {
  caseId: string;
  slug: string;
  title: string;
  summary: string;
  narrative: string;
  seed: TraceRequest;
  trace: TraceResult;
  anchor?: CaseAnchor;
  attestations: RiskAttestation[];
  sourceRefs: EvidenceRef[];
  updatedAt: string;
}

export interface TraceRequest {
  chain: Chain;
  seedType: SeedType;
  seedValue: string;
  options?: Partial<TraceOptions>;
}

export interface TraceOptions {
  maxDepth: number;
  maxNodes: number;
  lookaheadWindowDays: number;
  includeBackwardContext: boolean;
  graphPruneNodeLimit: number;
  maxSuspiciousPaths: number;
}

export interface KnownEntity {
  chain: Chain;
  address: string;
  label: string;
  kind: NodeKind;
  tags: string[];
  terminal?: boolean;
  sourceUrl?: string;
}

export interface NormalizedTransfer {
  id: string;
  chain: Chain;
  txHash: string;
  timestamp: string;
  blockNumber?: number;
  from: string;
  to: string;
  asset: string;
  amount: number;
  amountUsd?: number;
  transferType: "native" | "token" | "contract" | "synthetic-bridge";
  source: string;
  sourceUrl?: string;
  bridgeTransferId?: string;
}

export interface BridgeResolution {
  bridgeTransferId: string;
  sourceChain: Chain;
  destinationChain: Chain;
  sourceBridgeAddress: string;
  beneficiaryAddress: string;
  exitAddress?: string;
  asset: string;
  amount: number;
  timestamp: string;
  resolved: boolean;
  sourceUrl?: string;
}

export interface ActivityQuery {
  chain: Chain;
  address: string;
  fromTime?: string;
  toTime?: string;
}

export interface TransactionQuery {
  chain: Chain;
  txHash: string;
}

export interface ActivityProvider {
  name: string;
  listAddressActivity(query: ActivityQuery): Promise<NormalizedTransfer[]>;
  getTransactionActivity(query: TransactionQuery): Promise<NormalizedTransfer[]>;
  getBridgeResolution(bridgeTransferId: string): Promise<BridgeResolution | null>;
}

export interface ScoredFinding {
  findings: Finding[];
  nodeAdjustments: Map<string, { score: number; confidence: number; reasons: string[]; signals: RiskSignal[] }>;
  edgeAdjustments: Map<
    string,
    { score: number; confidence: number; reasons: string[]; flags: EdgeFlag[]; signals: RiskSignal[] }
  >;
}

export interface CaseCreateInput {
  traceId: string;
  title: string;
  summary: string;
  narrative: string;
}

export interface WalletAttestationInput {
  wallet: string;
  chain: Chain;
  riskLevel: RiskLevel;
  riskScore: number;
  evidenceHash: string;
  signer: string;
  note?: string;
}

export const traceOptionsSchema = z.object({
  maxDepth: z.number().int().min(1).max(10).default(4),
  maxNodes: z.number().int().min(10).max(1000).default(250),
  lookaheadWindowDays: z.number().int().min(1).max(30).default(7),
  includeBackwardContext: z.boolean().default(true),
  graphPruneNodeLimit: z.number().int().min(20).max(1000).default(120),
  maxSuspiciousPaths: z.number().int().min(1).max(20).default(5)
});

export const traceRequestSchema = z.object({
  chain: z.enum(supportedChains),
  seedType: z.enum(seedTypes),
  seedValue: z.string().min(3),
  options: traceOptionsSchema.partial().optional()
});

export const caseCreateSchema = z.object({
  traceId: z.string().min(3),
  title: z.string().min(3).max(140),
  summary: z.string().min(10).max(400),
  narrative: z.string().min(10).max(5000)
});

export const walletAttestationSchema = z.object({
  wallet: z.string().min(3),
  chain: z.enum(supportedChains),
  riskLevel: z.enum(riskLevels),
  riskScore: z.number().min(0).max(100),
  evidenceHash: z.string().min(6),
  signer: z.string().min(3),
  note: z.string().max(500).optional()
});
