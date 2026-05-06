"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactElement, useTransition } from "react";
import { ErrorStateCard, PageShell, buttonStyles } from "./ui";

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
    <PageShell className="justify-center">
      <ErrorStateCard
        className="mx-auto w-full max-w-3xl"
        title="Live tracing unavailable"
        message="We could not complete this trace from the live network. Retry the investigation or use the demo case to continue reviewing the product flow."
      >
        <button
          onClick={handleRetry}
          disabled={isPending}
          className={buttonStyles("secondary")}
          aria-label={traceId ? `Retry trace ${traceId}` : "Retry trace"}
        >
          <AlertTriangle className="h-4 w-4" />
          {isPending ? "Retrying..." : "Retry"}
        </button>
        <Link href="/trace/demo" className={buttonStyles("primary")}>
          Use Demo
        </Link>
      </ErrorStateCard>
    </PageShell>
  );
}
