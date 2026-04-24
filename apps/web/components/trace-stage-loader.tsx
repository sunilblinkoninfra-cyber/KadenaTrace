"use client";

import { useEffect, useState, type ReactElement } from "react";

const STAGES = [
  "Step 1/3: Building transaction graph",
  "Step 2/3: Analyzing risk signals",
  "Step 3/3: Finalizing trace"
] as const;

export function TraceStageLoader({
  compact = false
}: {
  compact?: boolean;
}): ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % STAGES.length);
    }, 1200);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className={compact ? "trace-stage-loader trace-stage-loader--compact" : "trace-stage-loader"}>
      {STAGES.map((stage, index) => (
        <div
          key={stage}
          className={index === activeIndex ? "trace-stage-loader-step trace-stage-loader-step--active" : "trace-stage-loader-step"}
        >
          {stage}
        </div>
      ))}
    </div>
  );
}
