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
    <section className="panel stack">
      <div className="page-header">
        <div>
          <span className="pill">Suspicious Paths</span>
          <h2 className="section-title">Top risk-ranked movement paths</h2>
        </div>
      </div>
      <div className="findings-list">
        {paths.length > 0 ? (
          paths.map((path, index) => {
            const start = nodeById.get(path.startNodeId);
            const end = nodeById.get(path.endNodeId);
            const content = (
              <>
                <div className="trace-meta">
                  <span className="pill">Path {index + 1}</span>
                  <RiskBadge level={path.riskScore >= 80 ? "critical" : path.riskScore >= 60 ? "high" : "medium"} />
                  <span className="muted">{(path.confidence * 100).toFixed(0)}% confidence</span>
                </div>
                <p>{path.dominantReason}</p>
                <div className="facts">
                  <span className="muted">
                    {start?.label ?? path.startNodeId} {"->"} {end?.label ?? path.endNodeId}
                  </span>
                  <span className="muted">Edges: {path.edgeIds.length}</span>
                  <span className="muted">Seed exposure: {path.valueFromSeedPct.toFixed(1)}%</span>
                  <span className="muted">Chains: {path.chains.join(", ")}</span>
                </div>
              </>
            );
            return (
              onFocusPath ? (
                <button key={path.id} className="finding finding-button" type="button" onClick={() => onFocusPath(path.edgeIds)}>
                  {content}
                </button>
              ) : (
                <article key={path.id} className="finding">
                  {content}
                </article>
              )
            );
          })
        ) : (
          <article className="finding">
            <p className="muted">No suspicious paths were extracted from the current graph window.</p>
          </article>
        )}
      </div>
    </section>
  );
}
