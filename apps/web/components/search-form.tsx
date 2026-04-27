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
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-card/40 p-2 shadow-2xl backdrop-blur-xl transition-all">
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-2 relative">
        
        {/* Tabs */}
        <div className="absolute -top-12 left-2 flex gap-1 rounded-lg bg-black/40 p-1 backdrop-blur-md border border-white/5">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${seedType === "address" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white"}`}
            onClick={() => {
              setSeedType("address");
              setSeedValue(ETH_DEMO_WALLET);
            }}
          >
            Wallet Address
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${seedType === "tx" ? "bg-white/10 text-white shadow-sm" : "text-white/50 hover:text-white"}`}
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
          <div className="pointer-events-none absolute left-4 flex items-center justify-center text-white/40">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={seedValue}
            onChange={(e) => setSeedValue(e.target.value)}
            placeholder={seedType === "address" ? "0x..." : "0x..."}
            className="w-full rounded-xl border-none bg-transparent py-4 pl-12 pr-32 text-base font-mono text-white placeholder:text-white/30 focus:outline-none focus:ring-0"
            spellCheck={false}
            autoComplete="off"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !seedValue.trim()}
            className="absolute right-2 top-2 bottom-2 flex items-center justify-center gap-2 rounded-lg bg-cyan-gradient px-6 font-semibold text-background transition-all hover:opacity-90 disabled:opacity-50"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Tracing...
              </>
            ) : (
              <>
                Trace
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-orange-500/10 px-4 py-3 text-sm text-orange-400 border border-orange-500/20 mx-2 mb-2 animate-slide-in">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </form>
    </div>
  );
}