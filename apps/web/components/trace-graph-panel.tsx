// TraceGraphPanel -- Couples graph rendering, export controls, and suspicious-path focus state.
"use client";
import type { Core } from "cytoscape";
import { useEffect, useRef, useState, type ReactElement } from "react";

import type { Finding, SuspiciousPath, TraceGraph, TraceMetrics } from "@kadenatrace/shared";

import { serializeEdgesCsv, serializeGraphExportJson, serializeNodesCsv } from "../lib/export";
import { GraphView } from "./graph-view";
import { SuspiciousPaths } from "./suspicious-paths";
import { DetailPanel } from "./detail-panel";

interface TraceGraphPanelProps {
  graph: TraceGraph;
  findings: Finding[];
  metrics: TraceMetrics;
  suspiciousPaths: SuspiciousPath[];
  seedValue: string;
  title: string;
  subtitle: string;
  exportBaseName?: string;
  focusedNodeId?: string;
  onNodeSelect?: (id: string | undefined) => void;
  investigationConclusion?: string;
  activeRiskFilters?: string | null;
}

export function TraceGraphPanel(props: TraceGraphPanelProps): ReactElement {
  const [focusedPathEdgeIds, setFocusedPathEdgeIds] = useState<string[]>(
    props.suspiciousPaths[0]?.edgeIds ?? []
  );
  const cyRef = useRef<Core | null>(null);

  const downloadJson = (): void => {
    const content = serializeGraphExportJson({
      nodes: props.graph.nodes,
      edges: props.graph.edges,
      findings: props.findings,
      metrics: props.metrics
    });
    downloadBlob(`${props.exportBaseName ?? "kadenatrace-graph"}.json`, content, "application/json");
  };

  const downloadCsv = (): void => {
    downloadBlob(`${props.exportBaseName ?? "kadenatrace-graph"}-nodes.csv`, serializeNodesCsv(props.graph.nodes), "text/csv");
    downloadBlob(`${props.exportBaseName ?? "kadenatrace-graph"}-edges.csv`, serializeEdgesCsv(props.graph.edges), "text/csv");
  };

  const downloadPng = (): void => {
    const instance = cyRef.current;
    if (!instance) return;
    const png = instance.png({ output: "blob", bg: "#ffffff", scale: 2 });
    if (png instanceof Blob) {
      const url = URL.createObjectURL(png);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${props.exportBaseName ?? "kadenatrace-graph"}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  };

  useEffect(() => {
    if (props.focusedNodeId) {
      const focusPath = props.suspiciousPaths
        .filter((path) => path.nodeIds.includes(props.focusedNodeId ?? ""))
        .sort((left, right) => right.riskScore - left.riskScore)[0];

      if (focusPath) {
        setFocusedPathEdgeIds([...focusPath.edgeIds]);
        return;
      }
    }

    if (props.suspiciousPaths[0]) {
      setFocusedPathEdgeIds([...props.suspiciousPaths[0].edgeIds]);
      return;
    }

    setFocusedPathEdgeIds([]);
  }, [props.focusedNodeId, props.suspiciousPaths]);

  return (
    <>
      <section className="panel stack">
        <div className="page-header">
          <div>
            <span className="pill">Graph Investigation</span>
            <h2 className="section-title">{props.title}</h2>
            <p className="muted">{props.subtitle}</p>
          </div>
          {props.exportBaseName ? (
            <details className="export-menu">
              <summary className="ghost-button">Export graph</summary>
              <div className="export-menu-panel">
                <button className="ghost-button" type="button" onClick={downloadJson}>
                  Export JSON
                </button>
                <button className="ghost-button" type="button" onClick={downloadCsv}>
                  Export CSV
                </button>
                <button className="ghost-button" type="button" onClick={downloadPng}>
                  Export PNG
                </button>
              </div>
            </details>
          ) : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="rounded-xl border border-border bg-card shadow-card lg:col-span-8 overflow-hidden">
            <GraphView
              graph={props.graph}
              findings={props.findings}
              seedValue={props.seedValue}
              suspiciousPaths={props.suspiciousPaths}
              focusedPathEdgeIds={focusedPathEdgeIds}
              focusedNodeId={props.focusedNodeId}
              onNodeSelect={props.onNodeSelect}
              investigationConclusion={props.investigationConclusion}
              activeRiskFilters={props.activeRiskFilters}
              onCyReady={(instance) => { cyRef.current = instance; }}
            />
          </div>
          <aside className="lg:col-span-4 h-[580px]">
            <DetailPanel graph={props.graph} findings={props.findings} selectedId={props.focusedNodeId || null} />
          </aside>
        </div>
      </section>

      <SuspiciousPaths
        graph={props.graph}
        paths={props.suspiciousPaths}
        onFocusPath={(edgeIds) => setFocusedPathEdgeIds([...edgeIds])}
      />
    </>
  );
}

function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
