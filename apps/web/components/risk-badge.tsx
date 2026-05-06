import type { RiskLevel } from "@kadenatrace/shared";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`risk-badge risk-${level}`}>{level.replace(/^\w/, (char) => char.toUpperCase())}</span>;
}
