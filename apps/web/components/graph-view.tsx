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
  critical: "#E11D48",
  high: "#E11D48",
  medium: "#D97706",
  low: "#059669",
  unscored: "#64748B",
  focus: "#0EA5E9",
  focusDeep: "#2563EB"
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

  const triggerOnNodeSelect = (id: string | undefined): void => {
    if (!onNodeSelect) return;
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => onNodeSelect(id));
    } else {
      setTimeout(() => onNodeSelect(id), 0);
    }
  };

  const [focusSuspiciousPaths, setFocusSuspiciousPaths] = useState(Boolean(focusedPathEdgeIds?.length));
  const initialFocusedPathEdgeIds = useMemo(
    () =>
      focusedPathEdgeIds && focusedPathEdgeIds.length > 0
        ? focusedPathEdgeIds
        : suspiciousPaths[0]?.edgeIds ?? [],
    [focusedPathEdgeIds, suspiciousPaths]
  );

  useEffect(() => {
    const preferred =
      graph.nodes.find((node) => node.address.toLowerCase() === seedValue.toLowerCase()) ??
      graph.nodes[0];
    if (preferred) {
      triggerOnNodeSelect(preferred.id);
    }
  }, [graph.nodes, seedValue]);

  useEffect(() => {
    setFocusSuspiciousPaths(Boolean(initialFocusedPathEdgeIds.length));
  }, [initialFocusedPathEdgeIds.length]);

  useEffect(() => {
    if (!containerRef.current || graph.nodes.length === 0) {
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
        spacingFactor: 1.85,
        padding: 48,
        avoidOverlap: true,
        nodeDimensionsIncludeLabels: true
      },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "font-size": "11px",
            "font-family": "sans-serif",
            "font-weight": "bold",
            "background-color": "data(nodeColor)",
            color: "#1E293B",
            width: "data(nodeSize)",
            height: "data(nodeSize)",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "text-valign": "bottom",
            "text-margin-y": 8,
            "border-width": "3px",
            "border-color": "#FFFFFF",
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
            "font-size": "10px",
            "font-family": "monospace",
            "text-rotation": "autorotate",
            "text-background-color": "rgba(255, 255, 255, 0.92)",
            "text-background-opacity": 1,
            "text-background-padding": "4px",
            "text-margin-y": -10,
            color: "#334155",
            "min-zoomed-font-size": "10px",
            opacity: 0.85
          }
        },
        {
          selector: ".highlighted",
          style: {
            "line-color": RISK_COLORS.focus,
            "target-arrow-color": RISK_COLORS.focus,
            "line-style": "dashed",
            "line-dash-pattern": [6, 4],
            "line-dash-offset": 0,
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
            padding: "6px"
          }
        },
        {
          selector: ".dimmed",
          style: {
            opacity: 0.2
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

    let isDestroyed = false;

    // Pulsating animation for intermediate path/hop nodes
    let step = 0;
    const pulseInterval = setInterval(() => {
      if (isDestroyed) {
        clearInterval(pulseInterval);
        return;
      }
      step = (step + 1) % 2;
      const targetBorderWidth = step === 0 ? 8 : 3;
      const targetBorderColor = step === 0 ? "rgba(14, 165, 233, 0.95)" : "rgba(14, 165, 233, 0.25)";
      
      instance.nodes(".path-node").forEach((node) => {
        if (!node.hasClass("node-focused")) {
          node.animate({
            style: {
              "border-width": targetBorderWidth,
              "border-color": targetBorderColor
            }
          }, {
            duration: 800
          });
        }
      });
    }, 1000);

    // Pulsating animation for selected focused node
    const focusedPulseInterval = setInterval(() => {
      if (isDestroyed) {
        clearInterval(focusedPulseInterval);
        return;
      }
      const targetBorderWidth = step === 0 ? 9 : 4;
      const targetBorderColor = step === 0 ? "rgba(37, 99, 235, 0.95)" : "rgba(37, 99, 235, 0.35)";
      
      instance.nodes(".node-focused").forEach((node) => {
        node.animate({
          style: {
            "border-width": targetBorderWidth,
            "border-color": targetBorderColor
          }
        }, {
          duration: 800
        });
      });
    }, 1000);

    // Continuous flowing fund flow animation on the edge path
    let edgeOffset = 0;
    const edgeInterval = setInterval(() => {
      if (isDestroyed) {
        clearInterval(edgeInterval);
        return;
      }
      edgeOffset = (edgeOffset - 2) % 24;
      instance.edges(".highlighted").style("line-dash-offset", edgeOffset);
    }, 80);

    instance.on("tap", "node", (event) => {
      const node = graph.nodes.find((item) => item.id === event.target.id());
      if (node) {
        const path = suspiciousPaths
          .filter((candidate) => candidate.nodeIds.includes(node.id))
          .sort((left, right) => right.riskScore - left.riskScore)[0];
        applyPathHighlight(instance, path?.edgeIds ?? [], focusSuspiciousPaths);
        applyNodeFocus(instance, node.id);
        triggerOnNodeSelect(node.id);
      }
    });

    instance.on("tap", "edge", (event) => {
      const edge = graph.edges.find((item) => item.id === event.target.id());
      if (edge) {
        triggerOnNodeSelect(edge.id);
      }
    });

    return () => {
      isDestroyed = true;
      cyRef.current = null;
      resizeObserver.disconnect();
      clearInterval(pulseInterval);
      clearInterval(focusedPulseInterval);
      clearInterval(edgeInterval);
      instance.destroy();
    };
  }, [focusSuspiciousPaths, graph, initialFocusedPathEdgeIds, focusedNodeId, onCyReady, suspiciousPaths]);

  useEffect(() => {
    if (!cyRef.current) {
      return;
    }

    if (activeRiskFilters) {
      const activeFindings = findings.filter((f) => f.code === activeRiskFilters);
      const edgeIdsToHighlight = activeFindings.flatMap((f) => f.relatedEdgeIds);
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
    triggerOnNodeSelect(focusedNodeId);

    const matchingPath = suspiciousPaths
      .filter((path) => path.nodeIds.includes(focusedNodeId))
      .sort((left, right) => right.riskScore - left.riskScore)[0];
    applyPathHighlight(
      cyRef.current,
      matchingPath?.edgeIds ?? initialFocusedPathEdgeIds,
      focusSuspiciousPaths
    );

    const cyNode = cyRef.current.getElementById(focusedNodeId);
    if (cyNode.nonempty()) {
      cyRef.current.animate({
        fit: { eles: cyNode.closedNeighborhood(), padding: 90 },
        duration: 350
      });
    }
  }, [focusedNodeId, focusSuspiciousPaths, graph.nodes, initialFocusedPathEdgeIds, suspiciousPaths]);

  if (graph.nodes.length === 0) {
    return (
      <div className="graph-shell">
        <section className="graph-empty-state panel">
          <h3 className="font-display text-lg font-bold text-slate-800">No transaction graph available.</h3>
          <p className="muted">Try:</p>
          <ul className="graph-empty-list font-semibold">
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
          <label className="graph-toggle cursor-pointer select-none">
            <input
              checked={focusSuspiciousPaths}
              type="checkbox"
              className="accent-sky-600 rounded mr-2"
              onChange={(event) => setFocusSuspiciousPaths(event.target.checked)}
            />
            <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-600">
              Focus suspicious paths
            </span>
          </label>
        </div>

        <div className="absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 text-xs font-semibold shadow-sm backdrop-blur">
          <span className="font-display font-extrabold uppercase tracking-wider text-slate-500">Risk Ledger</span>
          <LegendDot color={RISK_COLORS.high} label="High" />
          <LegendDot color={RISK_COLORS.medium} label="Med" />
          <LegendDot color={RISK_COLORS.low} label="Low" />
          <span className="text-slate-300">·</span>
          <span className="text-slate-500 font-medium font-mono">Thicker line = larger transaction</span>
        </div>

        <div className="graph-canvas-wrap h-full min-h-[520px] bg-transparent shadow-none p-0 border-none">
          <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
            <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white/95 shadow-sm backdrop-blur">
              <button
                aria-label="Zoom in"
                className="flex h-10 w-10 items-center justify-center border-b border-slate-200 text-slate-500 cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-800 text-lg font-bold"
                type="button"
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.2)}
              >
                +
              </button>
              <button
                aria-label="Zoom out"
                className="flex h-10 w-10 items-center justify-center text-slate-500 cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-800 text-lg font-bold"
                type="button"
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
              >
                -
              </button>
            </div>
            <button
              className={buttonStyles("secondary")}
              type="button"
              onClick={() => cyRef.current?.fit(undefined, 48)}
            >
              Reset
            </button>
          </div>
          <div
            className="graph-canvas rounded-2xl"
            ref={containerRef}
            style={{ height: "100%", minHeight: "520px", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: color }} />
    <span className="font-extrabold text-slate-700">{label}</span>
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
  return 30 + Math.min(24, Math.round(riskScore * 0.24));
}

function getEdgeColor(riskScore: number): string {
  if (riskScore >= 60) {
    return RISK_COLORS.high;
  }
  if (riskScore >= 30) {
    return RISK_COLORS.medium;
  }
  if (riskScore >= 10) {
    return "#059669";
  }
  return "#64748B";
}

function getEdgeWidth(amount: number, maxAmount: number): number {
  const normalized = maxAmount <= 0 ? 0 : amount / maxAmount;
  return Number((1.2 + normalized * 1.8).toFixed(2));
}
