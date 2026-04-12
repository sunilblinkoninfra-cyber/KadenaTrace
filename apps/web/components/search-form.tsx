"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";

import { getApiBaseUrl } from "../lib/api";

const DEMO_WALLET = "0x1111111111111111111111111111111111111111";
const DEMO_TX = "0x1000000000000000000000000000000000000000000000000000000000000001";

export function SearchForm(): ReactElement {
  const router = useRouter();
  const [chain, setChain] = useState("ethereum");
  const [seedType, setSeedType] = useState<"address" | "tx">("address");
  const [seedValue, setSeedValue] = useState(DEMO_WALLET);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/traces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chain,
          seedType,
          seedValue
        })
      });

      if (!response.ok) {
        throw new Error("Unable to create trace.");
      }

      const payload = (await response.json()) as { traceId: string };
      router.push(`/trace/${payload.traceId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to start trace.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="trace-meta">
        <span className="pill">MVP Search</span>
        <span className="muted">Ethereum, BSC, and Bitcoin are available for live tracing.</span>
      </div>
      <label>
        Chain
        <select value={chain} onChange={(event) => setChain(event.target.value)}>
          <option value="ethereum">Ethereum</option>
          <option value="bsc">BSC</option>
          <option value="bitcoin">Bitcoin</option>
          <option value="kadena">Kadena</option>
        </select>
      </label>
      <label>
        Seed type
        <select
          value={seedType}
          onChange={(event) => {
            const nextSeedType = event.target.value as "address" | "tx";
            setSeedType(nextSeedType);
            setSeedValue(nextSeedType === "address" ? DEMO_WALLET : DEMO_TX);
          }}
        >
          <option value="address">Compromised wallet</option>
          <option value="tx">Transaction hash</option>
        </select>
      </label>
      <label>
        Seed value
        <input
          value={seedValue}
          onChange={(event) => setSeedValue(event.target.value)}
          placeholder={seedType === "address" ? DEMO_WALLET : DEMO_TX}
        />
      </label>
      <div className="actions">
        <button className="button" type="submit" disabled={pending}>
          {pending ? "Tracing..." : "Generate Trace"}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setSeedType("address");
            setChain("ethereum");
            setSeedValue(DEMO_WALLET);
          }}
        >
          Use demo wallet
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setSeedType("tx");
            setChain("ethereum");
            setSeedValue(DEMO_TX);
          }}
        >
          Use demo tx
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
