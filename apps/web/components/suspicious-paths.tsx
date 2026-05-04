import { type ReactElement } from "react";

import type { SuspiciousPath, TraceGraph } from "@kadenatrace/shared";

import { RiskBadge } from "./risk-badge";

export function SuspiciousPaths({
  graph,
  paths,
  onFocusPath
}: {
  graph: TraceGraph;
  paths: SuspiciousPath[];
  onFocusPath?: (edgeIds: string[]) => void;
}): ReactElement {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return (
    <section className="mx-auto max-w-7xl px-6 pt-10 pb-20">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Suspicious Paths
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground">Top risk-ranked movement paths</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {paths.length > 0 ? (
          paths.map((path, index) => {
            const start = nodeById.get(path.startNodeId);
            const end = nodeById.get(path.endNodeId);
            const content = (
              <>
                <div className="mb-3 flex items-center flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-foreground border border-border">Path {index + 1}</span>
                  <RiskBadge level={path.riskScore >= 80 ? "critical" : path.riskScore >= 60 ? "high" : "medium"} />
                  <span className="text-xs font-medium text-muted-foreground">{(path.confidence * 100).toFixed(0)}% confidence</span>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-foreground/90">{path.dominantReason}</p>
                <div className="mt-auto grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="truncate col-span-2">
                    <span className="font-mono text-[11px] bg-secondary px-1 py-0.5 rounded mr-1">{start?.label ?? path.startNodeId}</span>
                    →
                    <span className="font-mono text-[11px] bg-secondary px-1 py-0.5 rounded ml-1">{end?.label ?? path.endNodeId}</span>
                  </span>
                  <span>Edges: {path.edgeIds.length}</span>
                  <span>Seed exp: {path.valueFromSeedPct.toFixed(1)}%</span>
                  <span className="col-span-2">Chains: {path.chains.join(", ")}</span>
                </div>
              </>
            );
            return (
              onFocusPath ? (
                <button key={path.id} className="flex flex-col rounded-xl border border-border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-risk-high/40 hover:shadow-glow-cyan" type="button" onClick={() => onFocusPath(path.edgeIds)}>
                  {content}
                </button>
              ) : (
                <article key={path.id} className="flex flex-col rounded-xl border border-border bg-card p-5 text-left shadow-card">
                  {content}
                </article>
              )
            );
          })
        ) : (
          <article className="flex rounded-xl border border-dashed border-border bg-card/50 p-8 text-center justify-center col-span-1 lg:col-span-2">
            <p className="text-sm text-muted-foreground">No suspicious paths were extracted from the current graph window.</p>
          </article>
        )}
      </div>
    </section>
  );
}
