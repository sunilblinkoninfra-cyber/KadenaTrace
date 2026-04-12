import { serializeNodesCsv, serializeEdgesCsv } from "./export";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("serializeNodesCsv", () => {
  it("includes header row", () => {
    const csv = serializeNodesCsv([]);
    assert.ok(csv.startsWith("id,address,label"));
  });
  it("escapes commas in labels", () => {
    const node = { id: "n1", address: "0x1", label: "Alice, Inc",
      kind: "wallet", riskLevel: "low", riskScore: 0, chain: "ethereum",
      reasons: [], riskSignals: [], evidenceRefs: [],
      riskConfidence: 0, valueFromSeedPct: 0, tags: [] } as any;
    const csv = serializeNodesCsv([node]);
    assert.ok(csv.includes('"Alice, Inc"'));
  });
});

describe("serializeEdgesCsv", () => {
  it("includes header row", () => {
    const csv = serializeEdgesCsv([]);
    assert.ok(csv.startsWith("id,from,to"));
  });
});
