"use client";

import cytoscape, { type Core } from "cytoscape";
import Link from "next/link";
import { useEffect, useRef, useState, useMemo, type ReactElement } from "react";

import type { Chain, Finding, GraphEdge, GraphNode, SuspiciousPath, TraceGraph } from "@kadenatrace/shared/client";

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
  critical: "#E5484D",
  high: "#E5484D",
  medium: "#F5B43B",
  low: "#1F9D68",
  unscored: "#94A3B8",
  focus: "#1D9BF0",
  focusDeep: "#1D4ED8"
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
  const initialFocusedPathEdgeIds = useMemo(() => 
    focusedPathEdgeIds && focusedPathEdgeIds.length > 0
      ? focusedPathEdgeIds
      : suspiciousPaths[0]?.edgeIds ?? [],
    [focusedPathEdgeIds, suspiciousPaths]
  );

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
            color: "#10203A",
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-valign": "bottom",
            "text-margin-y": 12,
            "border-width": "2.5px",
            "border-color": "#F8FBFF",
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
            width: "data(edgeWidth)",
            "line-color": "data(edgeColor)",
            "target-arrow-color": "data(edgeColor)",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            content: "data(label)",
            "font-size": "10.5px",
            "font-family": "monospace",
            "text-rotation": "autorotate",
            "text-background-color": "rgba(255, 255, 255, 0.94)",
            "text-background-opacity": 1,
            "text-background-padding": "4px",
            "text-margin-y": -10,
            color: "#344256",
            opacity: 0.82
          }
        },
        {
          selector: ".highlighted",
          style: {
            "line-color": RISK_COLORS.focus,
            "target-arrow-color": RISK_COLORS.focus,
            "line-style": "solid",
            width: 4.5,
            opacity: 1,
            "z-index": 9
          }
        },
        {
          selector: ".path-node",
          style: {
            "border-color": RISK_COLORS.focus,
            "border-width": 4,
            opacity: 1,
            "z-index": 10
          }
        },
        {
          selector: ".node-focused",
          style: {
            "border-color": RISK_COLORS.focusDeep,
            "border-style": "solid",
            "border-width": 5,
            "padding": "6px"
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

    setSelection((prev) => 
      prev?.type === "node" && prev.payload.id === node.id 
        ? prev 
        : { type: "node", payload: node }
    );
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

        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[10px] shadow-sm backdrop-blur">
          <span className="font-semibold uppercase tracking-wider text-muted-foreground">Risk</span>
          <LegendDot color={RISK_COLORS.high} label="High" />
          <LegendDot color={RISK_COLORS.medium} label="Med" />
          <LegendDot color={RISK_COLORS.low} label="Low" />
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Thicker edge = higher value</span>
        </div>

        <div className="graph-canvas-wrap border-none" style={{ background: "transparent" }}>
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <div className="flex flex-col overflow-hidden rounded-md border border-border bg-card/90 shadow-sm backdrop-blur">
              <button aria-label="Zoom in" className="flex h-8 w-8 items-center justify-center border-b border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" type="button" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}>+</button>
              <button aria-label="Zoom out" className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" type="button" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}>-</button>
            </div>
            <button className="rounded-md border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur hover:bg-secondary hover:text-foreground transition-colors" type="button" onClick={() => cyRef.current?.fit(undefined, 24)}>Reset</button>
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
    return RISK_COLORS.medium;
  }
  if (riskScore >= 10) {
    return "#73C48F";
  }
  return "#B7C4D7";
}

function getEdgeWidth(amount: number, maxAmount: number): number {
  const normalized = maxAmount <= 0 ? 0 : amount / maxAmount;
  return Number((1.0 + normalized * 1.5).toFixed(2));
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
