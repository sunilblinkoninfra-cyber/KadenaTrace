"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactElement, useTransition } from "react";

interface TraceErrorStateProps {
  traceId: string;
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
    <main className="shell grid" style={{ gap: 22 }}>
      <div className="panel card">
        <h1 className="section-title">Unable to connect to tracing engine.</h1>
        <p className="muted">
          The tracing engine is temporarily unavailable (cold start or network issue). Please retry or use the demo case.
        </p>
        <div className="actions">
          <button
            className="ghost-button"
            onClick={handleRetry}
            type="button"
            disabled={isPending}
          >
            Retry
          </button>
          <Link className="ghost-button" href="/trace/demo">
            Use Demo Case
          </Link>
        </div>
      </div>
    </main>
  );
}