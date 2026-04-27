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
  onNodeSelect?: (id: string | undefined) => void;
  investigationConclusion?: string;
  activeRiskFilters?: string | null;
  onCyReady?: (instance: Core) => void;
}

const RISK_COLORS = {
  critical: "hsl(350, 89%, 60%)",
  high: "hsl(350, 89%, 60%)",
  medium: "hsl(35, 92%, 50%)",
  low: "hsl(160, 84%, 39%)",
  unscored: "hsl(215, 16%, 47%)"
} as const;

export function GraphView({
  graph,
  findings,
  seedValue,
  suspiciousPaths,
  focusedPathEdgeIds,
  focusedNodeId,
  onNodeSelect,
  investigationConclusion,
  activeRiskFilters,
  onCyReady
}: GraphViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
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
    const minTime = Math.min(...graph.edges.map((edge) => Date.parse(edge.timestamp)));
    
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
        ...graph.edges.map((edge) => {
          const minAfter = Math.max(0, Math.floor((Date.parse(edge.timestamp) - minTime) / 60000));
          return {
            data: {
              id: edge.id,
              source: edge.from,
              target: edge.to,
              label: `${edge.amount.toFixed(2)} ${edge.asset} • ${minAfter} min`,
              riskScore: edge.riskScore,
              chain: edge.chain,
              edgeColor: getEdgeColor(edge.riskScore),
              edgeWidth: getEdgeWidth(edge.amount, maxEdgeAmount)
            }
          };
        })
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
            "font-size": "10.5px",
            "font-family": "monospace",
            "text-rotation": "autorotate",
            "text-background-color": "rgba(255, 255, 255, 0.85)",
            "text-background-opacity": 1,
            "text-background-padding": "3px",
            "text-margin-y": -10,
            color: "hsl(var(--foreground))"
          }
        },
        {
          selector: ".highlighted",
          style: {
            "line-color": "hsl(350, 89%, 60%)",
            "target-arrow-color": "hsl(350, 89%, 60%)",
            "line-style": "solid",
            width: 4,
            opacity: 1,
            "z-index": 9
          }
        },
        {
          selector: ".path-node",
          style: {
            "border-color": "hsl(350, 89%, 60%)",
            "border-width": 4,
            opacity: 1,
            "z-index": 10
          }
        },
        {
          selector: ".node-focused",
          style: {
            "border-color": "hsl(var(--foreground))",
            "border-style": "dashed",
            "border-width": 2,
            "padding": "5px"
          }
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.15
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
    applyGraphVisibility(instance, activeRiskFilters);
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
        if (onNodeSelect) onNodeSelect(node.id);
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

    if (activeRiskFilters) {
      const activeFindings = findings.filter(f => f.code === activeRiskFilters);
      const edgeIdsToHighlight = activeFindings.flatMap(f => f.relatedEdgeIds);
      applyPathHighlight(cyRef.current, edgeIdsToHighlight, true);
    } else {
      applyPathHighlight(cyRef.current, initialFocusedPathEdgeIds, focusSuspiciousPaths);
    }
  }, [activeRiskFilters, findings, initialFocusedPathEdgeIds, focusSuspiciousPaths]);

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
    <div className="graph-shell border-none shadow-none bg-surface-subtle p-0 m-0">
      <div className="graph-main" style={{ width: "100%", position: "relative" }}>
        <div className="graph-filters absolute top-3 left-3 z-10 hidden">
          <label className="graph-toggle">
            <input
              checked={focusSuspiciousPaths}
              type="checkbox"
              onChange={(event) => setFocusSuspiciousPaths(event.target.checked)}
            />
            <span>Focus suspicious paths</span>
          </label>
        </div>

        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[10px] shadow-xs backdrop-blur z-10">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Risk</span>
          <LegendDot color={RISK_COLORS.high} label="High" />
          <LegendDot color={RISK_COLORS.medium} label="Med" />
          <LegendDot color={RISK_COLORS.low} label="Low" />
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">node = risk · edge = amount</span>
        </div>

        <div className="graph-canvas-wrap border-none" style={{ background: "transparent" }}>
          <div className="graph-controls">
            <button aria-label="Zoom in" className="graph-control-button" type="button" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}>+</button>
            <button aria-label="Zoom out" className="graph-control-button" type="button" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}>-</button>
            <button className="graph-control-button graph-control-reset" type="button" onClick={() => cyRef.current?.fit(undefined, 24)}>Reset view</button>
          </div>
          <div className="graph-canvas" ref={containerRef} style={{ height: "580px", minHeight: "580px", width: "100%" }} />
        </div>
      </div>
    </div>
  );
}

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
    <span className="font-medium text-foreground">{label}</span>
  </span>
);

function applyGraphVisibility(instance: Core, activeRiskFilter: string | null | undefined): void {
  // We handle visibility via applyPathHighlight now.
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
