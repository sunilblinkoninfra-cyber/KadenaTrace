import { AlertTriangle, Target, TrendingUp } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, Section } from "./ui";

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
  const confidence = summary.confidencePct ?? 55;
  const conclusion =
    summary.conclusion?.trim() || "This transaction pattern suggests potentially suspicious fund movement based on available signals.";
  const typeToneClassName =
    summary.typeTone === "critical"
      ? "border-red-500/20 bg-red-500/10 text-red-700"
      : summary.typeTone === "mixer"
        ? "border-violet-500/20 bg-violet-500/10 text-violet-700"
        : summary.typeTone === "warning"
          ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
          : "border-cyan-500/20 bg-cyan-500/10 text-cyan-700";

  const getWalletRiskStyle = (score: number) => {
    if (score >= 70) {
      return {
        border: "border-red-500/30 bg-red-500/10 hover:border-red-400",
        iconBg: "bg-red-500 text-white",
        textColor: "text-red-700",
        badgeText: "Highest-risk wallet"
      };
    }
    if (score >= 40) {
      return {
        border: "border-amber-500/30 bg-amber-500/10 hover:border-amber-400",
        iconBg: "bg-amber-500 text-white",
        textColor: "text-amber-700",
        badgeText: "Highest-risk wallet"
      };
    }
    return {
      border: "border-emerald-500/30 bg-emerald-500/10 hover:border-emerald-400",
      iconBg: "bg-emerald-500 text-white",
      textColor: "text-emerald-700",
      badgeText: "Low-risk wallet"
    };
  };

  const walletStyle = summary.topRiskWallet ? getWalletRiskStyle(summary.topRiskWallet.riskScore) : null;

  return (
    <Section className="pt-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-px w-6 bg-border" />
          Investigation Conclusion
        </div>
        <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium", typeToneClassName)}>
          {summary.typeLabel}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="relative overflow-hidden lg:col-span-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1", bucket.bg, bucket.color, bucket.ring)}>
              <AlertTriangle className="h-3 w-3" />
              Automated Analysis
            </span>
            <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 font-mono text-xs text-muted-foreground">
              source {summary.seedAddress ? summary.seedAddress.slice(0,8) : "unknown"}...
            </span>
          </div>

          <div className="mb-2 text-sm text-muted-foreground">Conclusion</div>
          <h2 className="text-xl font-semibold leading-snug text-foreground sm:text-2xl">
            {conclusion}
          </h2>

          <div className="mt-4 grid gap-2 rounded-xl border border-border bg-secondary/40 p-4">
            <div className="text-sm font-semibold text-foreground">Why this is suspicious</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{summary.whySuspicious}</p>
          </div>

          {summary.topRiskWallet && walletStyle && (
            <button
              type="button"
              onClick={() => onFocusTopRiskWallet(summary.topRiskWallet.id)}
              className={cn("mt-4 grid w-full gap-2 rounded-xl border p-4 text-left transition-colors", walletStyle.border)}
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", walletStyle.iconBg)}>
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <div className={cn("text-sm", walletStyle.textColor)}>{walletStyle.badgeText}</div>
                  <div className="break-all font-mono text-sm font-medium text-foreground">
                    {summary.topRiskWallet.address} (Risk: {summary.topRiskWallet.riskScore}%)
                  </div>
                </div>
              </div>
              <span className={cn("text-sm", walletStyle.textColor)}>Focus on graph</span>
            </button>
          )}
        </Card>

        <Card className="lg:col-span-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Risk score</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={cn("text-6xl font-semibold leading-none", bucket.color)}>{summary.overallScore}</span>
                <span className="text-lg font-medium text-muted-foreground">/100</span>
              </div>
              <div className="mt-3">
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                  bucket.bg, bucket.color, bucket.ring
                )}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                  {bucket.label}
                </span>
              </div>
            </div>

            <RiskRing score={summary.overallScore} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4">
            <Stat label="Confidence" value={`${confidence}%`} />
            <Stat label="Total Findings" value={`${summary.findingCount}`} />
            <Stat label="Wallets" value={`${summary.walletCount}`} />
            <Stat label="Data completeness" value={summary.dataCompleteness} />
          </div>
        </Card>
      </div>
    </Section>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className="mt-1 text-base font-medium text-foreground">{value}</div>
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
