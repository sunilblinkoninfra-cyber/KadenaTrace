import Link from "next/link";
import type { ReactElement } from "react";

import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { PublishCasePanel } from "../../../components/publish-case-panel";
import { TraceOverview } from "../../../components/trace-overview";
import { TraceStageLoader } from "../../../components/trace-stage-loader";
import { WalletConnectionCard } from "../../../components/wallet-connection-card";
import { getDemoTraceRecord, isDemoTraceId } from "../../../lib/demo-trace";
import { getTrace } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ traceId: string }> }): Promise<ReactElement> {
  const { traceId } = await params;
  const isDemo = isDemoTraceId(traceId);
  const trace = isDemo ? await getDemoTraceRecord() : await getTrace(traceId);

  if (!trace) {
    return (
      <main className="shell grid" style={{ gap: 22 }}>
        <div className="panel card">
          <h1 className="section-title">Trace unavailable</h1>
          <p className="muted">
            No saved trace was available for this ID. The API may still be waking up, the network may be unavailable,
            or the trace ID may be invalid.
          </p>
          <div className="actions">
            <Link href={`/trace/${traceId}`} className="ghost-button">
              Retry
            </Link>
            <Link href="/trace/demo" className="ghost-button">
              Use Demo Case
            </Link>
            <Link href="/" className="ghost-button">
              Back to search
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (trace.status === "failed") {
    return (
      <main className="shell grid" style={{ gap: 22 }}>
        <div className="panel card">
          <h1 className="section-title">Investigation failed to load</h1>
          <p className="muted">{trace.error ?? "The tracing engine could not complete this request."}</p>
          <div className="actions">
            <Link href={`/trace/${traceId}`} className="ghost-button">
              Retry
            </Link>
            <Link href="/trace/demo" className="ghost-button">
              Use Demo Case
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (trace.status !== "completed" || !trace.result) {
    return (
      <main className="shell grid" style={{ gap: 22 }}>
        <div className="panel stack">
          <div className="trace-meta">
            <span className="pill">Trace status</span>
            <span className="code">{trace.status}</span>
          </div>
          <h1 className="section-title">Preparing the investigation view</h1>
          <p className="muted">
            Inline mode completes immediately, while queue-backed mode waits for the worker to finish the trace.
          </p>
          <TraceStageLoader />
          <div className="actions">
            <Link href={`/trace/${traceId}`} className="ghost-button">
              Refresh status
            </Link>
            <Link href="/trace/demo" className="ghost-button">
              Use Demo Case
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell grid" style={{ gap: 22 }}>
      <section className="panel stack">
        <div className="page-header">
          <div>
            <span className="pill">{isDemo ? "Demo Investigation" : "Investigation Trace"}</span>
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
      </section>

      <TraceOverview
        trace={trace.result}
        traceId={trace.id}
        exportBaseName={`kadenatrace-${traceId}`}
        graphTitle="Branching flow and suspicious path highlights"
        graphSubtitle="Use the filters, suspicious-path focus, and top-risk-wallet shortcut to inspect the laundering branches."
        isDemo={isDemo}
        autoScrollSummary
      />

      <div className="grid" style={{ gap: 16 }}>
        <WalletConnectionCard />
        <CaseAnchorCard />
      </div>

      {isDemo ? null : <PublishCasePanel trace={trace} />}
    </main>
  );
}
