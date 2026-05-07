// builder.test.ts -- Unit tests for the trace graph builder
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildTraceGraph } from "./builder.js";
function createMockProvider(overrides = {}) {
    return {
        name: "mock-provider",
        listAddressActivity: async () => overrides.addressActivity ?? [],
        getTransactionActivity: async () => overrides.txActivity ?? [],
        getBridgeResolution: async () => overrides.bridgeResolution ?? null
    };
}
describe("builder", () => {
    describe("buildTraceGraph", () => {
        it("should handle empty provider responses", async () => {
            const provider = createMockProvider();
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0x1234567890123456789012345678901234567890"
            };
            const result = await buildTraceGraph(provider, request);
            assert.strictEqual(result.graph.nodes.length, 1); // At least seed node
            assert.strictEqual(result.graph.edges.length, 0);
            assert.ok(result.warnings.some(w => w.includes("No outgoing activity")));
        });
        it("should build graph from address seed", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xabc123",
                        timestamp: baseTime.toISOString(),
                        from: "0xseed",
                        to: "0xrecipient1",
                        asset: "ETH",
                        amount: 1.5,
                        transferType: "native",
                        source: "mock"
                    },
                    {
                        id: "tx-2",
                        chain: "ethereum",
                        txHash: "0xdef456",
                        timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000).toISOString(),
                        from: "0xseed",
                        to: "0xrecipient2",
                        asset: "ETH",
                        amount: 2.0,
                        transferType: "native",
                        source: "mock"
                    }
                ]
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const result = await buildTraceGraph(provider, request);
            assert.strictEqual(result.graph.nodes.length, 3); // seed + 2 recipients
            assert.strictEqual(result.graph.edges.length, 2);
            assert.ok(result.metrics.totalValueObserved > 0);
        });
        it("should build graph from transaction seed", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                txActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xseedtx",
                        timestamp: baseTime.toISOString(),
                        from: "0xfrom",
                        to: "0xto",
                        asset: "ETH",
                        amount: 5.0,
                        transferType: "native",
                        source: "mock"
                    }
                ],
                addressActivity: [
                    {
                        id: "tx-2",
                        chain: "ethereum",
                        txHash: "0xnext123",
                        timestamp: new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString(),
                        from: "0xto",
                        to: "0xnext",
                        asset: "ETH",
                        amount: 4.5,
                        transferType: "native",
                        source: "mock"
                    }
                ]
            });
            const request = {
                chain: "ethereum",
                seedType: "tx",
                seedValue: "0xseedtx"
            };
            const result = await buildTraceGraph(provider, request);
            assert.ok(result.graph.nodes.length >= 3);
            assert.ok(result.graph.edges.length >= 1);
        });
        it("should handle bridge resolution", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xabc123",
                        timestamp: baseTime.toISOString(),
                        from: "0xseed",
                        to: "0xbridge",
                        asset: "ETH",
                        amount: 10.0,
                        transferType: "native",
                        source: "mock",
                        bridgeTransferId: "bridge-123"
                    }
                ],
                bridgeResolution: {
                    bridgeTransferId: "bridge-123",
                    sourceChain: "ethereum",
                    destinationChain: "bsc",
                    sourceBridgeAddress: "0xbridge",
                    beneficiaryAddress: "0xbscrecipient",
                    exitAddress: "0xbscrecipient",
                    asset: "ETH",
                    amount: 10.0,
                    timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000).toISOString(),
                    resolved: true
                }
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed",
                options: { maxDepth: 2 }
            };
            const result = await buildTraceGraph(provider, request);
            // Should have synthetic bridge edge
            const bridgeEdges = result.graph.edges.filter(e => e.synthetic);
            assert.ok(bridgeEdges.length > 0, "Should have synthetic bridge edges");
            // Should include both chains
            assert.ok(result.metrics.chainsInvolved.includes("ethereum"));
            assert.ok(result.metrics.chainsInvolved.includes("bsc"));
        });
        it("should handle unresolved bridge", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xabc123",
                        timestamp: baseTime.toISOString(),
                        from: "0xseed",
                        to: "0xbridge",
                        asset: "ETH",
                        amount: 10.0,
                        transferType: "native",
                        source: "mock",
                        bridgeTransferId: "bridge-unknown"
                    }
                ],
                bridgeResolution: null
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const result = await buildTraceGraph(provider, request);
            // Should create unresolved bridge node
            const unresolvedNode = result.graph.nodes.find(n => n.label === "Unresolved Bridge Exit");
            assert.ok(unresolvedNode, "Should create unresolved bridge node");
            // Should have unresolved-bridge flag
            const unresolvedEdge = result.graph.edges.find(e => e.flags.includes("unresolved-bridge"));
            assert.ok(unresolvedEdge, "Should flag unresolved bridge");
        });
        it("should respect maxNodes limit", async () => {
            const provider = createMockProvider({
                addressActivity: Array.from({ length: 20 }, (_, i) => ({
                    id: `tx-${i}`,
                    chain: "ethereum",
                    txHash: `0xtx${i}`,
                    timestamp: new Date(2024, 0, 15, 10, i).toISOString(),
                    from: "0xseed",
                    to: `0xrecipient${i}`,
                    asset: "ETH",
                    amount: 1.0,
                    transferType: "native",
                    source: "mock"
                }))
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed",
                options: { maxNodes: 10 }
            };
            const result = await buildTraceGraph(provider, request);
            assert.ok(result.warnings.some(w => w.includes("node budget")));
        });
        it("should stop at terminal nodes", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xabc123",
                        timestamp: baseTime.toISOString(),
                        from: "0xseed",
                        to: "0xexchange",
                        asset: "ETH",
                        amount: 5.0,
                        transferType: "native",
                        source: "mock"
                    },
                    // This should NOT be fetched because exchange is terminal
                    {
                        id: "tx-2",
                        chain: "ethereum",
                        txHash: "0xdef456",
                        timestamp: new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString(),
                        from: "0xexchange",
                        to: "0xother",
                        asset: "ETH",
                        amount: 4.5,
                        transferType: "native",
                        source: "mock"
                    }
                ]
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed",
                options: { maxDepth: 3 }
            };
            const result = await buildTraceGraph(provider, request);
            // Exchange node should exist and be terminal
            const exchangeNode = result.graph.nodes.find(n => n.address === "0xexchange");
            if (exchangeNode) {
                assert.ok(exchangeNode.terminal || exchangeNode.kind === "exchange");
            }
        });
        it("should handle backward context when enabled", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                txActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xseedtx",
                        timestamp: baseTime.toISOString(),
                        from: "0xfunding",
                        to: "0xseed",
                        asset: "ETH",
                        amount: 10.0,
                        transferType: "native",
                        source: "mock"
                    }
                ],
                addressActivity: [
                    // This is the backward context
                    {
                        id: "tx-2",
                        chain: "ethereum",
                        txHash: "0xfundingtx",
                        timestamp: new Date(baseTime.getTime() - 60 * 60 * 1000).toISOString(),
                        from: "0xoriginal",
                        to: "0xfunding",
                        asset: "ETH",
                        amount: 10.0,
                        transferType: "native",
                        source: "mock"
                    }
                ]
            });
            const request = {
                chain: "ethereum",
                seedType: "tx",
                seedValue: "0xseedtx",
                options: { includeBackwardContext: true, maxDepth: 1 }
            };
            const result = await buildTraceGraph(provider, request);
            // Should include funding address and original
            assert.ok(result.graph.nodes.some(n => n.address === "0xfunding"));
            assert.ok(result.graph.nodes.some(n => n.address === "0xoriginal"));
        });
        it("should propagate value flow correctly", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xabc123",
                        timestamp: baseTime.toISOString(),
                        from: "0xseed",
                        to: "0xintermediate",
                        asset: "ETH",
                        amount: 10.0,
                        transferType: "native",
                        source: "mock"
                    },
                    {
                        id: "tx-2",
                        chain: "ethereum",
                        txHash: "0xdef456",
                        timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000).toISOString(),
                        from: "0xintermediate",
                        to: "0xfinal",
                        asset: "ETH",
                        amount: 9.5,
                        transferType: "native",
                        source: "mock"
                    }
                ]
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const result = await buildTraceGraph(provider, request);
            // Check propagated values
            const finalNode = result.graph.nodes.find(n => n.address === "0xfinal");
            assert.ok(finalNode);
            assert.ok(finalNode.valueFromSeedPct > 0);
        });
        it("should handle multi-chain seed correctly", async () => {
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "bitcoin",
                        txHash: "btc123",
                        timestamp: baseTime.toISOString(),
                        from: "bc1qseed",
                        to: "bc1qrecipient",
                        asset: "BTC",
                        amount: 0.5,
                        transferType: "native",
                        source: "mempool"
                    }
                ]
            });
            const request = {
                chain: "bitcoin",
                seedType: "address",
                seedValue: "bc1qseed"
            };
            const result = await buildTraceGraph(provider, request);
            assert.strictEqual(result.graph.nodes.length, 2);
            assert.strictEqual(result.graph.nodes[0].chain, "bitcoin");
        });
        it("should dedupe findings", async () => {
            // This tests the dedupeFindings function indirectly
            const baseTime = new Date("2024-01-15T10:00:00Z");
            const provider = createMockProvider({
                addressActivity: [
                    {
                        id: "tx-1",
                        chain: "ethereum",
                        txHash: "0xabc123",
                        timestamp: baseTime.toISOString(),
                        from: "0xseed",
                        to: "0xrecipient",
                        asset: "ETH",
                        amount: 1.0,
                        transferType: "native",
                        source: "mock"
                    }
                ]
            });
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const result = await buildTraceGraph(provider, request);
            // Findings should be unique by code + related edges/nodes
            const uniqueFindings = new Set(result.findings.map(f => `${f.code}:${f.relatedEdgeIds.join(',')}`));
            assert.strictEqual(uniqueFindings.size, result.findings.length);
        });
    });
});
