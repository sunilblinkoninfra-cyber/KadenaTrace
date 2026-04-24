"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";

import { fetchTrace } from "../lib/api";
import { TraceStageLoader } from "./trace-stage-loader";

const DEMO_WALLET = "0x1111111111111111111111111111111111111111";
const DEMO_TX = "0x1000000000000000000000000000000000000000000000000000000000000001";
const GUIDED_CONNECTION_MESSAGE = "Unable to connect to tracing engine.";

interface SearchErrorState {
  title: string;
  details: string[];
}

export function SearchForm(): ReactElement {
  const router = useRouter();
  const [chain, setChain] = useState("ethereum");
  const [seedType, setSeedType] = useState<"address" | "tx">("address");
  const [seedValue, setSeedValue] = useState(DEMO_WALLET);
  const [errorState, setErrorState] = useState<SearchErrorState | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setPending(true);
    setErrorState(null);

    const trimmedSeedValue = seedValue.trim();
    if (!isValidSeedValue(chain, seedType, trimmedSeedValue)) {
      setPending(false);
      setErrorState({
        title: "Enter a valid wallet address or transaction ID.",
        details: [
          "Check that the value matches the selected chain and seed type.",
          "You can also use the demo case to explore the workflow instantly."
        ]
      });
      return;
    }

    try {
      const payload = await fetchTrace({
        chain,
        seedType,
        seedValue: trimmedSeedValue
      });
      router.push(`/trace/${payload.traceId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : GUIDED_CONNECTION_MESSAGE;
      if (message.includes("Unable to connect to tracing engine")) {
        setErrorState({
          title: GUIDED_CONNECTION_MESSAGE,
          details: [
            "Possible reasons:",
            "API waking up (cold start)",
            "Network issue",
            "Please retry or use the demo case."
          ]
        });
      } else {
        setErrorState({
          title: "Unable to start investigation.",
          details: [message]
        });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="search-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="trace-meta">
        <span className="pill">Live Investigation</span>
        <span className="muted">Ethereum, BSC, Bitcoin, and Kadena can all be traced from the same workspace.</span>
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
          {pending ? "Tracing funds..." : "Trace Funds"}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => router.push("/trace/demo")}
        >
          Use Demo Case
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            setSeedType("tx");
            setChain("ethereum");
            setSeedValue(DEMO_TX);
            setErrorState(null);
          }}
        >
          Use demo tx
        </button>
      </div>
      {pending ? <TraceStageLoader compact /> : null}
      {errorState ? (
        <div className="search-form-error">
          <h3>{errorState.title}</h3>
          <ul>
            {errorState.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          <div className="actions">
            <button className="ghost-button" type="submit" disabled={pending}>
              Retry
            </button>
            <button className="ghost-button" type="button" onClick={() => router.push("/trace/demo")}>
              Use Demo Case
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function isValidSeedValue(chain: string, seedType: "address" | "tx", value: string): boolean {
  if (value.length < 3 || /\s/.test(value)) {
    return false;
  }

  if (seedType === "address") {
    if (chain === "ethereum" || chain === "bsc") {
      return /^0x[a-fA-F0-9]{40}$/.test(value);
    }
    if (chain === "bitcoin") {
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(value);
    }
    return value.length >= 3;
  }

  if (chain === "bitcoin") {
    return /^[a-fA-F0-9]{64}$/.test(value);
  }

  return /^0x[a-fA-F0-9]{64}$/.test(value) || /^[a-fA-F0-9]{64}$/.test(value);
}
