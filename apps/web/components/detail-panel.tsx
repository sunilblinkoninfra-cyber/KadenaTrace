import type { ReactElement } from "react";
import { ArrowRight, Info, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import type { Finding, GraphEdge, GraphNode, TraceGraph } from "@kadenatrace/shared/client";
import { InspectorPanel } from "./ui";
import { useTraceStore } from "../lib/store";

interface Props {
  graph: TraceGraph;
  findings: Finding[];
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

export const DetailPanel = ({ graph, findings }: Props): ReactElement | null => {
  const { selectedNodeId } = useTraceStore();
  const selectedId = selectedNodeId;

  const node = selectedId ? graph.nodes.find((n) => n.id === selectedId) : null;
  const edge = selectedId && !node ? graph.edges.find((e) => e.id === selectedId) : null;

  if (!node && !edge) return <EmptyState />;

  if (node) return <NodeDetail node={node} findings={findings} graph={graph} />;
  if (edge) return <EdgeDetail edge={edge} graph={graph} findings={findings} />;
  return null;
};

const EmptyState = () => (
  <InspectorPanel className="min-h-[520px]">
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800">
      <Info className="h-5 w-5 text-muted-foreground" />
    </div>
    <div>
      <div className="text-xl font-semibold text-foreground">Select a node or edge</div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Click any wallet or transfer in the graph to see plain-language explanations, signals, and confidence.
      </p>
    </div>
  </InspectorPanel>
);

const NodeDetail = ({ node, findings, graph }: { node: GraphNode; findings: Finding[]; graph: TraceGraph }) => {
  const m = riskMeta(node.riskLevel);
  const inbound = graph.edges.filter((e) => e.to === node.id);
  const outbound = graph.edges.filter((e) => e.from === node.id);
  
  const relatedFindings = findings.filter(f => f.relatedNodeIds.includes(node.id));

  return (
    <InspectorPanel className="min-h-[520px]">
      <div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", m.bg, m.color)}>
          ● {m.label} · {Math.round(node.riskScore)}/100
        </span>
        <h3 className="mt-2 text-xl font-semibold text-foreground">{node.label}</h3>
        <p className="mt-2 break-words font-mono text-sm text-muted-foreground">{node.address}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-800 bg-gray-950 p-4">
        <Mini label="Type" value={node.kind} />
        <Mini label="Seed Exposure" value={`${node.valueFromSeedPct.toFixed(1)}%`} />
        <Mini label="Inbound" value={`${inbound.length} tx`} />
        <Mini label="Outbound" value={`${outbound.length} tx`} />
      </div>

      <div className="grid gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explanation</div>
        <p className="text-sm leading-relaxed text-foreground/85">
          {node.reasons[0] || (node.riskScore > 50 ? 
            "This wallet receives funds from suspicious sources and shows laundering behavior." : 
            "This wallet shows no strong red flags.")}
        </p>
      </div>

      {relatedFindings.length > 0 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Signals & findings
          </div>
          <ul className="grid gap-2.5 text-sm text-foreground/90">
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
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Detailed Signals</div>
          <div className="grid gap-2.5">
            {node.riskSignals.map((sig, idx) => (
              <div key={`${sig.code}-${idx}`} className="rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs">
                <div className="font-semibold text-foreground">{sig.title} <span className="text-risk-high ml-1">(+{sig.weight})</span></div>
                <div className="text-muted-foreground mt-1 leading-relaxed">{sig.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
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
    </InspectorPanel>
  );
};

const EdgeDetail = ({ edge, graph, findings }: { edge: GraphEdge; graph: TraceGraph; findings: Finding[] }) => {
  const from = graph.nodes.find((n) => n.id === edge.from)!;
  const to = graph.nodes.find((n) => n.id === edge.to)!;
  const suspicious = edge.riskScore >= 50;
  
  const relatedFindings = findings.filter(f => f.relatedEdgeIds.includes(edge.id));
  const edgeConfidence = Math.max(
    edge.riskConfidence,
    relatedFindings[0]?.confidence ?? 0
  );

  return (
    <InspectorPanel className="min-h-[520px]">
      <div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", suspicious ? "bg-risk-high-bg text-risk-high" : "bg-risk-low-bg text-risk-low")}>
          {suspicious ? "Suspicious transfer" : "Normal transfer"}
        </span>
        <div className="mt-2 flex items-center gap-2 font-mono text-[13px]">
          <span className="max-w-[120px] truncate rounded-md bg-gray-950 px-2.5 py-1.5">{from.address}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="max-w-[120px] truncate rounded-md bg-gray-950 px-2.5 py-1.5">{to.address}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-800 bg-gray-950 p-4">
        <Mini label="Amount" value={`${edge.amount.toFixed(4)} ${edge.asset}`} />
        <Mini label="Time" value={new Date(edge.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
      </div>

      {edge.flags && edge.flags.length > 0 && (
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Flags on this transfer</div>
          <div className="flex flex-wrap gap-1.5">
            {edge.flags.map((f, idx) => (
              <span key={`${f}-${idx}`} className="rounded-md bg-risk-high-bg px-2 py-1 text-xs font-medium text-risk-high">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Explanation</div>
        <p className="text-sm leading-relaxed text-foreground/85">
          {edge.reasons[0] || (suspicious
            ? `This transfer exhibits suspicious flow patterns indicative of obfuscation.`
            : `This transfer follows a normal pattern.`)}
        </p>
      </div>

      {relatedFindings.length > 0 && (
        <div className="grid gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Related findings
          </div>
          <ul className="grid gap-1.5 text-sm text-foreground/85">
            {relatedFindings.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                {f.explanation}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-auto pt-4">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-4">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Confidence</span>
            <span className="text-foreground">{(edgeConfidence * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-cyan-gradient"
              style={{ width: `${edgeConfidence * 100}%` }}
            />
          </div>
        </div>
      </div>
    </InspectorPanel>
  );
};

const Mini = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-sm text-gray-400">{label}</div>
    <div className="mt-1 break-words text-base font-medium text-foreground">{value}</div>
  </div>
);
