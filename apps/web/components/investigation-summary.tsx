"use client";

import type { ReactElement } from "react";

import type { InvestigationSummaryModel } from "../lib/investigation";
import { truncateAddress } from "../lib/investigation";

export function InvestigationSummary({
  summary,
  onFocusTopRiskWallet
}: {
  summary: InvestigationSummaryModel;
  onFocusTopRiskWallet?: (nodeId: string) => void;
}): ReactElement {
  return (
    <section className="panel stack investigation-summary" id="investigation-summary">
      <div className="trace-meta">
        <span className={`investigation-type-badge investigation-type-badge--${summary.typeTone}`}>
          Type: {summary.typeLabel}
        </span>
        <span className="pill">Confidence: {summary.confidencePct}%</span>
        <span className="pill">Data completeness: {summary.dataCompleteness}</span>
      </div>

      <div className="investigation-summary-hero">
        <div>
          <span className="pill">Investigation Summary</span>
          <h2 className="section-title">Investigation Conclusion</h2>
          <p className="investigation-summary-line">{summary.summaryLine}</p>
          <p className="investigation-conclusion">{summary.conclusion}</p>
        </div>
        <div className="investigation-stat-card">
          <span className="muted">Highest risk score</span>
          <strong>{summary.highestRiskScore}%</strong>
          <span className="muted">Overall verdict: {summary.overallRisk}</span>
        </div>
      </div>

      <article className="investigation-explanation-card">
        <h3>Why this is suspicious</h3>
        <p>{summary.whySuspicious}</p>
      </article>

      {summary.topRiskWallet ? (
        <button
          className="investigation-top-risk"
          type="button"
          onClick={() => onFocusTopRiskWallet?.(summary.topRiskWallet?.id ?? "")}
        >
          Highest risk wallet: {truncateAddress(summary.topRiskWallet.address)} (Risk: {summary.topRiskWallet.riskScore}%)
        </button>
      ) : null}
    </section>
  );
}
