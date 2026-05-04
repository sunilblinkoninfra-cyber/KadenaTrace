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
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-cyan/10 px-2.5 py-0.5 text-xs font-semibold text-cyan">Graph Investigation</span>
            <h2 className="font-display text-2xl font-bold text-foreground">{props.title}</h2>
            <p className="text-sm text-muted-foreground">{props.subtitle}</p>
          </div>
          {props.exportBaseName ? (
            <details className="relative group">
              <summary className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary">
                Export graph
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 flex w-40 flex-col rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-secondary focus:bg-secondary" type="button" onClick={downloadJson}>Export JSON</button>
                <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-secondary focus:bg-secondary" type="button" onClick={downloadCsv}>Export CSV</button>
                <button className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-secondary focus:bg-secondary" type="button" onClick={downloadPng}>Export PNG</button>
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
