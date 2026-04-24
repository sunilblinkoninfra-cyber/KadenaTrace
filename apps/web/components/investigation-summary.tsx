"use client";

import type { ReactElement } from "react";

import type { InvestigationSummaryModel } from "../lib/investigation";
import { truncateAddress } from "../lib/investigation";

interface InvestigationSummaryProps {
  summary: InvestigationSummaryModel;
  onFocusTopRiskWallet?: (nodeId: string) => void;
}

const RISK_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "var(--risk-critical-bg)", text: "var(--risk-critical)" },
  high: { bg: "var(--risk-high-bg)", text: "var(--risk-high)" },
  medium: { bg: "var(--risk-medium-bg)", text: "var(--risk-medium)" },
  low: { bg: "var(--risk-low-bg)", text: "var(--risk-low)" }
};

export function InvestigationSummary({
  summary,
  onFocusTopRiskWallet
}: InvestigationSummaryProps): ReactElement {
  const riskStyle = RISK_COLORS[summary.overallRisk.toLowerCase()] || RISK_COLORS.medium;

  return (
    <section className="panel investigation-summary animate-fade-in">
      <div className="trace-meta" style={{ marginBottom: "20px" }}>
        <span
          className="investigation-type-badge"
          style={{
            background: riskStyle.bg,
            color: riskStyle.text,
            fontWeight: 600,
            fontSize: "14px",
            padding: "8px 16px"
          }}
        >
          {summary.typeLabel}
        </span>
        <span className="pill">Confidence: {summary.confidencePct}%</span>
        <span className="pill">Data: {summary.dataCompleteness}</span>
      </div>

      <div className="investigation-summary-hero">
        <div>
          <h2 className="section-title" style={{ fontSize: "20px", marginBottom: "16px" }}>
            Investigation Conclusion
          </h2>
          <p className="investigation-summary-line" style={{ fontSize: "18px", fontWeight: 600, lineHeight: 1.4, marginBottom: "12px" }}>
            {summary.summaryLine}
          </p>
          <p className="investigation-conclusion" style={{ color: "var(--ink-secondary)", fontSize: "15px", lineHeight: 1.6 }}>
            {summary.conclusion}
          </p>
        </div>

        <div
          className="investigation-stat-card"
          style={{
            background: riskStyle.bg,
            border: `1px solid ${riskStyle.text}30`
          }}
        >
          <span className="muted" style={{ fontSize: "12px" }}>Risk Score</span>
          <strong style={{ fontSize: "2.5rem", color: riskStyle.text }}>{summary.highestRiskScore}%</strong>
          <span style={{ fontSize: "13px", color: riskStyle.text, fontWeight: 600 }}>{summary.overallRisk}</span>
        </div>
      </div>

      <div
        style={{
          marginTop: "24px",
          padding: "20px",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-md)"
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>Why this is suspicious</h3>
        <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--ink-secondary)" }}>
          {summary.whySuspicious}
        </p>
      </div>

      {summary.topRiskWallet && (
        <button
          type="button"
          className="ghost-button"
          onClick={() => onFocusTopRiskWallet?.(summary.topRiskWallet?.id ?? "")}
          style={{
            marginTop: "20px",
            width: "100%",
            justifyContent: "center",
            padding: "14px"
          }}
        >
          🔴 Highest Risk: {truncateAddress(summary.topRiskWallet.address)} — {summary.topRiskWallet.riskScore}% risk
        </button>
      )}
    </section>
  );
}