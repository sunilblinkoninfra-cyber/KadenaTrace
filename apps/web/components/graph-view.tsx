"use client";

import cytoscape, { type Core } from "cytoscape";
import { useEffect, useRef, useState, type MutableRefObject, type ReactElement } from "react";

import type { Finding, GraphEdge, GraphNode, SuspiciousPath, TraceGraph } from "@kadenatrace/shared";

import { RiskBadge } from "./risk-badge";

type SelectionState =
  | { type: "node"; payload: GraphNode }
  | { type: "edge"; payload: GraphEdge };

type RiskFilterValue = "all" | "low" | "medium" | "high" | "critical";

interface GraphViewProps {
  graph: TraceGraph;
  findings: Finding[];
  seedValue: string;
  suspiciousPaths: SuspiciousPath[];
  focusedPathEdgeIds?: string[];
  onCyReady?: (instance: Core) => void;
}

const RISK_COLORS = {
  critical: "#c0392b",
  high: "#e67e22",
  medium: "#f1c40f",
  low: "#27ae60",
  unscored: "#95a5a6"
} as const;

export function GraphView({
  graph,
  findings,
  seedValue,
  suspiciousPaths,
  focusedPathEdgeIds,
  onCyReady
}: GraphViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const highlightedEdgeIdsRef = useRef<string[]>([]);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskFilterValue>("all");

  useEffect(() => {
    const preferred = graph.nodes.find((node) => node.address.toLowerCase() === seedValue.toLowerCase()) ?? graph.nodes[0];
    if (preferred) {
      setSelection({ type: "node", payload: preferred });
    }
  }, [graph.nodes, seedValue]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (graph.nodes.length === 0) {
      return;
    }

    const instance = cytoscape({
      container: containerRef.current,
      elements: [
        ...graph.nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.label,
            riskLevel: node.riskLevel,
            filterLevel: getNodeDisplayLevel(node),
            kind: node.kind,
            nodeColor: getNodeColor(node)
          }
        })),
        ...graph.edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.from,
            target: edge.to,
            label: `${edge.amount} ${edge.asset}`,
            riskScore: edge.riskScore,
            edgeColor: getEdgeColor(edge.riskScore)
          }
        }))
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.2
      },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "12px",
            "background-color": "data(nodeColor)",
            color: "#1b1d27",
            width: "38px",
            height: "38px",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-valign": "bottom",
            "text-margin-y": 12,
            "border-width": "2px",
            "border-color": "#fff9f2"
          }
        },
        {
          selector: 'node[kind = "bridge"]',
          style: { shape: "diamond" }
        },
        {
          selector: 'node[kind = "mixer"]',
          style: { shape: "hexagon" }
        },
        {
          selector: 'node[kind = "exchange"]',
          style: { shape: "round-rectangle" }
        },
        {
          selector: "edge",
          style: {
            width: 3,
            label: "data(label)",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle",
            "line-color": "data(edgeColor)",
            "target-arrow-color": "data(edgeColor)",
            "text-rotation": "autorotate",
            "font-size": "10px",
            color: "#5e6270",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.7,
            "text-background-padding": "2px",
            "text-margin-y": -8
          }
        },
        {
          selector: ".highlighted",
          style: {
            "line-color": "#9b59b6",
            "target-arrow-color": "#9b59b6",
            "line-style": "dashed",
            width: 3
          }
        }
      ]
    });

    cyRef.current = instance;
    instance.one("layoutstop", () => {
      instance.fit(undefined, 24);
    });
    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
      instance.fit();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    onCyReady?.(instance);
    applyRiskFilter(instance, riskFilter);

    instance.on("tap", "node", (event) => {
      const node = graph.nodes.find((item) => item.id === event.target.id());
      if (node) {
        setSelection({ type: "node", payload: node });
        const path = suspiciousPaths
          .filter((candidate) => candidate.nodeIds.includes(node.id))
          .sort((left, right) => right.riskScore - left.riskScore)[0];
        applyHighlightedPath(instance, path?.edgeIds ?? [], highlightedEdgeIdsRef);
      }
    });

    instance.on("tap", "edge", (event) => {
      const edge = graph.edges.find((item) => item.id === event.target.id());
      if (edge) {
        setSelection({ type: "edge", payload: edge });
      }
    });

    return () => {
      cyRef.current = null;
      resizeObserver.disconnect();
      instance.destroy();
    };
  }, [graph, seedValue, suspiciousPaths]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }

    applyRiskFilter(cyRef.current, riskFilter);
  }, [riskFilter]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }

    applyHighlightedPath(cyRef.current, focusedPathEdgeIds ?? [], highlightedEdgeIdsRef);
  }, [focusedPathEdgeIds]);

  const relatedFindings = selection
    ? findings.filter((finding) =>
        selection.type === "node"
          ? finding.relatedNodeIds.includes(selection.payload.id)
          : finding.relatedEdgeIds.includes(selection.payload.id)
      )
    : [];

  return (
    <div className="graph-shell">
      <div className="graph-main">
        <label className="graph-filter" htmlFor="risk-filter">
          <span>Show nodes at or above risk:</span>
          <select
            id="risk-filter"
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilterValue)}
          >
            <option value="all">All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>

        <div className="risk-legend">
          {[
            ["Critical", RISK_COLORS.critical],
            ["High", RISK_COLORS.high],
            ["Medium", RISK_COLORS.medium],
            ["Low", RISK_COLORS.low],
            ["Unscored", RISK_COLORS.unscored]
          ].map(([label, color]) => (
            <span key={label} className="risk-legend-item">
              <span className="risk-legend-swatch" style={{ backgroundColor: color }} />
              {label}
            </span>
          ))}
        </div>

        <div className="graph-canvas-wrap">
          <div className="graph-controls">
            <button
              aria-label="Zoom in"
              className="graph-control-button"
              type="button"
              onClick={() => {
                const instance = cyRef.current;
                if (!instance) {
                  return;
                }
                instance.zoom(instance.zoom() * 1.2);
              }}
            >
              +
            </button>
            <button
              aria-label="Zoom out"
              className="graph-control-button"
              type="button"
              onClick={() => {
                const instance = cyRef.current;
                if (!instance) {
                  return;
                }
                instance.zoom(instance.zoom() * 0.8);
              }}
            >
              -
            </button>
            <button
              className="graph-control-button graph-control-reset"
              type="button"
              onClick={() => {
                cyRef.current?.fit();
              }}
            >
              Reset view
            </button>
          </div>
          <div
            className="graph-canvas"
            ref={containerRef}
            style={{ height: "540px", minHeight: "540px", width: "100%" }}
          />
        </div>
      </div>

      <aside className="detail-panel">
        {selection ? (
          <>
            <div className="trace-meta">
              <span className="pill">{selection.type}</span>
              {selection.type === "node" ? <RiskBadge level={selection.payload.riskLevel} /> : null}
            </div>
            {selection.type === "node" ? (
              <>
                <h3>{selection.payload.label}</h3>
                <div className="facts">
                  <span className="code">{selection.payload.address}</span>
                  <span className="muted">Kind: {selection.payload.kind}</span>
                  <span className="muted">Tags: {selection.payload.tags.join(", ") || "none"}</span>
                  <span className="muted">
                    Risk: {selection.payload.riskScore}/100 at {(selection.payload.riskConfidence * 100).toFixed(0)}%
                    confidence
                  </span>
                  {selection.payload.riskScore > 0 && (
                    <details className="score-breakdown">
                      <summary>Score breakdown</summary>
                      <table className="score-table">
                        <thead>
                          <tr>
                            <th>Signal</th>
                            <th>Weight</th>
                            <th>Confidence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selection.payload.riskSignals.map(signal => (
                            <tr key={signal.code}>
                              <td>{signal.title}</td>
                              <td>+{signal.weight}</td>
                              <td>{(signal.confidence * 100).toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}
                  <span className="muted">Seed exposure: {selection.payload.valueFromSeedPct.toFixed(1)}%</span>
                </div>
              </>
            ) : (
              <>
                <h3>{selection.payload.asset}</h3>
                <div className="facts">
                  <span className="code">{selection.payload.txHash}</span>
                  <span className="muted">
                    {selection.payload.amount} {selection.payload.asset}
                  </span>
                  <span className="muted">
                    Propagated: {selection.payload.propagatedAmount.toFixed(4)} {selection.payload.asset} (
                    {selection.payload.valueFromSeedPct.toFixed(1)}% of seed flow)
                  </span>
                  <span className="muted">
                    Risk: {selection.payload.riskScore}/100 at {(selection.payload.riskConfidence * 100).toFixed(0)}%
                    confidence
                  </span>
                  <span className="muted">{new Date(selection.payload.timestamp).toLocaleString()}</span>
                </div>
              </>
            )}
            {selection.type === "edge" && selection.payload.flags.length > 0 ? (
              <>
                <h4>Flags</h4>
                <div className="trace-meta">
                  {selection.payload.flags.map((flag) => (
                    <span key={flag} className="pill">
                      {flag}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            {selection.payload.reasons.length > 0 ? (
              <>
                <h4>Why it was highlighted</h4>
                <ul>
                  {selection.payload.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : null}
            {selection.payload.riskSignals.length > 0 ? (
              <>
                <h4>Signals</h4>
                <div className="findings-list">
                  {selection.payload.riskSignals.map((signal) => (
                    <article key={`${signal.code}-${signal.reason}`} className="finding">
                      <div className="trace-meta">
                        <span className="pill">{signal.title}</span>
                        <span className="muted">{(signal.confidence * 100).toFixed(0)}% confidence</span>
                      </div>
                      <p>{signal.reason}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
            {relatedFindings.length > 0 ? (
              <>
                <h4>Related findings</h4>
                <div className="findings-list">
                  {relatedFindings.map((finding, index) => (
                    <article key={`${finding.code}-${finding.explanation}-${index}`} className="finding">
                      <div className="trace-meta">
                        <span className="pill">{finding.code}</span>
                        <RiskBadge level={finding.severity === "critical" ? "critical" : finding.severity} />
                        <span className="muted">{(finding.confidence * 100).toFixed(0)}% confidence</span>
                      </div>
                      <p>{finding.explanation}</p>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <p className="muted">Select a node or edge to inspect its evidence and reasons.</p>
        )}
      </aside>
    </div>
  );
}

function applyRiskFilter(instance: Core, threshold: RiskFilterValue): void {
  const minimumLevel = getRiskThreshold(threshold);

  instance.nodes().forEach((node) => {
    const displayLevel = node.data("filterLevel") as string;
    const shouldShow = threshold === "all" || getRiskThreshold(displayLevel as RiskFilterValue | "unscored") >= minimumLevel;
    node.style("display", shouldShow ? "element" : "none");
  });

  instance.edges().forEach((edge) => {
    const sourceVisible = edge.source().style("display") !== "none";
    const targetVisible = edge.target().style("display") !== "none";
    edge.style("display", sourceVisible && targetVisible ? "element" : "none");
  });
}

function applyHighlightedPath(instance: Core, edgeIds: string[], highlightedEdgeIdsRef: MutableRefObject<string[]>): void {
  highlightedEdgeIdsRef.current.forEach((edgeId) => {
    instance.getElementById(edgeId).removeClass("highlighted");
  });

  edgeIds.forEach((edgeId) => {
    instance.getElementById(edgeId).addClass("highlighted");
  });

  highlightedEdgeIdsRef.current = edgeIds;
}

function getNodeColor(node: GraphNode): string {
  const displayLevel = getNodeDisplayLevel(node);
  if (displayLevel === "critical") {
    return RISK_COLORS.critical;
  }
  if (displayLevel === "high") {
    return RISK_COLORS.high;
  }
  if (displayLevel === "medium") {
    return RISK_COLORS.medium;
  }
  if (displayLevel === "low") {
    return RISK_COLORS.low;
  }
  return RISK_COLORS.unscored;
}

function getNodeDisplayLevel(node: GraphNode): GraphNode["riskLevel"] | "unscored" {
  if (node.riskScore <= 0 && node.riskConfidence <= 0 && node.riskSignals.length === 0) {
    return "unscored";
  }

  return node.riskLevel;
}

function getEdgeColor(riskScore: number): string {
  if (riskScore >= 60) {
    return "#c0392b";
  }
  if (riskScore >= 35) {
    return "#e67e22";
  }
  if (riskScore >= 15) {
    return "#f1c40f";
  }
  return "#bdc3c7";
}

function getRiskThreshold(value: RiskFilterValue | "unscored"): number {
  if (value === "critical") {
    return 4;
  }
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  if (value === "low") {
    return 1;
  }
  return 0;
}
