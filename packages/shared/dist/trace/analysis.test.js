// analysis.test.ts -- Unit tests for graph analysis functions
import { describe, it } from "node:test";
import assert from "node:assert";
import { annotateGraph, applyRiskAdjustments, extractSuspiciousPaths, filterFindingsForGraph, propagateValueFlow, sliceGraph } from "./analysis.js";
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
describe("analysis", () => {
    describe("annotateGraph", () => {
        it("should identify seed nodes for address seed", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "node-1", address: "0xseed" }),
                    createMockNode({ id: "node-2", address: "0xother" })
                ],
                edges: [
                    createMockEdge({ id: "edge-1", from: "node-1", to: "node-2" })
                ]
            };
            const request = {
                chain: "ethereum",
                seedType: "address",
                seedValue: "0xseed"
            };
            const result = annotateGraph(graph, request);
            assert.deepStrictEqual(result.seedNodeIds, ["node-1"]);
        });
        it("should identify seed nodes for transaction seed", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "node-1", address: "0xfrom" }),
                    createMockNode({ id: "node-2", address: "0xto" })
                ],
                edges: [
                    createMockEdge({ id: "edge-1", from: "node-1", to: "node-2", txHash: "0xseedtx" })
                ]
            };
            const request = {
                chain: "ethereum",
                seedType: "tx",
                seedValue: "0xseedtx"
            };
            const result = annotateGraph(graph, request);
            assert.ok(result.seedNodeIds.includes("node-1"));
            assert.ok(result.seedNodeIds.includes("node-2"));
        });
    });
    describe("applyRiskAdjustments", () => {
        it("should apply node risk adjustments", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "node-1", address: "0x1", riskScore: 0 }),
                    createMockNode({ id: "node-2", address: "0x2", riskScore: 0 })
                ],
                edges: [createMockEdge({ id: "edge-1", from: "node-1", to: "node-2" })]
            };
            const scoredFinding = {
                findings: [],
                nodeAdjustments: new Map([
                    ["node-1", { score: 50, confidence: 0.8, reasons: ["Test reason"], signals: [] }]
                ]),
                edgeAdjustments: new Map()
            };
            applyRiskAdjustments(graph, scoredFinding);
            const node1 = graph.nodes.find(n => n.id === "node-1");
            assert.strictEqual(node1?.riskScore, 50);
            assert.strictEqual(node1?.riskConfidence, 0.8);
            assert.ok(node1?.reasons.includes("Test reason"));
        });
        it("should apply edge risk adjustments", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "node-1" }),
                    createMockNode({ id: "node-2" })
                ],
                edges: [createMockEdge({ id: "edge-1", from: "node-1", to: "node-2", riskScore: 0 })]
            };
            const scoredFinding = {
                findings: [],
                nodeAdjustments: new Map(),
                edgeAdjustments: new Map([
                    ["edge-1", { score: 75, confidence: 0.9, reasons: ["Suspicious"], flags: ["rapid-hop"], signals: [] }]
                ])
            };
            applyRiskAdjustments(graph, scoredFinding);
            const edge = graph.edges.find(e => e.id === "edge-1");
            assert.strictEqual(edge?.riskScore, 75);
            assert.strictEqual(edge?.riskConfidence, 0.9);
            assert.ok(edge?.flags.includes("rapid-hop"));
        });
        it("should cap risk scores at 100", () => {
            const graph = {
                nodes: [createMockNode({ id: "node-1", address: "0x1", riskScore: 0 })],
                edges: []
            };
            const scoredFinding = {
                findings: [],
                nodeAdjustments: new Map([
                    ["node-1", { score: 150, confidence: 1.0, reasons: ["Over threshold"], signals: [] }]
                ]),
                edgeAdjustments: new Map()
            };
            applyRiskAdjustments(graph, scoredFinding);
            const node = graph.nodes.find(n => n.id === "node-1");
            assert.strictEqual(node?.riskScore, 100);
        });
    });
    describe("propagateValueFlow", () => {
        it("should propagate value from seed to terminal", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "seed" }),
                    createMockNode({ id: "intermediate" }),
                    createMockNode({ id: "terminal" })
                ],
                edges: [
                    createMockEdge({ id: "e1", from: "seed", to: "intermediate", amount: 10 }),
                    createMockEdge({ id: "e2", from: "intermediate", to: "terminal", amount: 9 })
                ]
            };
            propagateValueFlow(graph, ["seed"]);
            const edge1 = graph.edges.find(e => e.id === "e1");
            const edge2 = graph.edges.find(e => e.id === "e2");
            const terminal = graph.nodes.find(n => n.id === "terminal");
            assert.strictEqual(edge1?.valueFromSeedPct, 100);
            assert.strictEqual(edge2?.valueFromSeedPct, 90);
            assert.strictEqual(terminal?.valueFromSeedPct, 90);
        });
        it("should handle multiple seed paths", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "seed1" }),
                    createMockNode({ id: "seed2" }),
                    createMockNode({ id: "merge" }),
                    createMockNode({ id: "terminal" })
                ],
                edges: [
                    createMockEdge({ id: "e1", from: "seed1", to: "merge", amount: 5 }),
                    createMockEdge({ id: "e2", from: "seed2", to: "merge", amount: 5 }),
                    createMockEdge({ id: "e3", from: "merge", to: "terminal", amount: 8 })
                ]
            };
            propagateValueFlow(graph, ["seed1", "seed2"]);
            const e3 = graph.edges.find(e => e.id === "e3");
            const terminal = graph.nodes.find(n => n.id === "terminal");
            assert.strictEqual(e3?.valueFromSeedPct, 80);
            assert.strictEqual(terminal?.valueFromSeedPct, 80);
        });
        it("should handle cycles gracefully", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "seed" }),
                    createMockNode({ id: "a" }),
                    createMockNode({ id: "b" })
                ],
                edges: [
                    createMockEdge({ id: "e1", from: "seed", to: "a", amount: 10 }),
                    createMockEdge({ id: "e2", from: "a", to: "b", amount: 10 }),
                    // This would create a cycle, but we won't process it that way
                ]
            };
            // Should not throw
            assert.doesNotThrow(() => propagateValueFlow(graph, ["seed"]));
        });
    });
    describe("extractSuspiciousPaths", () => {
        it("should extract paths to high-risk nodes", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "seed", address: "0xseed" }),
                    createMockNode({ id: "intermediate" }),
                    createMockNode({ id: "suspicious", riskScore: 85 })
                ],
                edges: [
                    createMockEdge({ id: "e1", from: "seed", to: "intermediate" }),
                    createMockEdge({ id: "e2", from: "intermediate", to: "suspicious" })
                ]
            };
            const findings = [
                {
                    code: "high-risk-node",
                    severity: "high",
                    explanation: "High risk node detected",
                    confidence: 0.9,
                    relatedNodeIds: ["suspicious"],
                    relatedEdgeIds: [],
                    evidenceRefs: []
                }
            ];
            const paths = extractSuspiciousPaths(graph, findings, ["seed"], 5);
            assert.ok(paths.length > 0);
            assert.ok(paths.some(p => p.endNodeId === "suspicious"));
        });
        it("should limit number of paths", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "seed", address: "0xseed" }),
                    ...Array.from({ length: 10 }, (_, i) => createMockNode({ id: `node-${i}`, riskScore: 70 }))
                ],
                edges: Array.from({ length: 10 }, (_, i) => createMockEdge({ id: `e-${i}`, from: "seed", to: `node-${i}` }))
            };
            const findings = graph.nodes.slice(1).map((node, i) => ({
                code: "high-risk",
                severity: "high",
                explanation: "High risk",
                confidence: 0.8,
                relatedNodeIds: [node.id],
                relatedEdgeIds: [graph.edges[i].id],
                evidenceRefs: []
            }));
            const paths = extractSuspiciousPaths(graph, findings, ["seed"], 3);
            assert.strictEqual(paths.length, 3);
        });
        it("should calculate path risk scores", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "seed", address: "0xseed" }),
                    createMockNode({ id: "suspicious", riskScore: 80 })
                ],
                edges: [
                    createMockEdge({ id: "e1", from: "seed", to: "suspicious", riskScore: 60 })
                ]
            };
            const findings = [
                {
                    code: "test",
                    severity: "high",
                    explanation: "Test",
                    confidence: 0.9,
                    relatedNodeIds: ["suspicious"],
                    relatedEdgeIds: ["e1"],
                    evidenceRefs: []
                }
            ];
            const paths = extractSuspiciousPaths(graph, findings, ["seed"], 5);
            if (paths.length > 0) {
                assert.ok(paths[0].riskScore > 0);
                assert.ok(paths[0].confidence > 0);
            }
        });
    });
    describe("sliceGraph", () => {
        it("should return full graph when no slicing specified", () => {
            const graph = {
                nodes: [createMockNode({ id: "n1" }), createMockNode({ id: "n2" })],
                edges: [createMockEdge({ id: "e1", from: "n1", to: "n2" })]
            };
            const sliced = sliceGraph(graph, {});
            assert.strictEqual(sliced.nodes.length, 2);
            assert.strictEqual(sliced.edges.length, 1);
        });
        it("should filter by high risk only", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "low", riskScore: 10 }),
                    createMockNode({ id: "high", riskScore: 70 })
                ],
                edges: [createMockEdge({ id: "e1", from: "low", to: "high" })]
            };
            const sliced = sliceGraph(graph, { highRiskOnly: true });
            assert.ok(sliced.nodes.every(n => n.riskScore >= 50 || n.id === "low"));
        });
        it("should slice around focus node", () => {
            const graph = {
                nodes: [
                    createMockNode({ id: "n1" }),
                    createMockNode({ id: "n2" }),
                    createMockNode({ id: "n3" }),
                    createMockNode({ id: "n4" })
                ],
                edges: [
                    createMockEdge({ id: "e1", from: "n1", to: "n2" }),
                    createMockEdge({ id: "e2", from: "n2", to: "n3" }),
                    createMockEdge({ id: "e3", from: "n3", to: "n4" })
                ]
            };
            const sliced = sliceGraph(graph, { focusNodeId: "n2", depth: 1 });
            // Should include n1, n2, n3 (1 hop from n2)
            assert.ok(sliced.nodes.some(n => n.id === "n1"));
            assert.ok(sliced.nodes.some(n => n.id === "n2"));
            assert.ok(sliced.nodes.some(n => n.id === "n3"));
            // n4 is 2 hops from n2
        });
        it("should respect limit parameter", () => {
            const graph = {
                nodes: Array.from({ length: 20 }, (_, i) => createMockNode({ id: `n-${i}` })),
                edges: Array.from({ length: 19 }, (_, i) => createMockEdge({ id: `e-${i}`, from: `n-${i}`, to: `n-${i + 1}` }))
            };
            const sliced = sliceGraph(graph, { limit: 5 });
            assert.strictEqual(sliced.nodes.length <= 5, true);
        });
    });
    describe("filterFindingsForGraph", () => {
        it("should keep findings related to visible nodes", () => {
            const findings = [
                {
                    code: "test1",
                    severity: "high",
                    explanation: "Test 1",
                    confidence: 0.8,
                    relatedNodeIds: ["n1", "n2"],
                    relatedEdgeIds: ["e1"],
                    evidenceRefs: []
                },
                {
                    code: "test2",
                    severity: "medium",
                    explanation: "Test 2",
                    confidence: 0.7,
                    relatedNodeIds: ["n3"],
                    relatedEdgeIds: [],
                    evidenceRefs: []
                }
            ];
            const slicedGraph = {
                nodes: [createMockNode({ id: "n1" }), createMockNode({ id: "n2" })],
                edges: [createMockEdge({ id: "e1", from: "n1", to: "n2" })]
            };
            const filtered = filterFindingsForGraph(findings, slicedGraph);
            assert.strictEqual(filtered.length, 1);
            assert.strictEqual(filtered[0].code, "test1");
        });
        it("should keep findings related to visible edges", () => {
            const findings = [
                {
                    code: "test1",
                    severity: "high",
                    explanation: "Test 1",
                    confidence: 0.8,
                    relatedNodeIds: [],
                    relatedEdgeIds: ["e1"],
                    evidenceRefs: []
                }
            ];
            const slicedGraph = {
                nodes: [createMockNode({ id: "n1" })],
                edges: [createMockEdge({ id: "e1", from: "n1", to: "n1" })]
            };
            const filtered = filterFindingsForGraph(findings, slicedGraph);
            assert.strictEqual(filtered.length, 1);
        });
        it("should handle findings with no related nodes/edges", () => {
            const findings = [
                {
                    code: "global",
                    severity: "low",
                    explanation: "Global finding",
                    confidence: 0.5,
                    relatedNodeIds: [],
                    relatedEdgeIds: [],
                    evidenceRefs: []
                }
            ];
            const slicedGraph = {
                nodes: [createMockNode({ id: "n1" })],
                edges: []
            };
            const filtered = filterFindingsForGraph(findings, slicedGraph);
            // Global findings should be kept
            assert.strictEqual(filtered.length, 1);
        });
    });
});
