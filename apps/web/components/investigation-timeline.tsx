import type { ReactElement } from "react";

import type { InvestigationTimelineStep } from "../lib/investigation";

export function InvestigationTimeline({ steps }: { steps: InvestigationTimelineStep[] }): ReactElement {
  return (
    <section className="timeline-sidebar">
      <div>
        <span className="pill">Story Mode</span>
        <h2 className="section-title">Investigation Timeline</h2>
        <p className="muted">Follow the laundering path as a time-ordered narrative instead of decoding the full graph at once.</p>
      </div>

      <div className="timeline-list">
        {steps.length > 0 ? (
          steps.map((step, index) => (
            <article key={step.id} className="timeline-entry">
              <div className="trace-meta">
                <span className="timeline-gap">
                  Step {index + 1} ({step.offsetLabel})
                </span>
                {step.confidencePct ? <span className="muted">{step.confidencePct}% confidence</span> : null}
              </div>
              <h3 className="timeline-title">{step.title}</h3>
              <p className="muted">{step.description}</p>
            </article>
          ))
        ) : (
          <article className="timeline-entry">
            <h3 className="timeline-title">No timeline was generated</h3>
            <p className="muted">The trace needs at least one rendered movement to convert the graph into a readable investigation story.</p>
          </article>
        )}
      </div>
    </section>
  );
}
