// heuristics.test.ts -- Unit tests for the risk scoring heuristics

import { describe, it } from "node:test";
import assert from "node:assert";

import type { GraphEdge, GraphNode } from "../domain.js";
import { scoreGraph } from "./heuristics.js";

function createMockNode(overrides: Partial<GraphNode> = {}): GraphNode {
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

function createMockEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
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

describe("heuristics", () => {
  describe("scoreGraph", () => {
    it("should return empty findings for empty graph", () => {
      const result = scoreGraph({ nodes: [], edges: [] });
      assert.strictEqual(result.findings.length, 0);
      assert.strictEqual(result.nodeAdjustments.size, 0);
      assert.strictEqual(result.edgeAdjustments.size, 0);
    });

    it("should detect fan-out burst pattern", () => {
      const baseTime = new Date("2024-01-15T10:00:00Z");
      const nodes: GraphNode[] = [
        createMockNode({ id: "source", address: "0xsource" }),
        ...Array.from({ length: 6 }, (_, i) =>
          createMockNode({ id: `recipient-${i}`, address: `0xrecipient${i}` })
        )
      ];

      const edges: GraphEdge[] = [
        // Fan out from source to 6 recipients within 5 minutes
        ...Array.from({ length: 6 }, (_, i) =
          createMockEdge({
            id: `edge-${i}`,
            from: "source",
            to: `recipient-${i}`,
            timestamp: new Date(baseTime.getTime() + i * 60 * 1000).toISOString(),
            amount: 1.0
          })
        )
      ];

      const result = scoreGraph({ nodes, edges });

      const fanOutFinding = result.findings.find((f) => f.code === "fan-out-burst");
      assert.ok(fanOutFinding, "Should detect fan-out burst");
      assert.strictEqual(fanOutFinding?.severity, "high");
      assert.ok(fanOutFinding?.confidence > 0.8);

      // Should adjust source node score
      const sourceAdjustment = result.nodeAdjustments.get("source");
      assert.ok(sourceAdjustment, "Should adjust source node");
      assert.ok(sourceAdjustment?.score > 0);
    });

    it("should detect rapid hop path", () => {
      const baseTime = new Date("2024-01-15T10:00:00Z");
      const nodes: GraphNode[] = [
        createMockNode({ id: "start", address: "0xstart" }),
        createMockNode({ id: "hop1", address: "0xhop1" }),
        createMockNode({ id: "hop2", address: "0xhop2" }),
        createMockNode({ id: "hop3", address: "0xhop3" }),
        createMockNode({ id: "end", address: "0xend" })
      ];

      const edges: GraphEdge[] = [
        createMockEdge({
          id: "edge-1",
          from: "start",
          to: "hop1",
          timestamp: baseTime.toISOString()
        }),
        createMockEdge({
          id: "edge-2",
          from: "hop1",
          to: "hop2",
          timestamp: new Date(baseTime.getTime() + 5 * 60 * 1000).toISOString()
        }),
        createMockEdge({
          id: "edge-3",
          from: "hop2",
          to: "hop3",
          timestamp: new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString()
        }),
        createMockEdge({
          id: "edge-4",
          from: "hop3",
          to: "end",
          timestamp: new Date(baseTime.getTime() + 15 * 60 * 1000).toISOString()
        })
      ];

      const result = scoreGraph({ nodes, edges });

      const rapidHopFinding = result.findings.find((f) => f.code === "rapid-hop-path");
      assert.ok(rapidHopFinding, "Should detect rapid hop path");
      assert.strictEqual(rapidHopFinding?.severity, "critical");

      // Should adjust all nodes in path
      assert.ok(result.nodeAdjustments.has("start"));
      assert.ok(result.nodeAdjustments.has("hop1"));
      assert.ok(result.nodeAdjustments.has("hop2"));
      assert.ok(result.nodeAdjustments.has("hop3"));
    });

    it("should detect mixer touchpoint", () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: "source", address: "0xsource" }),
        createMockNode({
          id: "mixer",
          address: "0xmixer",
          kind: "mixer",
          tags: ["mixer"]
        }),
        createMockNode({ id: "end", address: "0xend" })
      ];

      const edges: GraphEdge[] = [
        createMockEdge({
          id: "edge-1",
          from: "source",
          to: "mixer",
          amount: 10.0
        }),
        createMockEdge({
          id: "edge-2",
          from: "mixer",
          to: "end",
          amount: 9.5
        })
      ];

      const result = scoreGraph({ nodes, edges });

      const mixerFinding = result.findings.find((f) => f.code === "mixer-touchpoint");
      assert.ok(mixerFinding, "Should detect mixer touchpoint");
      assert.strictEqual(mixerFinding?.severity, "critical");

      // Should flag edges with mixer
      const edge1Adjustment = result.edgeAdjustments.get("edge-1");
      assert.ok(edge1Adjustment?.flags.includes("mixer"));
    });

    it("should detect bridge usage", () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: "source", address: "0xsource" }),
        createMockNode({ id: "dest", address: "0xdest" })
      ];

      const edges: GraphEdge[] = [
        createMockEdge({
          id: "edge-1",
          from: "source",
          to: "dest",
          bridgeTransferId: "bridge-123",
          synthetic: true
        })
      ];

      const result = scoreGraph({ nodes, edges });

      const bridgeFinding = result.findings.find((f) => f.code === "bridge-usage");
      assert.ok(bridgeFinding, "Should detect bridge usage");
    });

    it("should detect sink consolidation", () => {
      const nodes: GraphNode[] = [
        ...Array.from({ length: 5 }, (_, i) =
          createMockNode({ id: `source-${i}`, address: `0xsource${i}` })
        ),
        createMockNode({
          id: "sink",
          address: "0xsink",
          kind: "exchange",
          tags: ["sink", "exchange"]
        })
      ];

      const edges: GraphEdge[] = [
        // 5 sources sending 20% each to sink
        ...Array.from({ length: 5 }, (_, i) =
          createMockEdge({
            id: `edge-${i}`,
            from: `source-${i}`,
            to: "sink",
            amount: 20,
            flags: ["rapid-hop"]
          })
        )
      ];

      const result = scoreGraph({ nodes, edges });

      const sinkFinding = result.findings.find((f) => f.code === "sink-consolidation");
      assert.ok(sinkFinding, "Should detect sink consolidation");
    });

    it("should not flag dust transactions", () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: "source", address: "0xsource" }),
        createMockNode({ id: "dest", address: "0xdest" })
      ];

      const edges: GraphEdge[] = [
        createMockEdge({
          id: "edge-1",
          from: "source",
          to: "dest",
          amount: 0.001, // Very small amount
          flags: ["dust"]
        })
      ];

      const result = scoreGraph({ nodes, edges });

      // Should not find fan-out or other patterns due to dust flag
      assert.strictEqual(
        result.findings.filter((f) => f.code === "fan-out-burst").length,
        0,
        "Should not flag dust transactions as fan-out"
      );
    });

    it("should handle bridge obfuscation", () => {
      const baseTime = new Date("2024-01-15T10:00:00Z");
      const nodes: GraphNode[] = [
        createMockNode({ id: "source", address: "0xsource" }),
        createMockNode({ id: "bridge", address: "0xbridge", kind: "bridge" }),
        createMockNode({ id: "exchange", address: "0xexchange", kind: "exchange" })
      ];

      const edges: GraphEdge[] = [
        createMockEdge({
          id: "edge-1",
          from: "source",
          to: "bridge",
          bridgeTransferId: "bridge-123",
          flags: ["bridge"],
          timestamp: baseTime.toISOString()
        }),
        createMockEdge({
          id: "edge-2",
          from: "bridge",
          to: "exchange",
          timestamp: new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString() // Within 45 min window
        })
      ];

      const result = scoreGraph({ nodes, edges });

      const obfuscationFinding = result.findings.find((f) => f.code === "bridge-obfuscation");
      assert.ok(obfuscationFinding, "Should detect bridge obfuscation");
    });

    it("should combine confidence correctly", () => {
      const nodes: GraphNode[] = [
        createMockNode({ id: "mixer", address: "0xmixer", kind: "mixer", tags: ["mixer"] }),
        createMockNode({ id: "victim", address: "0xvictim" })
      ];

      const edges: GraphEdge[] = [
        createMockEdge({ id: "edge-1", from: "victim", to: "mixer", amount: 100 })
      ];

      const result = scoreGraph({ nodes, edges });

      const mixerAdjustment = result.nodeAdjustments.get("mixer");
      assert.ok(mixerAdjustment, "Should have mixer adjustment");
      assert.ok(mixerAdjustment.confidence > 0.9, "Should have high confidence");
    });
  });
});
