import Link from "next/link";

import { FindingHistogram } from "../../../components/finding-histogram";

import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { PublishCasePanel } from "../../../components/publish-case-panel";
import { RiskBadge } from "../../../components/risk-badge";
import { SummaryCards } from "../../../components/summary-cards";
import { TraceGraphPanel } from "../../../components/trace-graph-panel";
import { WalletConnectionCard } from "../../../components/wallet-connection-card";
import { getTrace } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await params;
  const trace = await getTrace(traceId);

  if (!trace) {
    return (
      <main className="shell">
        <div className="panel card">
          <h1 className="section-title">Trace not found</h1>
          <p className="muted">Start the API or generate a new trace from the landing page.</p>
          <Link href="/" className="ghost-button">
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  if (trace.status !== "completed" || !trace.result) {
    return (
      <main className="shell">
        <div className="panel card">
          <div className="trace-meta">
            <span className="pill">Trace status</span>
            <span className="code">{trace.status}</span>
          </div>
          <h1 className="section-title">The graph is still being prepared.</h1>
          <p className="muted">
            Refresh this page in a moment. Inline mode completes immediately, while BullMQ mode waits for the worker.
          </p>
        </div>
      </main>
    );
  }

  const criticalCount = trace.result.findings.filter((f) => f.severity === "critical").length;
  const verdict = criticalCount > 0 ? "CRITICAL" :
    trace.result.findings.some(f => f.severity === "high") ? "HIGH" :
    trace.result.findings.some(f => f.severity === "medium") ? "MEDIUM" : "LOW";
  const chainsInvolved = trace.result.metrics.chainsInvolved.length;

  return (
    <main className="shell grid" style={{ gap: 22 }}>
      <section className="panel stack">
        <div className="page-header">
          <div>
            <span className="pill">Investigation Trace</span>
            <h1 className="section-title">Trace {trace.id}</h1>
            <div className="trace-meta">
              <span className="code">{trace.result.seed.seedValue}</span>
              <span className="muted">{trace.result.seed.seedType}</span>
            </div>
          </div>
          <Link href="/" className="ghost-button">
            Start another trace
          </Link>
        </div>
        <SummaryCards metrics={trace.result.metrics} graph={trace.result.graph} seed={trace.result.seed} />
      </section>

      <div className={`risk-verdict-banner risk-verdict-banner--${verdict.toLowerCase()}`}>
        Overall trace risk: <strong>{verdict}</strong>
        {criticalCount > 0 ? ` — ${criticalCount} critical finding(s)` : ""}
        {" "}detected across {chainsInvolved} chain(s).
      </div>

      <TraceGraphPanel
        graph={trace.result.graph}
        findings={trace.result.findings}
        metrics={trace.result.metrics}
        suspiciousPaths={trace.result.suspiciousPaths}
        seedValue={trace.result.seed.seedValue}
        title="Branching flow and suspicious path highlights"
        subtitle="Use the risk filter, zoom controls, and clickable suspicious paths to inspect the laundering branches."
        exportBaseName={`kadenatrace-${traceId}`}
      />

      <section className="grid two-up">
        <article className="panel stack">
          <h2 className="section-title">Findings</h2>
          <FindingHistogram findings={trace.result.findings} />
          <div className="findings-list">
            {trace.result.findings.map((finding) => (
              <article key={`${finding.code}-${finding.explanation}`} className="finding">
                <div className="trace-meta">
                  <span className="pill">{finding.code}</span>
                  <RiskBadge level={finding.severity === "critical" ? "critical" : finding.severity} />
                  <span className="muted">{(finding.confidence * 100).toFixed(0)}% confidence</span>
                </div>
                <p>{finding.explanation}</p>
              </article>
            ))}
          </div>
        </article>
        <div className="grid" style={{ gap: 16 }}>
          <WalletConnectionCard />
          <CaseAnchorCard />
        </div>
      </section>

      <PublishCasePanel trace={trace} />
    </main>
  );
}
