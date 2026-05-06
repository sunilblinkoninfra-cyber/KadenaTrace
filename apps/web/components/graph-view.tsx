"use client";

import cytoscape, { type Core } from "cytoscape";
import Link from "next/link";
import { useEffect, useRef, useState, useMemo, type ReactElement } from "react";

import type { Finding, GraphEdge, GraphNode, SuspiciousPath, TraceGraph } from "@kadenatrace/shared/client";

import { buttonStyles } from "./ui";

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
  const [focusSuspiciousPaths, setFocusSuspiciousPaths] = useState(Boolean(focusedPathEdgeIds?.length));
  const initialFocusedPathEdgeIds = useMemo(() => 
    focusedPathEdgeIds && focusedPathEdgeIds.length > 0
      ? focusedPathEdgeIds
      : suspiciousPaths[0]?.edgeIds ?? [],
    [focusedPathEdgeIds, suspiciousPaths]
  );

  useEffect(() => {
    const preferred = graph.nodes.find((node) => node.address.toLowerCase() === seedValue.toLowerCase()) ?? graph.nodes[0];
    if (preferred) {
      onNodeSelect?.(preferred.id);
    }
  }, [graph.nodes, onNodeSelect, seedValue]);

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
        padding: 48
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
            "font-size": "12px",
            "font-family": "monospace",
            "text-rotation": "autorotate",
            "text-background-color": "rgba(10, 16, 27, 0.92)",
            "text-background-opacity": 1,
            "text-background-padding": "4px",
            "text-margin-y": -10,
            color: "#E2E8F0",
            "min-zoomed-font-size": "10px",
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
      instance.fit(undefined, 48);
    });
    const resizeObserver = new ResizeObserver(() => {
      instance.resize();
      instance.fit(undefined, 48);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    onCyReady?.(instance);
    applyPathHighlight(instance, initialFocusedPathEdgeIds, focusSuspiciousPaths);
    applyNodeFocus(instance, focusedNodeId);

    instance.on("tap", "node", (event) => {
      const node = graph.nodes.find((item) => item.id === event.target.id());
      if (node) {
        const path = suspiciousPaths
          .filter((candidate) => candidate.nodeIds.includes(node.id))
          .sort((left, right) => right.riskScore - left.riskScore)[0];
        applyPathHighlight(instance, path?.edgeIds ?? [], focusSuspiciousPaths);
        applyNodeFocus(instance, node.id);
        onNodeSelect?.(node.id);
      }
    });

    instance.on("tap", "edge", (event) => {
      const edge = graph.edges.find((item) => item.id === event.target.id());
      if (edge) {
        onNodeSelect?.(edge.id);
      }
    });

    return () => {
      cyRef.current = null;
      resizeObserver.disconnect();
      instance.destroy();
    };
  }, [focusSuspiciousPaths, graph, initialFocusedPathEdgeIds, focusedNodeId, onCyReady, onNodeSelect, seedValue, suspiciousPaths]);

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
    applyNodeFocus(cyRef.current, focusedNodeId);
    onNodeSelect?.(focusedNodeId);

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
  }, [focusedNodeId, focusSuspiciousPaths, graph.nodes, initialFocusedPathEdgeIds, onNodeSelect, suspiciousPaths]);

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
    <div className="graph-shell h-full gap-0 bg-transparent p-0">
      <div className="graph-main h-full min-h-[520px] w-full">
        <div className="graph-filters absolute left-4 top-4 z-10">
          <label className="graph-toggle">
            <input
              checked={focusSuspiciousPaths}
              type="checkbox"
              onChange={(event) => setFocusSuspiciousPaths(event.target.checked)}
            />
            <span>Focus suspicious paths</span>
          </label>
        </div>

        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
          <span className="font-medium uppercase tracking-wider text-muted-foreground">Risk</span>
          <LegendDot color={RISK_COLORS.high} label="High" />
          <LegendDot color={RISK_COLORS.medium} label="Med" />
          <LegendDot color={RISK_COLORS.low} label="Low" />
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">Thicker edge = higher value</span>
        </div>

        <div className="graph-canvas-wrap h-full min-h-[520px] bg-transparent shadow-none">
          <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
            <div className="flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/90 shadow-sm backdrop-blur">
              <button aria-label="Zoom in" className="flex h-10 w-10 items-center justify-center border-b border-gray-800 text-muted-foreground transition-colors hover:bg-gray-800 hover:text-foreground" type="button" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}>+</button>
              <button aria-label="Zoom out" className="flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:bg-gray-800 hover:text-foreground" type="button" onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}>-</button>
            </div>
            <button className={buttonStyles("secondary")} type="button" onClick={() => cyRef.current?.fit(undefined, 48)}>Reset</button>
          </div>
          <div className="graph-canvas rounded-lg" ref={containerRef} style={{ height: "100%", minHeight: "488px", width: "100%" }} />
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
  return 28 + Math.min(24, Math.round(riskScore * 0.24));
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
