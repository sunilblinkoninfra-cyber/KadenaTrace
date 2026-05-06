import { Clock } from "lucide-react";
import { cn } from "../lib/utils";
import { Card, Section } from "./ui";

interface TimelineStep {
  step: number;
  title: string;
  description: string;
  risk: "high" | "medium" | "low";
  tPlus: string;
  amountEth?: number;
}

const dot = {
  high: "bg-risk-high ring-risk-high/20",
  medium: "bg-risk-med ring-risk-med/20",
  low: "bg-risk-low ring-risk-low/20",
};

export const InvestigationTimeline = ({ steps }: { steps: TimelineStep[] }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <Section className="w-full pt-0">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span className="h-px w-6 bg-border" />
        Story Timeline
      </div>

      <Card>
        <ol className="relative space-y-7">
          <span className="absolute left-[11px] top-1 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-border via-border to-transparent" />
          {steps.map((s, idx) => (
            <li key={idx} className="relative flex gap-5 pl-8">
              <span
                className={cn(
                  "absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4",
                  dot[s.risk]
                )}
              >
                <span className="text-[10px] font-bold text-primary-foreground">{s.step}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="font-display text-base font-semibold text-foreground">{s.title}</h3>
                  <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {s.tPlus}
                  </span>
                  {s.amountEth !== undefined && (
                    <span className="font-mono text-xs font-medium text-foreground/80">
                      {s.amountEth.toFixed(2)} ETH
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </Section>
  );
};
