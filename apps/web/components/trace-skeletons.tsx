"use client";

import type { ReactElement, CSSProperties } from "react";

interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
  style?: CSSProperties;
}

function Skeleton({ width = "100%", height = "20px", radius = "8px", style }: SkeletonProps): ReactElement {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(90deg, var(--bg-tertiary) 25%, var(--surface) 50%, var(--bg-tertiary) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        ...style
      }}
    />
  );
}

export function InvestigationSummarySkeleton(): ReactElement {
  return (
    <section className="panel investigation-summary">
      <div className="trace-meta" style={{ marginBottom: "20px", gap: "12px" }}>
        <Skeleton width="140px" height="36px" radius="100px" />
        <Skeleton width="100px" height="28px" radius="100px" />
        <Skeleton width="120px" height="28px" radius="100px" />
      </div>

      <div className="investigation-summary-hero">
        <div style={{ flex: 1 }}>
          <Skeleton width="80px" height="24px" radius="4px" style={{ marginBottom: "16px" }} />
          <Skeleton width="100%" height="28px" radius="4px" style={{ marginBottom: "12px" }} />
          <Skeleton width="90%" height="20px" radius="4px" style={{ marginBottom: "8px" }} />
          <Skeleton width="75%" height="20px" radius="4px" />
        </div>
        <Skeleton width="140px" height="120px" radius="12px" />
      </div>

      <div style={{ marginTop: "24px", padding: "20px", background: "var(--bg-tertiary)", borderRadius: "12px" }}>
        <Skeleton width="160px" height="20px" radius="4px" style={{ marginBottom: "12px" }} />
        <Skeleton width="100%" height="16px" radius="4px" style={{ marginBottom: "6px" }} />
        <Skeleton width="85%" height="16px" radius="4px" />
      </div>
    </section>
  );
}

export function GraphSkeleton(): ReactElement {
  return (
    <div className="graph-shell">
      <div className="graph-main">
        <div className="graph-filters">
          <Skeleton width="60px" height="32px" radius="6px" />
          <Skeleton width="80px" height="32px" radius="6px" />
          <Skeleton width="140px" height="32px" radius="6px" />
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
          <Skeleton width="60px" height="24px" radius="100px" />
          <Skeleton width="60px" height="24px" radius="100px" />
          <Skeleton width="60px" height="24px" radius="100px" />
        </div>

        <div
          className="graph-canvas-wrap"
          style={{
            width: "100%",
            height: "540px",
            background: "var(--bg)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "3px solid var(--border)",
                borderTopColor: "var(--primary)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto 16px"
              }}
            />
            <p className="muted">Building transaction graph...</p>
          </div>
        </div>
      </div>

      <div className="detail-panel" style={{ padding: "24px" }}>
        <Skeleton width="100px" height="24px" radius="4px" style={{ marginBottom: "16px" }} />
        <Skeleton width="100%" height="16px" radius="4px" style={{ marginBottom: "8px" }} />
        <Skeleton width="90%" height="16px" radius="4px" style={{ marginBottom: "8px" }} />
        <Skeleton width="70%" height="16px" radius="4px" style={{ marginBottom: "16px" }} />
        <Skeleton width="60px" height="28px" radius="100px" />
      </div>
    </div>
  );
}

export function TimelineSkeleton(): ReactElement {
  return (
    <section className="panel timeline-sidebar">
      <div style={{ marginBottom: "24px" }}>
        <Skeleton width="80px" height="24px" radius="4px" style={{ marginBottom: "8px" }} />
        <Skeleton width="200px" height="16px" radius="4px" />
      </div>

      <div className="timeline-list">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="timeline-entry" style={{ paddingLeft: "28px" }}>
            <Skeleton width="80px" height="14px" radius="4px" style={{ marginBottom: "6px" }} />
            <Skeleton width="60%" height="18px" radius="4px" style={{ marginBottom: "4px" }} />
            <Skeleton width="85%" height="14px" radius="4px" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function SummaryCardsSkeleton(): ReactElement {
  return (
    <div className="summary-cards">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="summary-card">
          <Skeleton width="60%" height="32px" radius="4px" style={{ margin: "0 auto 8px" }} />
          <Skeleton width="80px" height="14px" radius="4px" />
        </div>
      ))}
    </div>
  );
}
