import { type ReactElement } from "react";

import type { SuspiciousPath, TraceGraph } from "@kadenatrace/shared/client";

import { RiskBadge } from "./risk-badge";
import { Card, Section, focusRingClassName } from "./ui";

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
    <Section className="pb-10 pt-0">
      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Suspicious Paths
        </div>
        <h2 className="text-xl font-semibold text-foreground">Top risk-ranked movement paths</h2>
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
                <button
                  key={path.id}
                  className={`flex flex-col gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left transition-colors hover:border-gray-700 ${focusRingClassName}`}
                  type="button"
                  onClick={() => onFocusPath(path.edgeIds)}
                >
                  {content}
                </button>
              ) : (
                <Card key={path.id} className="flex flex-col gap-4 text-left">
                  {content}
                </Card>
              )
            );
          })
        ) : (
          <article className="col-span-1 flex justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/70 p-8 text-center lg:col-span-2">
            <p className="text-sm text-muted-foreground">No suspicious paths were extracted from the current graph window.</p>
          </article>
        )}
      </div>
    </Section>
  );
}
