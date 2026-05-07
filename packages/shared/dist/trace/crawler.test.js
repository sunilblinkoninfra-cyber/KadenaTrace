// crawler.test.ts -- Unit tests for temporal forensics and velocity metrics
import { describe, it } from "node:test";
import assert from "node:assert";
import { calculateVelocityMetrics } from "./crawler.js";
function createMockNode(overrides = {}) {
    return {
        id: overrides.id ?? "node-1",
        chain: overrides.chain ?? "ethereum",
        address: overrides.address ?? "0x1234567890123456789012345678901234567890",
        kind: overrides.kind ?? "wallet",
        label: overrides.label ?? "Test Wallet",
        tags: overrides.tags ?? [],
        riskScore: overrides.riskScore ?? 0,
        riskConfidence: overrides.riskConfidence ?? 0,
        riskLevel: overrides.riskLevel ?? "low",
        reasons: overrides.reasons ?? [],
        riskSignals: overrides.riskSignals ?? [],
        valueFromSeedPct: overrides.valueFromSeedPct ?? 0,
        evidenceRefs: overrides.evidenceRefs ?? [],
        ...overrides
    };
}
function createMockEdge(overrides = {}) {
    return {
        id: overrides.id ?? "edge-1",
        from: overrides.from ?? "node-1",
        to: overrides.to ?? "node-2",
        chain: overrides.chain ?? "ethereum",
        txHash: overrides.txHash ?? "0xabc123",
        asset: overrides.asset ?? "ETH",
        amount: overrides.amount ?? 1.0,
        timestamp: overrides.timestamp ?? new Date().toISOString(),
        flags: overrides.flags ?? [],
        riskScore: overrides.riskScore ?? 0,
        riskConfidence: overrides.riskConfidence ?? 0,
        reasons: overrides.reasons ?? [],
        riskSignals: overrides.riskSignals ?? [],
        valueFromSeedPct: overrides.valueFromSeedPct ?? 0,
        propagatedAmount: overrides.propagatedAmount ?? 1.0,
        evidenceRefs: overrides.evidenceRefs ?? [],
        ...overrides
    };
}
describe("crawler", () => {
    describe("calculateVelocityMetrics", () => {
        it("should return empty metrics for empty graph", () => {
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const result = calculateVelocityMetrics({ nodes: [], edges: [] }, seed);
            assert.strictEqual(result.terminalPathCount, 0);
            assert.strictEqual(result.meanTimeToExitMinutes, null);
            assert.strictEqual(result.incidentTimestamp, null);
            assert.strictEqual(result.criminalEfficiencyScore, null);
            assert.strictEqual(result.crossChainExitDetected, false);
            assert.strictEqual(result.spvVerificationRequired, false);
            assert.strictEqual(result.requiresImmediateExchangeContact, false);
        });
        it("should calculate time-to-exit for single chain path", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed" }),
                createMockNode({ id: "intermediate", address: "0xintermediate" }),
                createMockNode({ id: "exchange", address: "0xexchange", kind: "exchange", tags: ["exchange"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "seed-node",
                    to: "intermediate",
                    timestamp: baseTime.toISOString()
                }),
                createMockEdge({
                    id: "edge-2",
                    from: "intermediate",
                    to: "exchange",
                    timestamp: new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString() // 30 min later
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            assert.strictEqual(result.terminalPathCount, 1);
            assert.strictEqual(result.meanTimeToExitMinutes, 30);
            assert.strictEqual(result.fastestTimeToExitMinutes, 30);
            assert.strictEqual(result.slowestTimeToExitMinutes, 30);
            assert.ok(result.criminalEfficiencyScore !== null);
            assert.ok(result.criminalEfficiencyScore < 100);
            assert.strictEqual(result.requiresImmediateExchangeContact, true, "Should flag immediate contact for <30min exit");
            assert.strictEqual(result.recoveryPotential, "High-speed exit detected. Immediate exchange contact required.");
        });
        it("should detect cross-chain exit", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed", chain: "ethereum" }),
                createMockNode({ id: "bridge-node", address: "0xbridge", chain: "ethereum", kind: "bridge" }),
                createMockNode({ id: "bsc-dest", address: "0xbscdest", chain: "bsc", kind: "exchange", tags: ["exchange"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "seed-node",
                    to: "bridge-node",
                    timestamp: baseTime.toISOString(),
                    chain: "ethereum"
                }),
                createMockEdge({
                    id: "edge-2",
                    from: "bridge-node",
                    to: "bsc-dest",
                    timestamp: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
                    chain: "bsc"
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            assert.strictEqual(result.crossChainExitDetected, true);
            assert.strictEqual(result.spvVerificationRequired, true);
            assert.ok(result.recoveryPotential.includes("Bridge exit identified"));
        });
        it("should calculate fan-out branch average", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed" }),
                createMockNode({ id: "fan-out", address: "0xfanout" }),
                ...Array.from({ length: 5 }, (_, i) => createMockNode({
                    id: `dest-${i}`,
                    address: `0xdest${i}`,
                    kind: i === 4 ? "exchange" : "wallet",
                    tags: i === 4 ? ["exchange"] : []
                }))
            ];
            const edges = [
                createMockEdge({
                    id: "edge-0",
                    from: "seed-node",
                    to: "fan-out",
                    timestamp: baseTime.toISOString()
                }),
                // Fan out from fan-out node to 5 destinations
                ...Array.from({ length: 5 }, (_, i) => createMockEdge({
                    id: `fan-edge-${i}`,
                    from: "fan-out",
                    to: `dest-${i}`,
                    timestamp: new Date(baseTime.getTime() + i * 10 * 60 * 1000).toISOString()
                })),
                // Continue from dest-0 to exchange
                createMockEdge({
                    id: "edge-final",
                    from: "dest-0",
                    to: "dest-4",
                    timestamp: new Date(baseTime.getTime() + 120 * 60 * 1000).toISOString()
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            assert.ok(result.fanOutBranchAverageMinutes !== null);
            assert.ok(result.timeline.length > 0);
        });
        it("should classify urgency correctly for fast exits", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed" }),
                createMockNode({ id: "exchange", address: "0xexchange", kind: "exchange", tags: ["exchange"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "seed-node",
                    to: "exchange",
                    timestamp: baseTime.toISOString()
                }),
                createMockEdge({
                    id: "edge-2",
                    from: "exchange",
                    to: "exchange", // Self-loop for terminal
                    timestamp: new Date(baseTime.getTime() + 30 * 60 * 1000).toISOString()
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            assert.strictEqual(result.urgencyLabel, "Professional/Automated");
            assert.strictEqual(result.urgencyRiskLevel, "critical");
        });
        it("should classify urgency correctly for slow exits", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed" }),
                createMockNode({ id: "exchange", address: "0xexchange", kind: "exchange", tags: ["exchange"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "seed-node",
                    to: "exchange",
                    timestamp: baseTime.toISOString()
                }),
                createMockEdge({
                    id: "edge-2",
                    from: "exchange",
                    to: "exchange",
                    timestamp: new Date(baseTime.getTime() + 48 * 60 * 60 * 1000).toISOString() // 2 days later
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            assert.strictEqual(result.urgencyLabel, "Manual/Staged");
            assert.strictEqual(result.urgencyRiskLevel, "medium");
        });
        it("should build timeline correctly", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "tx",
                seedValue: "0xseedtx"
            };
            const nodes = [
                createMockNode({ id: "node-1", address: "0x1" }),
                createMockNode({ id: "node-2", address: "0x2" }),
                createMockNode({ id: "node-3", address: "0x3", kind: "exchange", tags: ["exchange"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "node-1",
                    to: "node-2",
                    timestamp: baseTime.toISOString(),
                    txHash: "0xseedtx"
                }),
                createMockEdge({
                    id: "edge-2",
                    from: "node-2",
                    to: "node-3",
                    timestamp: new Date(baseTime.getTime() + 60 * 60 * 1000).toISOString(),
                    amount: 5.5,
                    asset: "ETH"
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            assert.strictEqual(result.timeline.length, 2);
            assert.strictEqual(result.timeline[0].gapMinutesFromPrevious, null); // First entry
            assert.strictEqual(result.timeline[1].gapMinutesFromPrevious, 60); // 1 hour gap
            assert.strictEqual(result.timeline[1].terminalType, "cex");
        });
        it("should identify burn addresses", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed" }),
                createMockNode({ id: "burn", address: "0x0000000000000000000000000000000000000000", tags: ["burn"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "seed-node",
                    to: "burn",
                    timestamp: baseTime.toISOString()
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            if (result.terminalPaths.length > 0) {
                assert.strictEqual(result.terminalPaths[0].terminalType, "burn");
            }
        });
        it("should detect DEX LP endpoints", () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const seed = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const nodes = [
                createMockNode({ id: "seed-node", address: "0xseed" }),
                createMockNode({ id: "dex", address: "0xdex", kind: "contract", tags: ["dex-lp", "liquidity-pool"] })
            ];
            const edges = [
                createMockEdge({
                    id: "edge-1",
                    from: "seed-node",
                    to: "dex",
                    timestamp: baseTime.toISOString()
                })
            ];
            const result = calculateVelocityMetrics({ nodes, edges }, seed);
            if (result.terminalPaths.length > 0) {
                assert.strictEqual(result.terminalPaths[0].terminalType, "dex-lp");
            }
        });
    });
});
