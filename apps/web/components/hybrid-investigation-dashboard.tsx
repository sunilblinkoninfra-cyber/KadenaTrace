"use client";

import type { TraceResult } from "@kadenatrace/shared";
import { useMemo, useState, type ReactElement } from "react";

import { buildInvestigationSummary, buildInvestigationTimeline } from "../lib/investigation";
import { FlowSankey } from "./flow-sankey";
import { InvestigationSummary } from "./investigation-summary";
import { InvestigationTimeline } from "./investigation-timeline";
import { RiskFlags } from "./risk-flags";
import { TraceGraphPanel } from "./trace-graph-panel";
import { VerificationStrip } from "./verification-strip";

type CaseState = {
  owner: string;
  priority: "P1" | "P2" | "P3";
  status: "triage" | "active" | "evidence-ready";
  nextAction: string;
};

function CaseManagementPanel({ state, setState }: { state: CaseState; setState: (next: CaseState) => void }): ReactElement {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <h3 className="text-lg font-semibold">Case management</h3>
      <p className="mt-1 text-sm text-muted-foreground">Track ownership, triage priority, and immediate action items.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-muted-foreground">
          Case owner
          <input
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            value={state.owner}
            onChange={(event) => setState({ ...state, owner: event.target.value })}
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Priority
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            value={state.priority}
            onChange={(event) => setState({ ...state, priority: event.target.value as CaseState["priority"] })}
          >
            <option value="P1">P1 - Immediate</option>
            <option value="P2">P2 - Same day</option>
            <option value="P3">P3 - Routine</option>
          </select>
        </label>
        <label className="text-sm text-muted-foreground md:col-span-2">
          Case status
          <select
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            value={state.status}
            onChange={(event) => setState({ ...state, status: event.target.value as CaseState["status"] })}
          >
            <option value="triage">Triage</option>
            <option value="active">Active investigation</option>
            <option value="evidence-ready">Evidence package ready</option>
          </select>
        </label>
        <label className="text-sm text-muted-foreground md:col-span-2">
          Next action
          <textarea
            className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            value={state.nextAction}
            onChange={(event) => setState({ ...state, nextAction: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}

export function HybridInvestigationDashboard({
  trace,
  traceId,
  exportBaseName,
  isDemo = false
}: {
  trace: TraceResult;
  traceId: string;
  exportBaseName?: string;
  isDemo?: boolean;
}): ReactElement {
  const summary = useMemo(() => buildInvestigationSummary(trace), [trace]);
  const timelineRaw = useMemo(() => buildInvestigationTimeline(trace), [trace]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(summary.topRiskWallet?.id);
  const [activeRiskFilters, setActiveRiskFilters] = useState<string | null>(null);
  const [caseState, setCaseState] = useState<CaseState>({
    owner: "Analyst Team Alpha",
    priority: "P1",
    status: "triage",
    nextAction: "Notify impacted exchange compliance desks with top 3 suspicious path IDs."
  });

  const timeline = useMemo(
    () =>
      timelineRaw.map((step, idx) => ({
        step: idx + 1,
        title: step.title,
        description: step.description,
        risk: (step.confidencePct && step.confidencePct > 80 ? "high" : "medium") as "high" | "medium" | "low",
        tPlus: step.offsetLabel,
        amountEth: undefined
      })),
    [timelineRaw]
  );

  return (
    <div className="flex flex-col w-full bg-background" style={{ gap: 20, paddingBottom: 64 }}>
      <VerificationStrip traceHash={trace.traceHash} />
      {isDemo ? (
        <div className="rounded-xl border border-risk-med/30 bg-risk-med/10 p-4 text-risk-med text-sm">
          Demo data mode enabled. Use this hybrid dashboard to validate workflow before connecting live providers.
        </div>
      ) : null}

      <InvestigationSummary summary={summary} onFocusTopRiskWallet={setFocusedNodeId} />
      <RiskFlags flags={trace.findings} active={activeRiskFilters} onToggle={setActiveRiskFilters} />

      <TraceGraphPanel
        graph={trace.graph}
        findings={trace.findings}
        metrics={trace.metrics}
        suspiciousPaths={trace.suspiciousPaths}
        seedValue={trace.seed.seedValue}
        title="Graph-centric primary investigation canvas"
        subtitle="Cytoscape view is the primary workspace. Expand supporting modules below for timeline, flow, and case operations."
        exportBaseName={exportBaseName}
        focusedNodeId={focusedNodeId}
        onNodeSelect={setFocusedNodeId}
        investigationConclusion={summary.conclusion}
        activeRiskFilters={activeRiskFilters}
      />

      <details className="rounded-2xl border border-border bg-card p-5" open>
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Temporal timeline
        </summary>
        <div className="pt-2">
          <InvestigationTimeline steps={timeline} />
        </div>
      </details>

      <details className="rounded-2xl border border-border bg-card p-5" open>
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Sankey flow diagram
        </summary>
        <div className="pt-3">
          <FlowSankey graph={trace.graph} focusNodeId={focusedNodeId} />
        </div>
      </details>

      <details className="rounded-2xl border border-border bg-card p-5" open>
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Case management
        </summary>
        <div className="pt-3">
          <CaseManagementPanel state={caseState} setState={setCaseState} />
        </div>
      </details>

      <div className="text-xs text-muted-foreground">
        Dashboard mode: hybrid • trace {traceId} • progressive disclosure enabled.
      </div>
    </div>
  );
}
