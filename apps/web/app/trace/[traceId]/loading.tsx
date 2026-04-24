import type { ReactElement } from "react";

import { TraceStageLoader } from "../../../components/trace-stage-loader";

export default function TraceLoadingPage(): ReactElement {
  return (
    <main className="shell">
      <section className="panel stack">
        <span className="pill">Trace status</span>
        <h1 className="section-title">Preparing the investigation view</h1>
        <p className="muted">We are building the graph, scoring suspicious behavior, and finalizing the trace snapshot.</p>
        <TraceStageLoader />
      </section>
    </main>
  );
}
