import { GitFork, Zap, Split, X, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import type { Finding } from "@kadenatrace/shared/client";

interface Props {
  flags: Finding[];
  active: string | null;
  onToggle: (id: string | null) => void;
}

const getFlagMeta = (code: string) => {
  if (code.toLowerCase().includes("fan") || code.toLowerCase().includes("split")) {
    return { icon: GitFork, label: "Fan-out", desc: "One wallet sending to many" };
  }
  if (code.toLowerCase().includes("rapid") || code.toLowerCase().includes("time")) {
    return { icon: Zap, label: "Rapid hops", desc: "Re-sent quickly" };
  }
  if (code.toLowerCase().includes("large")) {
    return { icon: Split, label: "Large splits", desc: "Funds split into chunks" };
  }
  return { icon: AlertCircle, label: "Suspicious", desc: "Anomalous behavior" };
};

export const RiskFlags = ({ flags, active, onToggle }: Props) => {
  // Group findings by code to act like flags
  const groupedFlags = flags.reduce((acc, finding) => {
    const existing = acc.find(f => f.id === finding.code);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ id: finding.code, count: 1, finding });
    }
    return acc;
  }, [] as { id: string, count: number, finding: Finding }[]);

  if (groupedFlags.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Risk Flags Detected
        </div>
        {active && (
          <button
            onClick={() => onToggle(null)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <X className="h-3 w-3" /> Clear filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {groupedFlags.map((f) => {
          const m = getFlagMeta(f.id);
          const Icon = m.icon;
          const isActive = active === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onToggle(isActive ? null : f.id)}
              className={cn(
                "group relative flex items-center gap-4 overflow-hidden rounded-xl border bg-card p-4 text-left shadow-card transition-smooth",
                isActive
                  ? "border-risk-high/60 shadow-glow-cyan"
                  : "border-border hover:-translate-y-0.5 hover:border-risk-high/30 hover:shadow-elevated"
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-smooth",
                  isActive ? "bg-risk-high text-primary-foreground" : "bg-risk-high-bg text-risk-high"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-base font-semibold text-foreground truncate">{f.id}</span>
                  <span className="text-xs font-semibold text-risk-high">×{f.count}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{m.desc}</div>
              </div>
              <div className={cn("absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-risk-high transition-transform duration-300", isActive && "scale-x-100")} />
            </button>
          );
        })}
      </div>
    </section>
  );
};
