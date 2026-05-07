import { z } from "zod";
export const supportedChains = ["ethereum", "bsc", "kadena", "bitcoin"];
export const nodeKinds = ["wallet", "contract", "bridge", "mixer", "exchange", "router", "multisig", "terminal"];
export const seedTypes = ["address", "tx"];
export const findingSeverities = ["low", "medium", "high", "critical"];
export const riskLevels = ["low", "medium", "high", "critical"];
export const edgeFlags = [
    "bridge",
    "bridge-burst",
    "rapid-hop",
    "fan-out",
    "fan-in",
    "mixer",
    "sink",
    "peel-chain",
    "structuring",
    "circular-flow",
    "dormant-reactivation",
    "exchange-hopping",
    "unresolved-bridge",
    "dust",
    "airdrop",
    "exchange-cashout",
    "bridge-obfuscated",
    "path-highlight",
    "internal-transfer",
    "large-split"
];
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
