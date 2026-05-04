import type { Metadata } from "next";
import type { ReactElement } from "react";

import { TraceWaterfall } from "../../components/trace-waterfall";
import { DEMO_TRACE_ID, buildDemoTraceSpans } from "../../lib/trace-waterfall-demo";

export const metadata: Metadata = {
  title: "Trace Waterfall | KadenaTrace",
  description: "A Jaeger-style observability waterfall built with deterministic span scaling."
};

export default function WaterfallPage(): ReactElement {
  const spans = buildDemoTraceSpans();

  return (
    <main className="shell grid" style={{ gap: 24 }}>
      <TraceWaterfall traceId={DEMO_TRACE_ID} spans={spans} />
    </main>
  );
}
