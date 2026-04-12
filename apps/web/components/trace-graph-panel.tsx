// TraceGraphPanel -- Couples graph rendering, export controls, and suspicious-path focus state.
"use client";
import type { Core } from "cytoscape";
import { useRef, useState, type ReactElement } from "react";

import type { Finding, SuspiciousPath, TraceGraph, TraceMetrics } from "@kadenatrace/shared";

import { serializeEdgesCsv, serializeGraphExportJson, serializeNodesCsv } from "../lib/export";
import { GraphView } from "./graph-view";
import { SuspiciousPaths } from "./suspicious-paths";

interface TraceGraphPanelProps {
  graph: TraceGraph;
  findings: Finding[];
  metrics: TraceMetrics;
  suspiciousPaths: SuspiciousPath[];
  seedValue: string;
  title: string;
  subtitle: string;
  exportBaseName?: string;
}

export function TraceGraphPanel(props: TraceGraphPanelProps): ReactElement {
  const [focusedPathEdgeIds, setFocusedPathEdgeIds] = useState<string[]>([]);
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
        <GraphView
          graph={props.graph}
          findings={props.findings}
          seedValue={props.seedValue}
          suspiciousPaths={props.suspiciousPaths}
          focusedPathEdgeIds={focusedPathEdgeIds}
          onCyReady={(instance) => { cyRef.current = instance; }}
        />
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
