"use client";

import cytoscape, { type Core } from "cytoscape";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactElement } from "react";

import type { Chain, Finding, GraphEdge, GraphNode, SuspiciousPath, TraceGraph } from "@kadenatrace/shared";

import { formatChainLabel } from "../lib/investigation";
import { RiskBadge } from "./risk-badge";

type SelectionState =
  | { type: "node"; payload: GraphNode }
  | { type: "edge"; payload: GraphEdge };

type RiskFilterValue = "all" | "low" | "medium" | "high" | "critical";
type ChainFilterValue = "all" | Chain;

interface GraphViewProps {
  graph: TraceGraph;
  findings: Finding[];
  seedValue: string;
  suspiciousPaths: SuspiciousPath[];
  focusedPathEdgeIds?: string[];
  focusedNodeId?: string;
  investigationConclusion?: string;
  onCyReady?: (instance: Core) => void;
}

const RISK_COLORS = {
  critical: "#B42318",
  high: "#D92D20",
  medium: "#F4B400",
  low: "#16A34A",
  unscored: "#94A3B8"
} as const;

export function GraphView({
  graph,
  findings,
  seedValue,
  suspiciousPaths,
  focusedPathEdgeIds,
  focusedNodeId,
  investigationConclusion,
  onCyReady
}: GraphViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskFilterValue>("all");
  const [chainFilter, setChainFilter] = useState<ChainFilterValue>("all");
  const [focusSuspiciousPaths, setFocusSuspiciousPaths] = useState(Boolean(focusedPathEdgeIds?.length));

  const availableChains = Array.from(new Set(graph.nodes.map((node) => node.chain)));
  const initialFocusedPathEdgeIds =
    focusedPathEdgeIds && focusedPathEdgeIds.length > 0
      ? focusedPathEdgeIds
      : suspiciousPaths[0]?.edgeIds ?? [];

  useEffect(() => {
    const preferred = graph.nodes.find((node) => node.address.toLowerCase() === seedValue.toLowerCase()) ?? graph.nodes[0];
    if (preferred) {
      setSelection({ type: "node", payload: preferred });
    }
  }, [graph.nodes, seedValue]);

  useEffect(() => {
    setFocusSuspiciousPaths(Boolean(initialFocusedPathEdgeIds.length));
  }, [initialFocusedPathEdgeIds.length]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (graph.nodes.length === 0) {
      return;
    }

    const maxEdgeAmount = Math.max(...graph.edges.map((edge) => edge.amount), 1);
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
            chain: node.chain,
            nodeColor: getNodeColor(node),
            nodeSize: getNodeSize(node.riskScore)
          }
        })),
        ...graph.edges.map((edge) => ({
          data: {
            id: edge.id,
            source: edge.from,
            target: edge.to,
            label: `${edge.amount.toFixed(4)} ${edge.asset}`,
            sublabel: new Date(edge.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric"
            }),
            riskScore: edge.riskScore,
            chain: edge.chain,
            edgeColor: getEdgeColor(edge.riskScore),
            edgeWidth: getEdgeWidth(edge.amount, maxEdgeAmount)
          }
        }))
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.2,
        padding: 24
      },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "12px",
            "background-color": "data(nodeColor)",
            color: "#1b1d27",
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-valign": "bottom",
            "text-margin-y": 12,
            "border-width": "2px",
            "border-color": "#fff9f2",
            opacity: 1
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
            width: 2.5,
            "line-color": "data(edgeColor)",
            "target-arrow-color": "data(edgeColor)",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            content: "data(label)",
            "font-size": "10px",
            "text-rotation": "autorotate",
            "text-background-color": "#ffffff",
            "text-background-opacity": 0.85,
            "text-background-padding": "3px",
            "text-margin-y": -10,
            "text-border-width": 0,
            color: "#333333"
          }
        },
        {
          selector: ".highlighted",
          style: {
            "line-color": "#7C3AED",
            "target-arrow-color": "#7C3AED",
            "line-style": "solid",
            width: 7,
            opacity: 1,
            "z-index": 9
          }
        },
        {
          selector: "edge:selected",
          style: {
            content: "data(sublabel)",
            "font-size": "10px",
            "text-background-color": "#1D9E75",
            "text-background-opacity": 1,
            color: "#ffffff",
            "text-background-padding": "4px",
            width: 4
          }
        },
        {
          selector: ".path-node",
          style: {
            "border-color": "#7C3AED",
            "border-width": 4,
            opacity: 1,
            "z-index": 10
          }
        },
        {
          selector: ".node-focused",
          style: {
            "border-color": "#0F766E",
            "border-width": 5
          }
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.18
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
      instance.fit(undefined, 24);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    onCyReady?.(instance);
    applyGraphVisibility(instance, riskFilter, chainFilter);
    applyPathHighlight(instance, initialFocusedPathEdgeIds, focusSuspiciousPaths);
    applyNodeFocus(instance, focusedNodeId);

    instance.on("tap", "node", (event) => {
      const node = graph.nodes.find((item) => item.id === event.target.id());
      if (node) {
        setSelection({ type: "node", payload: node });
        const path = suspiciousPaths
          .filter((candidate) => candidate.nodeIds.includes(node.id))
          .sort((left, right) => right.riskScore - left.riskScore)[0];
        applyPathHighlight(instance, path?.edgeIds ?? [], focusSuspiciousPaths);
        applyNodeFocus(instance, node.id);
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

    applyGraphVisibility(cyRef.current, riskFilter, chainFilter);
  }, [riskFilter, chainFilter]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }

    applyPathHighlight(cyRef.current, initialFocusedPathEdgeIds, focusSuspiciousPaths);
  }, [initialFocusedPathEdgeIds, focusSuspiciousPaths]);

  useEffect(() => {
    if (!cyRef.current || !focusedNodeId) {
      return;
    }

    const node = graph.nodes.find((item) => item.id === focusedNodeId);
    if (!node) {
      return;
    }

    setSelection({ type: "node", payload: node });
    applyNodeFocus(cyRef.current, focusedNodeId);

    const matchingPath = suspiciousPaths
      .filter((path) => path.nodeIds.includes(focusedNodeId))
      .sort((left, right) => right.riskScore - left.riskScore)[0];
    applyPathHighlight(cyRef.current, matchingPath?.edgeIds ?? initialFocusedPathEdgeIds, focusSuspiciousPaths);

    const cyNode = cyRef.current.getElementById(focusedNodeId);
    if (cyNode.nonempty()) {
      cyRef.current.animate({
        fit: { eles: cyNode.closedNeighborhood(), padding: 90 },
        duration: 350
      });
    }
  }, [focusedNodeId, graph.nodes, suspiciousPaths, initialFocusedPathEdgeIds, focusSuspiciousPaths]);

  const relatedFindings = selection
    ? findings.filter((finding) =>
        selection.type === "node"
          ? finding.relatedNodeIds.includes(selection.payload.id)
          : finding.relatedEdgeIds.includes(selection.payload.id)
      )
    : [];

  const primaryReason = selection ? getPrimaryReason(selection.payload, relatedFindings) : null;

  if (graph.nodes.length === 0 && findings.length === 0) {
    return (
      <div className="graph-shell">
        <section className="graph-empty-state panel">
          <h3>No transaction graph available.</h3>
          <p className="muted">Try:</p>
          <ul className="graph-empty-list">
            <li>Using demo case</li>
            <li>Checking wallet address</li>
          </ul>
          <div className="actions">
            <button className="ghost-button" type="button" onClick={() => window.location.reload()}>
              Retry
            </button>
            <Link className="ghost-button" href="/trace/demo">
              Use Demo Case
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="graph-shell">
      <div className="graph-main">
        <div className="graph-filters">
          <label className="graph-filter" htmlFor="risk-filter">
            <span>Risk</span>
            <select
              id="risk-filter"
              value={riskFilter}
              onChange={(event) => setRiskFilter(event.target.value as RiskFilterValue)}
            >
              <option value="all">All</option>
              <option value="low">Low+</option>
              <option value="medium">Medium+</option>
              <option value="high">High+</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label className="graph-filter" htmlFor="chain-filter">
            <span>Chain</span>
            <select
              id="chain-filter"
              value={chainFilter}
              onChange={(event) => setChainFilter(event.target.value as ChainFilterValue)}
            >
              <option value="all">All chains</option>
              {availableChains.map((chain) => (
                <option key={chain} value={chain}>
                  {formatChainLabel(chain)}
                </option>
              ))}
            </select>
          </label>

          <label className="graph-toggle">
            <input
              checked={focusSuspiciousPaths}
              type="checkbox"
              onChange={(event) => setFocusSuspiciousPaths(event.target.checked)}
            />
            <span>Focus suspicious paths</span>
          </label>
        </div>

        <div className="risk-legend risk-legend--graph">
          {[
            ["Red", RISK_COLORS.high, "High risk"],
            ["Yellow", RISK_COLORS.medium, "Medium risk"],
            ["Green", RISK_COLORS.low, "Low risk"],
            ["Thicker edge", "#475467", "Higher value transfer"]
          ].map(([label, color, description]) => (
            <span key={label} className="risk-legend-item">
              <span className="risk-legend-swatch" style={{ backgroundColor: color }} />
              <strong>{label}</strong> = {description}
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
                cyRef.current?.fit(undefined, 24);
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
            {investigationConclusion ? (
              <article className="detail-callout">
                <span className="pill">Investigation conclusion</span>
                <p>{investigationConclusion}</p>
              </article>
            ) : null}

            <div className="trace-meta">
              <span className="pill">{selection.type}</span>
              {selection.type === "node" ? <RiskBadge level={selection.payload.riskLevel} /> : null}
              <span className="muted">
                Confidence {(selection.payload.riskConfidence * 100).toFixed(0)}%
              </span>
            </div>

            <h3>
              Risk: {selection.type === "node" ? selection.payload.riskLevel.toUpperCase() : inferEdgeRiskLevel(selection.payload)}
              {" "}
              ({Math.round(selection.payload.riskScore)}%)
            </h3>
            {primaryReason ? <p className="detail-primary-reason">{primaryReason}</p> : null}

            <details className="detail-advanced" open={selection.type === "edge"}>
              <summary>Show details</summary>

              {selection.type === "node" ? (
                <div className="facts">
                  <span className="code">{selection.payload.address}</span>
                  <span className="muted">Kind: {selection.payload.kind}</span>
                  <span className="muted">Tags: {selection.payload.tags.join(", ") || "none"}</span>
                  <span className="muted">Seed exposure: {selection.payload.valueFromSeedPct.toFixed(1)}%</span>
                  {selection.payload.riskScore > 0 ? (
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
                          {selection.payload.riskSignals.map((signal) => (
                            <tr key={`${signal.code}-${signal.reason}`}>
                              <td>{signal.title}</td>
                              <td>+{signal.weight}</td>
                              <td>{(signal.confidence * 100).toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div className="facts">
                  <span className="code">{selection.payload.txHash}</span>
                  <span className="muted">
                    {formatAmount(selection.payload.amount)} {selection.payload.asset}
                  </span>
                  <span className="muted">
                    Propagated: {selection.payload.propagatedAmount.toFixed(4)} {selection.payload.asset}
                  </span>
                  <span className="muted">
                    Seed exposure: {selection.payload.valueFromSeedPct.toFixed(1)}%
                  </span>
                  <span className="muted">{new Date(selection.payload.timestamp).toLocaleString()}</span>
                </div>
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
            </details>
          </>
        ) : (
          <p className="muted">Select a node or edge to inspect its evidence, confidence, and why it was highlighted.</p>
        )}
      </aside>
    </div>
  );
}

function applyGraphVisibility(instance: Core, riskFilter: RiskFilterValue, chainFilter: ChainFilterValue): void {
  const minimumLevel = getRiskThreshold(riskFilter);

  instance.nodes().forEach((node) => {
    const displayLevel = node.data("filterLevel") as string;
    const nodeChain = node.data("chain") as Chain;
    const passesRisk =
      riskFilter === "all" || getRiskThreshold(displayLevel as RiskFilterValue | "unscored") >= minimumLevel;
    const passesChain = chainFilter === "all" || nodeChain === chainFilter;
    node.style("display", passesRisk && passesChain ? "element" : "none");
  });

  instance.edges().forEach((edge) => {
    const edgeChain = edge.data("chain") as Chain;
    const sourceVisible = edge.source().style("display") !== "none";
    const targetVisible = edge.target().style("display") !== "none";
    const passesChain = chainFilter === "all" || edgeChain === chainFilter;
    edge.style("display", sourceVisible && targetVisible && passesChain ? "element" : "none");
  });
}

function applyPathHighlight(instance: Core, edgeIds: string[], focusOnly: boolean): void {
  instance.elements().removeClass("highlighted").removeClass("path-node").removeClass("dimmed");

  if (edgeIds.length === 0) {
    return;
  }

  const highlightedEdges = edgeIds
    .map((edgeId) => instance.getElementById(edgeId))
    .filter((element) => element.nonempty());
  if (highlightedEdges.length === 0) {
    return;
  }

  const pathNodes = new Set<string>();
  highlightedEdges.forEach((edge) => {
    edge.addClass("highlighted");
    pathNodes.add(edge.data("source") as string);
    pathNodes.add(edge.data("target") as string);
  });

  pathNodes.forEach((nodeId) => {
    instance.getElementById(nodeId).addClass("path-node");
  });

  if (!focusOnly) {
    return;
  }

  instance.nodes().forEach((node) => {
    if (!pathNodes.has(node.id())) {
      node.addClass("dimmed");
    }
  });

  instance.edges().forEach((edge) => {
    if (!edgeIds.includes(edge.id())) {
      edge.addClass("dimmed");
    }
  });
}

function applyNodeFocus(instance: Core, nodeId: string | undefined): void {
  instance.nodes().removeClass("node-focused");
  if (!nodeId) {
    return;
  }

  const node = instance.getElementById(nodeId);
  if (node.nonempty()) {
    node.addClass("node-focused");
  }
}

function getNodeColor(node: GraphNode): string {
  const displayLevel = getNodeDisplayLevel(node);
  if (displayLevel === "critical" || displayLevel === "high") {
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

function getNodeSize(riskScore: number): number {
  return 32 + Math.min(28, Math.round(riskScore * 0.28));
}

function getEdgeColor(riskScore: number): string {
  if (riskScore >= 60) {
    return RISK_COLORS.high;
  }
  if (riskScore >= 30) {
    return "#F59E0B";
  }
  if (riskScore >= 10) {
    return "#84CC16";
  }
  return "#94A3B8";
}

function getEdgeWidth(amount: number, maxAmount: number): number {
  const normalized = maxAmount <= 0 ? 0 : amount / maxAmount;
  return Number((2.5 + normalized * 5).toFixed(2));
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

function getPrimaryReason(
  item: GraphNode | GraphEdge,
  relatedFindings: Finding[]
): string {
  if (item.reasons[0]) {
    return item.reasons[0];
  }
  if (item.riskSignals[0]?.reason) {
    return item.riskSignals[0].reason;
  }
  if (relatedFindings[0]?.explanation) {
    return relatedFindings[0].explanation;
  }
  return "This entity is part of the traced movement path and contributes to the overall risk score.";
}

function inferEdgeRiskLevel(edge: GraphEdge): string {
  if (edge.riskScore >= 80) {
    return "CRITICAL";
  }
  if (edge.riskScore >= 60) {
    return "HIGH";
  }
  if (edge.riskScore >= 30) {
    return "MEDIUM";
  }
  return "LOW";
}

function formatAmount(amount: number): string {
  return Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2);
}
