"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactElement, useTransition } from "react";

interface TraceErrorStateProps {
  traceId?: string;
}

export function TraceErrorState({ traceId }: TraceErrorStateProps): ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRetry = (): void => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <main className="shell">
      <div className="mx-auto max-w-7xl px-6 pt-6 mt-12">
        <div className="flex flex-col items-start gap-3 rounded-xl border border-risk-med/20 bg-risk-med-bg/50 p-6 sm:flex-row sm:items-center sm:justify-between shadow-card">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-risk-med/15 text-risk-med">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="font-display text-[16px] font-semibold text-foreground">
                Live tracing unavailable
              </div>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-md">
                We couldn't reach the live network or the trace could not be completed. You can retry, or explore the verifiable demo case below.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-3 mt-4 sm:mt-0">
            <button
              onClick={handleRetry}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-[13px] font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {isPending ? "Retrying..." : "Retry"}
            </button>
            <Link
              href="/trace/demo"
              className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-[13px] font-medium transition-colors hover:opacity-90"
            >
              Use demo case
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}