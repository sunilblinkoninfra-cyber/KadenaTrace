"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";

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

    try {
      const payload = await fetchTrace({
        chain: "ethereum",
        seedType,
        seedValue: seedValue.trim()
      });
      router.push(`/trace/${payload.traceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach tracing engine");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      <div className="seed-type-tabs" style={{ marginBottom: "16px" }}>
        <button
          type="button"
          className={`tab-button ${seedType === "address" ? "tab-button--active" : ""}`}
          onClick={() => {
            setSeedType("address");
            setSeedValue(ETH_DEMO_WALLET);
          }}
        >
          Wallet Address
        </button>
        <button
          type="button"
          className={`tab-button ${seedType === "tx" ? "tab-button--active" : ""}`}
          onClick={() => {
            setSeedType("tx");
            setSeedValue(ETH_DEMO_TX);
          }}
        >
          Transaction Hash
        </button>
      </div>

      <input
        type="text"
        value={seedValue}
        onChange={(e) => setSeedValue(e.target.value)}
        placeholder={seedType === "address" ? "0x..." : "0x..."}
        className="input-full"
        spellCheck={false}
        autoComplete="off"
        style={{ marginBottom: "16px" }}
      />

      {error && (
        <div className="error-banner" style={{ marginBottom: "16px" }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        className="button"
        disabled={pending || !seedValue.trim()}
        style={{ width: "100%" }}
      >
        {pending ? (
          <>
            <span className="spinner"></span>
            Tracing...
          </>
        ) : (
          "Trace Funds"
        )}
      </button>
    </form>
  );
}