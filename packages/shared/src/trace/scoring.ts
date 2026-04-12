import type { FindingSeverity, RiskLevel } from "../domain.js";

export function severityToRiskLevel(severity: FindingSeverity): RiskLevel {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    default:
      return "low";
  }
}

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 80) {
    return "critical";
  }

  if (score >= 60) {
    return "high";
  }

  if (score >= 30) {
    return "medium";
  }

  return "low";
}

