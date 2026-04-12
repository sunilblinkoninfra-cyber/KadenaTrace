import type { Finding } from "@kadenatrace/shared";
import type { ReactElement } from "react";

export function FindingHistogram({ findings }: { findings: Finding[] }): ReactElement | null {
  if (findings.length === 0) return null;

  const counts = {
    critical: findings.filter(f => f.severity === "critical").length,
    high: findings.filter(f => f.severity === "high").length,
    medium: findings.filter(f => f.severity === "medium").length,
    low: findings.filter(f => f.severity === "low").length
  };

  const maxCount = Math.max(...Object.values(counts));
  if (maxCount === 0) return null;

  const rows = [
    { label: "Critical", count: counts.critical, color: "#c0392b" },
    { label: "High", count: counts.high, color: "#e67e22" },
    { label: "Medium", count: counts.medium, color: "#f1c40f" },
    { label: "Low", count: counts.low, color: "#27ae60" }
  ];

  return (
    <div style={{ marginBottom: "16px", display: "grid", gap: "6px" }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "13px" }}>
          <div style={{ width: "60px", textAlign: "right", color: "var(--muted)" }}>{row.label}</div>
          <div style={{
            height: "12px",
            width: `${(row.count / maxCount) * 120}px`,
            backgroundColor: row.color,
            borderRadius: "2px"
          }} />
          <div style={{ minWidth: "20px" }}>{row.count}</div>
        </div>
      ))}
    </div>
  );
}
