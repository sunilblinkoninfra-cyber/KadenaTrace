import Link from "next/link";
import type { ReactElement } from "react";

import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { PublishCasePanel } from "../../../components/publish-case-panel";
import { HybridInvestigationDashboard } from "../../../components/hybrid-investigation-dashboard";
import { TraceStageLoader } from "../../../components/trace-stage-loader";
import { TraceErrorState } from "../../../components/trace-error-state";
import { WalletConnectionCard } from "../../../components/wallet-connection-card";
import { getDemoTraceRecord, isDemoTraceId } from "../../../lib/demo-trace";
import { getTrace } from "../../../lib/api";

export const dynamic = "force-dynamic";

export default async function TracePage({ params }: { params: Promise<{ traceId: string }> }): Promise<ReactElement> {
  const { traceId } = await params;
  let isDemo = isDemoTraceId(traceId);
  let trace = null;

  try {
    trace = isDemo ? await getDemoTraceRecord() : await getTrace(traceId);
    if (!trace || trace.status === "failed") {
      throw new Error("Trace failed or not found");
    }
  } catch (err) {
    // API FALLBACK (MANDATORY): If API fails, fallback to demo trace
    isDemo = true;
    try {
      trace = await getDemoTraceRecord();
    } catch (demoErr) {
      trace = null;
    }
  }

  // PREVENT PARTIAL RENDER: Ensure ONLY TraceErrorState is used if everything fails
  if (!trace) {
    return <TraceErrorState traceId={traceId} />;
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

      <div className="hop-ribbon">
        <span>
          Graph depth:{" "}
          <strong>{trace.result.metrics.maxDepth ?? 2} hops</strong>
        </span>
        <span>
          Nodes: <strong>{trace.result.graph.nodes.length}</strong>
        </span>
        <span>
          Edges: <strong>{trace.result.graph.edges.length}</strong>
        </span>
        <a
          href={`https://etherscan.io/address/${
            trace.result.seed.seedValue
          }`}
          target="_blank"
          rel="noreferrer"
          className="ghost-button"
          style={{ fontSize: 12, padding: "4px 10px" }}
        >
          View on Etherscan ↗
        </a>
      </div>

      <HybridInvestigationDashboard
        trace={trace.result}
        traceId={trace.id}
        exportBaseName={`kadenatrace-${traceId}`}
        isDemo={isDemo}
      />

      <div className="grid" style={{ gap: 16 }}>
        <WalletConnectionCard />
        <CaseAnchorCard />
      </div>

      {isDemo ? null : <PublishCasePanel trace={trace} />}
    </main>
  );
}
