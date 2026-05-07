"use client";

import type { TraceResult } from "@kadenatrace/shared/client";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { buildInvestigationSummary, buildInvestigationTimeline } from "../lib/investigation";
import { FindingHistogram } from "./finding-histogram";
import { InvestigationSummary } from "./investigation-summary";
import { InvestigationTimeline } from "./investigation-timeline";
import { RiskFlags } from "./risk-flags";
import { TraceGraphPanel } from "./trace-graph-panel";
import { VerificationStrip } from "./verification-strip";

interface TraceOverviewProps {
  trace: TraceResult;
  traceId: string;
  exportBaseName?: string;
  graphTitle: string;
  graphSubtitle: string;
  showVerificationStrip?: boolean;
  isDemo?: boolean;
  autoScrollSummary?: boolean;
}

export function TraceOverview({
  trace,
  traceId,
  exportBaseName,
  graphTitle,
  graphSubtitle,
  showVerificationStrip = true,
  isDemo = false,
  autoScrollSummary = false
}: TraceOverviewProps): ReactElement {
  if (!trace?.graph || trace.graph.nodes.length === 0) {
    return <></>;
  }

  const summary = useMemo(() => buildInvestigationSummary(trace), [trace]);
  const timelineRaw = useMemo(() => buildInvestigationTimeline(trace), [trace]);
  
  const timeline = useMemo(() => {
    return timelineRaw.map((step, idx) => ({
      step: idx + 1,
      title: step.title,
      description: step.description,
      risk: (step.confidencePct && step.confidencePct > 80 ? "high" : "medium") as "high" | "medium" | "low",
      tPlus: step.offsetLabel,
      amountEth: undefined
    }));
  }, [timelineRaw]);

  const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(summary.topRiskWallet?.id);
  const [activeRiskFilters, setActiveRiskFilters] = useState<string | null>(null);

  const summaryRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const didAutoScrollRef = useRef(false);

  useEffect(() => {
    if (!autoScrollSummary || didAutoScrollRef.current) {
      return;
    }

    if (window.location.hash || window.scrollY > 24) {
      didAutoScrollRef.current = true;
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      didAutoScrollRef.current = true;
      return;
    }

    didAutoScrollRef.current = true;
    const animationFrame = window.requestAnimationFrame(() => {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [autoScrollSummary]);

  const handleFocusTopRiskWallet = (nodeId: string): void => {
    if (!nodeId) {
      return;
    }

    setFocusedNodeId(nodeId);
    graphRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col w-full bg-background" style={{ gap: 24, paddingBottom: 64 }}>
      {showVerificationStrip && trace.traceHash ? <VerificationStrip traceHash={trace.traceHash} /> : null}

      {isDemo ? (
        <div className="mx-auto max-w-7xl px-6 pt-6">
          <div className="flex items-center gap-3 rounded-xl border border-risk-med/30 bg-risk-med/10 p-4 text-risk-med">
            <span className="text-xl">⚠️</span>
            <div>
              <div className="font-semibold text-sm">Live tracing unavailable — showing demo investigation</div>
              <div className="text-xs opacity-80">This walkthrough uses bundled example data, not live blockchain activity.</div>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={summaryRef}>
        <InvestigationSummary summary={summary} onFocusTopRiskWallet={handleFocusTopRiskWallet} />
      </div>

      <RiskFlags flags={trace.findings} active={activeRiskFilters} onToggle={setActiveRiskFilters} />

      <InvestigationTimeline steps={timeline} />

      <div ref={graphRef}>
        <TraceGraphPanel
          graph={trace.graph}
          findings={trace.findings}
          metrics={trace.metrics}
          suspiciousPaths={trace.suspiciousPaths}
          seedValue={trace.seed.seedValue}
          title={graphTitle}
          subtitle={graphSubtitle}
          exportBaseName={exportBaseName}
          focusedNodeId={focusedNodeId}
          onNodeSelect={setFocusedNodeId}
          investigationConclusion={summary.conclusion}
          activeRiskFilters={activeRiskFilters}
        />
      </div>
    </div>
  );
}
