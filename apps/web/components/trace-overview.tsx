"use client";

import type { TraceResult } from "@kadenatrace/shared";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";

import { buildInvestigationSummary, buildInvestigationTimeline } from "../lib/investigation";
import { FindingHistogram } from "./finding-histogram";
import { InvestigationSummary } from "./investigation-summary";
import { InvestigationTimeline } from "./investigation-timeline";
import { RiskBadge } from "./risk-badge";
import { SummaryCards } from "./summary-cards";
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
  const summary = useMemo(() => buildInvestigationSummary(trace), [trace]);
  const timeline = useMemo(() => buildInvestigationTimeline(trace), [trace]);
  const [focusedNodeId, setFocusedNodeId] = useState<string | undefined>(summary.topRiskWallet?.id);
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
    <div className="grid" style={{ gap: 18 }}>
      {showVerificationStrip && trace.traceHash ? <VerificationStrip traceHash={trace.traceHash} /> : null}

      {isDemo ? (
        <section className="demo-banner panel">
          <div className="trace-meta">
            <span className="pill">Demo Investigation (preloaded example)</span>
            <span className="muted">No live blockchain data required</span>
          </div>
          <p className="muted">
            This walkthrough uses bundled example data, not live blockchain activity.
          </p>
        </section>
      ) : null}

      <div ref={summaryRef}>
        <InvestigationSummary summary={summary} onFocusTopRiskWallet={handleFocusTopRiskWallet} />
      </div>

      <SummaryCards metrics={trace.metrics} graph={trace.graph} seed={trace.seed} />

      <div className="grid two-up">
        <InvestigationTimeline steps={timeline} />
        <section className={`risk-verdict-banner risk-verdict-banner--${summary.overallRisk.toLowerCase()}`}>
          Overall trace risk: <strong>{summary.overallRisk}</strong> ({summary.overallScore}%).
          This conclusion is based on explainable heuristics, cross-chain path analysis, and the highest-risk wallet cluster in view.
        </section>
      </div>

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
          investigationConclusion={summary.conclusion}
        />
      </div>

      <section className="panel stack">
        <h2 className="section-title">Risk findings</h2>
        <FindingHistogram findings={trace.findings} />
        <div className="findings-list">
          {trace.findings.map((finding, index) => (
            <article key={`${traceId}-${finding.code}-${index}`} className="finding">
              <div className="trace-meta">
                <span className="pill">{finding.code}</span>
                <RiskBadge level={finding.severity === "critical" ? "critical" : finding.severity} />
                <span className="muted">{(finding.confidence * 100).toFixed(0)}% confidence</span>
              </div>
              <p>{finding.explanation}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
