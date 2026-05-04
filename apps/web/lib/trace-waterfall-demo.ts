import type { TraceSpan } from "./trace-waterfall";

export const DEMO_TRACE_ID = "trace_01HYQF0OBSERVABILITY";

export function buildDemoTraceSpans(): TraceSpan[] {
  const spans: TraceSpan[] = [
    span("root", null, 0, 3_200, "HTTP GET /v1/investigations/:id", {
      service: "edge-gateway",
      status: "ok",
      region: "bom1"
    }),
    span("auth", "root", 18, 220, "authorize investigator", {
      service: "auth-service",
      status: "ok",
      cache: "hit"
    }),
    span("case", "root", 110, 2_660, "load case overview", {
      service: "case-service",
      status: "ok",
      shard: "pg-east"
    }),
    span("graph", "root", 230, 2_420, "hydrate transaction graph", {
      service: "graph-engine",
      status: "ok",
      nodes: 1834
    }),
    span("risk", "root", 460, 1_640, "score laundering signals", {
      service: "risk-engine",
      status: "ok",
      heuristics: 11
    }),
    span("publish", "root", 2_820, 240, "prepare publish widget", {
      service: "web-frontend",
      status: "ok",
      network: "testnet04"
    })
  ];

  const graphChildren = [
    ["seed", "graph", 260, 180, "load seed wallet context", "graph-store"],
    ["branch", "graph", 520, 780, "expand fan-out branches", "graph-worker"],
    ["bridge", "graph", 1_140, 560, "resolve cross-chain bridge edges", "bridge-indexer"],
    ["exchange", "graph", 1_760, 420, "label exchange endpoints", "entity-resolver"],
    ["terminal", "graph", 2_220, 280, "project terminal exits", "graph-store"]
  ] as const;

  for (const [id, parentId, startTime, duration, label, service] of graphChildren) {
    spans.push(
      span(id, parentId, startTime, duration, label, {
        service,
        status: "ok"
      })
    );
  }

  const riskChildren = [
    ["fanout", "risk", 520, 280, "detect fan-out burst", "fan-out-burst"],
    ["rapid", "risk", 840, 260, "evaluate rapid hops", "rapid-hop-path"],
    ["bridgeBurst", "risk", 1_160, 310, "evaluate bridge burst", "bridge-burst"],
    ["sink", "risk", 1_520, 280, "detect sink consolidation", "sink-consolidation"]
  ] as const;

  for (const [id, parentId, startTime, duration, label, code] of riskChildren) {
    spans.push(
      span(id, parentId, startTime, duration, label, {
        service: "risk-engine",
        signal: code,
        status: "ok"
      })
    );
  }

  for (let index = 0; index < 18; index++) {
    const parentId = index % 2 === 0 ? "branch" : "bridge";
    const startTime = parentId === "branch" ? 560 + index * 34 : 1_180 + index * 19;
    const duration = parentId === "branch" ? 72 + (index % 4) * 28 : 64 + (index % 3) * 24;
    spans.push(
      span(
        `child-${index}`,
        parentId,
        startTime,
        duration,
        parentId === "branch" ? `walk recipient branch ${index + 1}` : `bridge segment ${index + 1}`,
        {
          service: parentId === "branch" ? "graph-worker" : "bridge-indexer",
          status: index % 6 === 0 ? "warning" : "ok",
          shard: `s-${(index % 4) + 1}`
        }
      )
    );
  }

  for (let index = 0; index < 24; index++) {
    const parentId = index % 3 === 0 ? "exchange" : "terminal";
    spans.push(
      span(
        `span-${index}`,
        parentId,
        1_780 + index * 26,
        36 + (index % 5) * 14,
        parentId === "exchange" ? `match exchange label ${index + 1}` : `terminal projection ${index + 1}`,
        {
          service: parentId === "exchange" ? "entity-resolver" : "graph-store",
          status: "ok",
          entity: parentId === "exchange" ? "cex" : "terminal"
        }
      )
    );
  }

  return spans.sort((left, right) => left.startTime - right.startTime);
}

function span(
  id: string,
  parentId: string | null,
  startTime: number,
  duration: number,
  label: string,
  metadata: TraceSpan["metadata"]
): TraceSpan {
  return {
    id,
    parentId,
    startTime,
    duration,
    label,
    metadata
  };
}
