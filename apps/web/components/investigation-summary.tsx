import { AlertTriangle, Target, TrendingUp } from "lucide-react";
import { cn } from "../lib/utils";

interface Props {
  summary: any;
  onFocusTopRiskWallet: (id: string) => void;
}

const riskBucket = (score: number) => {
  if (score >= 70) return { label: "High Risk", color: "text-risk-high", bg: "bg-risk-high-bg", ring: "ring-risk-high/30" };
  if (score >= 40) return { label: "Medium Risk", color: "text-risk-med", bg: "bg-risk-med-bg", ring: "ring-risk-med/30" };
  return { label: "Low Risk", color: "text-risk-low", bg: "bg-risk-low-bg", ring: "ring-risk-low/30" };
};

export const InvestigationSummary = ({ summary, onFocusTopRiskWallet }: Props) => {
  const bucket = riskBucket(summary.overallScore);

  const confidence =
    summary.confidence ??
    Math.min(
      95,
      Math.max(
        55,
        Math.round((summary.signalCount ?? summary.findings?.length ?? 0) * 12)
      )
    );

  const conclusion =
    summary.conclusion?.trim() ||
    "This transaction pattern suggests potentially suspicious fund movement based on available signals.";

  return (
    <section className="mx-auto max-w-7xl px-6 pt-8 sm:pt-10">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Investigation Conclusion
        </div>
        <div className="inline-flex items-center rounded-full border border-cyan/30 bg-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-cyan">
          Ethereum • 2-Hop Trace
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-card lg:col-span-8">
          <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-risk-high/10 blur-2xl" />

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1", bucket.bg, bucket.color, bucket.ring)}>
              <AlertTriangle className="h-3 w-3" />
              Automated Analysis
            </span>
            <span className="rounded-full border border-border bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              source {summary.seedAddress ? summary.seedAddress.slice(0,8) : "unknown"}...
            </span>
          </div>

          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conclusion</div>
          <h2 className="font-display text-2xl font-semibold leading-snug text-foreground sm:text-[28px]">
            {conclusion}
          </h2>

          {summary.topRiskWallet && (
            <button
              onClick={() => onFocusTopRiskWallet(summary.topRiskWallet.id)}
              className="mt-6 group flex w-full items-center justify-between rounded-xl border border-risk-high/20 bg-risk-high-bg px-4 py-3 text-left transition-smooth hover:border-risk-high/50 hover:shadow-glow-cyan"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-risk-high text-primary-foreground">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-risk-high">Highest-risk wallet</div>
                  <div className="font-mono text-sm font-medium text-foreground">{summary.topRiskWallet.address}</div>
                </div>
              </div>
              <span className="text-xs font-medium text-risk-high opacity-70 transition group-hover:opacity-100">
                Focus on graph →
              </span>
            </button>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-7 shadow-card lg:col-span-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Risk score</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={cn("font-display text-6xl font-bold leading-none", bucket.color)}>{summary.overallScore}</span>
                <span className="text-lg font-medium text-muted-foreground">/100</span>
              </div>
              <div className={cn("mt-2 inline-flex items-center gap-1 text-xs font-semibold", bucket.color)}>
                <TrendingUp className="h-3 w-3" /> {bucket.label}
              </div>
            </div>

            <RiskRing score={summary.overallScore} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-4">
            <Stat label="Confidence" value={`${confidence}%`} />
            <Stat label="Total Findings" value={`${summary.findingCount}`} />
          </div>
        </div>
      </div>
    </section>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1 font-display text-xl font-semibold text-foreground">{value}</div>
  </div>
);

const RiskRing = ({ score }: { score: number }) => {
  const r = 32;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = score >= 70 ? "hsl(var(--risk-high))" : score >= 40 ? "hsl(var(--risk-med))" : "hsl(var(--risk-low))";
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
      <circle cx="40" cy="40" r={r} stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
      <circle
        cx="40"
        cy="40"
        r={r}
        stroke={color}
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
    </svg>
  );
};