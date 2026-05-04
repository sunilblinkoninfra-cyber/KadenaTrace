"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { ArrowRight, Loader2, AlertCircle, Search } from "lucide-react";

import { fetchTrace } from "../lib/api";

const ETH_DEMO_WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const ETH_DEMO_TX = "0xa9d5d7a91d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e3d";

export function SearchForm(): ReactElement {
  const router = useRouter();
  const [seedType, setSeedType] = useState<"address" | "tx">("address");
  const [seedValue, setSeedValue] = useState(ETH_DEMO_WALLET);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!seedValue.trim()) return;

    setPending(true);
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
      const payload = await fetchTrace({
        chain: "ethereum",
        seedType,
        seedValue: seedValue.trim()
      });
      router.push(`/trace/${payload.traceId}`);
    } catch (err) {
      setError("Invalid wallet address. Showing demo investigation.");
      setTimeout(() => {
        router.push(`/trace/demo`);
      }, 1500);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border/80 bg-card/95 p-2 shadow-card backdrop-blur-xl transition-all">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2 relative">
        
        {/* Tabs */}
        <div className="absolute -top-12 left-2 flex gap-1 rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur-md">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${seedType === "address" ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              setSeedType("address");
              setSeedValue(ETH_DEMO_WALLET);
            }}
          >
            Wallet Address
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${seedType === "tx" ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => {
              setSeedType("tx");
              setSeedValue(ETH_DEMO_TX);
            }}
          >
            Transaction Hash
          </button>
        </div>

        {/* Input area */}
        <div className="relative flex items-center">
          <div className="pointer-events-none absolute left-4 flex items-center justify-center text-muted-foreground">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={seedValue}
            onChange={(e) => setSeedValue(e.target.value)}
            placeholder={seedType === "address" ? "0x..." : "0x..."}
            className="w-full rounded-[1.25rem] border border-transparent bg-white/75 py-4 pl-12 pr-36 text-base font-mono text-foreground placeholder:text-muted-foreground/70 shadow-inner focus:border-cyan/25 focus:outline-none focus:ring-2 focus:ring-cyan/10"
            spellCheck={false}
            autoComplete="off"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !seedValue.trim()}
            className="absolute bottom-2 right-2 top-2 flex items-center justify-center gap-2 rounded-xl bg-cyan-gradient px-6 font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5 hover:opacity-95 disabled:translate-y-0 disabled:opacity-50"
          >
            {pending ? (
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

        {error && (
          <div className="mx-2 mb-2 flex items-center gap-2 rounded-2xl border border-risk-med/20 bg-risk-med-bg px-4 py-3 text-sm text-risk-med animate-slide-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}
