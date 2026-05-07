import { ArrowRight, Info, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import type { Finding, GraphEdge, GraphNode, TraceGraph } from "@kadenatrace/shared/client";

interface Props {
  graph: TraceGraph;
  findings: Finding[];
  selectedId: string | null;
}

const riskMeta = (level: string) => {
  const normalized = level.toLowerCase();
  if (normalized === "high" || normalized === "critical") {
    return { color: "text-risk-high", bg: "bg-risk-high-bg", label: "High risk" };
  }
  if (normalized === "medium") {
    return { color: "text-risk-med", bg: "bg-risk-med-bg", label: "Medium risk" };
  }
  return { color: "text-risk-low", bg: "bg-risk-low-bg", label: "Low risk" };
};

export const DetailPanel = ({ graph, findings, selectedId }: Props) => {
  const node = selectedId ? graph.nodes.find((n) => n.id === selectedId) : null;
  const edge = selectedId && !node ? graph.edges.find((e) => e.id === selectedId) : null;

  if (!node && !edge) return <EmptyState />;

  if (node) return <NodeDetail node={node} findings={findings} graph={graph} />;
  if (edge) return <EdgeDetail edge={edge} graph={graph} findings={findings} />;
  return null;
};

const EmptyState = () => (
  <div className="flex h-full flex-col items-start gap-3 rounded-xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
      <Info className="h-5 w-5 text-muted-foreground" />
    </div>
    <div>
      <div className="font-display text-base font-semibold text-foreground">Select a node or edge</div>
      <p className="mt-1 leading-relaxed">
        Click any wallet or transfer in the graph to see plain-language explanations, signals, and confidence.
      </p>
    </div>
  </div>
);

const NodeDetail = ({ node, findings, graph }: { node: GraphNode; findings: Finding[]; graph: TraceGraph }) => {
  const m = riskMeta(node.riskLevel);
  const inbound = graph.edges.filter((e) => e.to === node.id);
  const outbound = graph.edges.filter((e) => e.from === node.id);
  
  const relatedFindings = findings.filter(f => f.relatedNodeIds.includes(node.id));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card w-full h-full max-h-[580px] overflow-y-auto">
      <div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", m.bg, m.color)}>
          ● {m.label} · {Math.round(node.riskScore)}/100
        </span>
        <h3 className="mt-4 font-display text-xl font-semibold text-foreground">{node.label}</h3>
        <p className="mt-1 break-all font-mono text-[13px] text-muted-foreground">{node.address}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <Mini label="Type" value={node.kind} />
        <Mini label="Seed Exposure" value={`${node.valueFromSeedPct.toFixed(1)}%`} />
        <Mini label="Inbound" value={`${inbound.length} tx`} />
        <Mini label="Outbound" value={`${outbound.length} tx`} />
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explanation</div>
        <p className="text-sm leading-relaxed text-foreground/85">
          {node.reasons[0] || (node.riskScore > 50 ? 
            "This wallet receives funds from suspicious sources and shows laundering behavior." : 
            "This wallet shows no strong red flags.")}
        </p>
      </div>

      {relatedFindings.length > 0 && (
        <div className="mt-2">
          <div className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Signals & findings
          </div>
          <ul className="space-y-2.5 text-sm text-foreground/90">
            {relatedFindings.map((f, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan" />
                <span className="leading-relaxed">{f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {node.riskSignals.length > 0 && (
        <div className="mt-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detailed Signals</div>
          <div className="space-y-2.5">
            {node.riskSignals.map((sig, idx) => (
              <div key={`${sig.code}-${idx}`} className="bg-secondary/30 border border-border/50 rounded-lg p-3 text-xs">
                <div className="font-semibold text-foreground">{sig.title} <span className="text-risk-high ml-1">(+{sig.weight})</span></div>
                <div className="text-muted-foreground mt-1 leading-relaxed">{sig.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4">
        <div className="rounded-lg border border-border bg-secondary/40 p-3">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Confidence</span>
            <span className="text-foreground">{(node.riskConfidence * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-cyan-gradient"
              style={{ width: `${node.riskConfidence * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const EdgeDetail = ({ edge, graph, findings }: { edge: GraphEdge; graph: TraceGraph; findings: Finding[] }) => {
  const from = graph.nodes.find((n) => n.id === edge.from)!;
  const to = graph.nodes.find((n) => n.id === edge.to)!;
  const suspicious = edge.riskScore >= 50;
  
  const relatedFindings = findings.filter(f => f.relatedEdgeIds.includes(edge.id));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-card w-full h-full max-h-[580px] overflow-y-auto">
      <div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", suspicious ? "bg-risk-high-bg text-risk-high" : "bg-risk-low-bg text-risk-low")}>
          {suspicious ? "Suspicious transfer" : "Normal transfer"}
        </span>
        <div className="mt-4 flex items-center gap-2 font-mono text-[13px]">
          <span className="rounded-md bg-secondary px-2.5 py-1.5 truncate max-w-[120px]">{from.address}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="rounded-md bg-secondary px-2.5 py-1.5 truncate max-w-[120px]">{to.address}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <Mini label="Amount" value={`${edge.amount.toFixed(4)} ${edge.asset}`} />
        <Mini label="Time" value={new Date(edge.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
      </div>

      {edge.flags && edge.flags.length > 0 && (
        <div>
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Flags on this transfer</div>
          <div className="flex flex-wrap gap-1.5">
            {edge.flags.map((f, idx) => (
              <span key={`${f}-${idx}`} className="rounded-md bg-risk-high-bg px-2 py-1 text-xs font-medium text-risk-high">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explanation</div>
        <p className="text-sm leading-relaxed text-foreground/85">
          {edge.reasons[0] || (suspicious
            ? `This transfer exhibits suspicious flow patterns indicative of obfuscation.`
            : `This transfer follows a normal pattern.`)}
        </p>
      </div>

      {relatedFindings.length > 0 && (
        <div className="mt-2">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Related findings
          </div>
          <ul className="space-y-1.5 text-sm text-foreground/85">
            {relatedFindings.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                {f.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5 font-display text-sm font-semibold text-foreground">{value}</div>
  </div>
);
