"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";

import { fetchTrace, getApiBaseUrl } from "../lib/api";

const ETH_DEMO_WALLET =
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const ETH_DEMO_TX =
  "0xa9d5d7a91d3e3d3e3d3e3d3e3d3e3d3e3d3e3d3e" +
  "3d3e3d3e3d3e3d3e3d3e3d";

export function SearchForm(): ReactElement {
  const router = useRouter();
  const [seedType, setSeedType] =
    useState<"address" | "tx">("address");
  const [seedValue, setSeedValue] = useState(ETH_DEMO_WALLET);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
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
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the tracing API."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="search-form" onSubmit={(e) => void handleSubmit(e)}>
      <div className="trace-meta">
        <span className="pill">Ethereum · Live Tracing</span>
        <span className="muted">
          Enter a wallet address or transaction hash to begin.
        </span>
      </div>

      <div className="seed-type-tabs">
        <button
          type="button"
          className={
            seedType === "address"
              ? "tab-button tab-button--active"
              : "tab-button"
          }
          onClick={() => {
            setSeedType("address");
            setSeedValue(ETH_DEMO_WALLET);
          }}
        >
          Wallet address
        </button>
        <button
          type="button"
          className={
            seedType === "tx"
              ? "tab-button tab-button--active"
              : "tab-button"
          }
          onClick={() => {
            setSeedType("tx");
            setSeedValue(ETH_DEMO_TX);
          }}
        >
          Transaction hash
        </button>
      </div>

      <label>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {seedType === "address"
            ? "Ethereum wallet address (0x...)"
            : "Transaction hash (0x...)"}
        </span>
        <input
          value={seedValue}
          onChange={(e) => setSeedValue(e.target.value)}
          placeholder={
            seedType === "address"
              ? ETH_DEMO_WALLET
              : ETH_DEMO_TX
          }
          className="input-full"
          spellCheck={false}
          autoComplete="off"
        />
      </label>

      {error ? (
        <div className="error-banner">
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      <div className="actions">
        <button
          className="button"
          type="submit"
          disabled={pending || !seedValue.trim()}
        >
          {pending ? (
            <>
              <span className="spinner" aria-hidden />
              Tracing...
            </>
          ) : (
            "Trace wallet"
          )}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setSeedType("address");
            setSeedValue(ETH_DEMO_WALLET);
          }}
        >
          Try demo wallet
        </button>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        Tracing uses public Ethereum nodes.
        No API key required for basic traces.
      </p>
    </form>
  );
}