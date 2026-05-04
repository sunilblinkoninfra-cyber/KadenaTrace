import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TIME_SCALE,
  buildSpanRows,
  buildTimelineMarkers,
  getVisibleRowWindow,
  mapSpanToTimelineRect,
  summarizeTrace,
  type TraceSpan
} from "./trace-waterfall";

const SAMPLE_SPANS: TraceSpan[] = [
  {
    id: "root",
    parentId: null,
    startTime: 0,
    duration: 1200,
    label: "HTTP GET /api/trace",
    metadata: { service: "gateway" }
  },
  {
    id: "db",
    parentId: "root",
    startTime: 160,
    duration: 320,
    label: "postgres query",
    metadata: { service: "postgres" }
  },
  {
    id: "cache",
    parentId: "root",
    startTime: 90,
    duration: 80,
    label: "redis lookup",
    metadata: { service: "redis" }
  },
  {
    id: "orm",
    parentId: "db",
    startTime: 210,
    duration: 140,
    label: "orm hydrate",
    metadata: { service: "postgres" }
  }
];

describe("trace-waterfall", () => {
  it("uses a deterministic pixel to millisecond scale", () => {
    assert.equal(TIME_SCALE, 0.12);

    const rect = mapSpanToTimelineRect(SAMPLE_SPANS[1]!, 0);
    assert.equal(rect.left, 19.2);
    assert.equal(rect.width, 38.4);
  });

  it("summarizes the trace bounds from span timings", () => {
    const summary = summarizeTrace(SAMPLE_SPANS);

    assert.equal(summary.traceStart, 0);
    assert.equal(summary.traceEnd, 1200);
    assert.equal(summary.totalDuration, 1200);
  });

  it("builds stable hierarchical rows sorted by start time within each parent", () => {
    const rows = buildSpanRows(SAMPLE_SPANS);

    assert.deepEqual(
      rows.map((row) => ({ id: row.span.id, depth: row.depth })),
      [
        { id: "root", depth: 0 },
        { id: "cache", depth: 1 },
        { id: "db", depth: 1 },
        { id: "orm", depth: 2 }
      ]
    );
  });

  it("creates timeline markers that align to the rendered duration", () => {
    const markers = buildTimelineMarkers({
      traceStart: 0,
      totalDuration: 1200,
      minimumMarkerCount: 4
    });

    assert.equal(markers.length >= 4, true);
    assert.equal(markers[0]?.left, 0);
    assert.equal(markers.at(-1)?.timestamp, 1200);
  });

  it("computes a clamped visible row window for large traces", () => {
    const window = getVisibleRowWindow({
      scrollTop: 720,
      containerHeight: 360,
      rowHeight: 44,
      totalRows: 2500,
      overscan: 4
    });

    assert.deepEqual(window, {
      startIndex: 12,
      endIndex: 29
    });
  });
});
