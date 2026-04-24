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
    <main className="shell">
      <div
        className="panel"
        style={{
          maxWidth: "560px",
          margin: "80px auto",
          textAlign: "center",
          padding: "40px"
        }}
      >
        <div
          style={{
            fontSize: "48px",
            marginBottom: "20px"
          }}
        >
          ⚠️
        </div>
        
        <h1
          className="section-title"
          style={{ fontSize: "1.5rem", marginBottom: "12px" }}
        >
          Unable to connect to tracing engine
        </h1>
        
        <p className="muted" style={{ marginBottom: "24px", lineHeight: 1.6 }}>
          The tracing engine is temporarily unavailable (cold start or network issue). Please retry or use the demo case.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button
            className="button"
            onClick={handleRetry}
            disabled={isPending}
          >
            {isPending ? "Retrying..." : "Retry"}
          </button>
          
          <Link href="/trace/demo" className="ghost-button">
            Use Demo Case
          </Link>
        </div>
      </div>
    </main>
  );
}