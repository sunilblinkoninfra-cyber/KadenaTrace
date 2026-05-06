"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { ArrowRight, Loader2, AlertCircle, Search } from "lucide-react";

import { fetchTrace } from "../lib/api";
import { buttonStyles } from "./ui";
import { useTraceStore } from "../lib/store";

const ETH_DEMO_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const ETH_DEMO_TX = "0xa9d5d7a91d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d";

export function SearchForm(): ReactElement {
  const router = useRouter();
  const [seedType, setSeedType] = useState<"address" | "tx">("address");
  const [seedValue, setSeedValue] = useState(ETH_DEMO_WALLET);
  const [error, setError] = useState<string | null>(null);
  const { fetchAndSetTrace, isLoading } = useTraceStore();

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!seedValue.trim() || isLoading) return;

    setError(null);

    // Invalid Input Fallback Logic
    if (seedValue.trim() !== ETH_DEMO_WALLET && seedValue.trim() !== ETH_DEMO_TX && seedValue.trim().length < 42) {
      setError("Invalid wallet address. Showing demo investigation.");
      // Wait for a second so they see the message, then redirect to demo
      setTimeout(() => {
        router.push(`/trace/demo`);
      }, 1500);
      return;
    }

    try {
      const traceId = await fetchAndSetTrace(seedValue.trim());
      router.push(`/trace/${traceId}`);
    } catch (err) {
      if (err instanceof Error && err.message === "Trace is already loading") return;
      setError("Tracing unavailable. Showing demo investigation.");
      setTimeout(() => {
        router.push(`/trace/demo`);
      }, 1500);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-800 bg-gray-900 p-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={seedType === "address"}
            className={
              seedType === "address"
                ? buttonStyles("primary")
                : buttonStyles("secondary")
            }
            onClick={() => {
              setSeedType("address");
              setSeedValue(ETH_DEMO_WALLET);
            }}
          >
            Wallet Address
          </button>
          <button
            type="button"
            aria-pressed={seedType === "tx"}
            className={
              seedType === "tx"
                ? buttonStyles("primary")
                : buttonStyles("secondary")
            }
            onClick={() => {
              setSeedType("tx");
              setSeedValue(ETH_DEMO_TX);
            }}
          >
            Transaction Hash
          </button>
        </div>

        <label className="grid gap-2">
          <span className="text-sm text-gray-400">
            {seedType === "address" ? "Wallet address" : "Transaction hash"}
          </span>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <div className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center justify-center text-muted-foreground">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={seedValue}
                onChange={(e) => setSeedValue(e.target.value)}
                placeholder={seedType === "address" ? "0x..." : "0x..."}
                className="input pl-10 font-mono"
                spellCheck={false}
                autoComplete="off"
                aria-label={seedType === "address" ? "Wallet address" : "Transaction hash"}
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !seedValue.trim()}
              className={buttonStyles("primary")}
              aria-label="Trace funds"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Tracing...
                </>
              ) : (
                <>
                  Trace Funds
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </label>

        {error ? (
          <div
            className="flex items-start gap-2 rounded-xl border border-red-500 bg-red-500/10 p-4 text-sm text-red-300 animate-slide-in"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div className="grid gap-1 text-left">
              <span className="font-medium text-red-200">Unable to trace that input</span>
              <p>{error}</p>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}
