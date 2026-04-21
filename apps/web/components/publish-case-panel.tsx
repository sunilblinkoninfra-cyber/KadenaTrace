"use client";

import type { PreparedCaseAnchorPayload } from "@kadenatrace/pact";
import { useState, type ChangeEvent } from "react";

import type { Finding, TraceRecord } from "@kadenatrace/shared";

import { buildPublicAuditUrl, buildTimelineSidebar, getUrgencyGauge } from "../lib/frontend-logic";
import { getApiBaseUrl } from "../lib/api";
import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";

interface TimelineSidebarEntry {
  id: string;
  title: string;
  subtitle: string;
  timestampLabel: string;
  gapLabel: string;
  terminalLabel: string | null;
  txHash: string;
}

export function PublishCasePanel({ trace }: { trace: TraceRecord }) {
  const wallet = useKadenaWalletSession();
  const [title, setTitle] = useState("Shadow Router Investigation");
  const [summary, setSummary] = useState("A suspicious stolen-funds trace showing fan-out, bridge usage, and exchange sink behavior.");
  const [narrative, setNarrative] = useState(defaultNarrative(trace.result?.findings ?? []));
  const [status, setStatus] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const velocityMetrics = trace.result?.metrics.velocity;
  const urgencyGauge = getUrgencyGauge(velocityMetrics);
  const timelineEntries = buildTimelineSidebar(velocityMetrics) as TimelineSidebarEntry[];
  const publicAuditUrl = buildPublicAuditUrl(
    typeof window === "undefined" ? process.env.NEXT_PUBLIC_WEB_URL || "https://your-vercel-app.vercel.app" : window.location.origin,
    slug
  );

  async function createCase() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          traceId: trace.id,
          title,
          summary,
          narrative
        })
      });
      const payload = (await response.json()) as { caseId?: string; slug?: string; error?: string };
      if (!response.ok || !payload.caseId || !payload.slug) {
        throw new Error(payload.error ?? "Unable to publish case.");
      }

      setCaseId(payload.caseId);
      setSlug(payload.slug);
      setStatus("Public case created.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to publish case.");
    } finally {
      setPending(false);
    }
  }

  async function anchorCase() {
    if (!caseId) {
      return;
    }
    if (!wallet.signer) {
      setStatus("Connect a Kadena wallet before anchoring the case.");
      return;
    }
    if (wallet.networkMismatch) {
      setStatus(`Switch the wallet to ${wallet.targetNetworkId} before signing.`);
      return;
    }

    setPending(true);
    try {
      const payloadResponse = await fetch(`${getApiBaseUrl()}/api/cases/${caseId}/anchor/payload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signer: wallet.signer
        })
      });
      const payload = (await payloadResponse.json()) as PreparedCaseAnchorPayload & { error?: string };
      if (!payloadResponse.ok || !payload.unsignedCommand) {
        throw new Error(payload.error ?? "Unable to prepare the Kadena anchor.");
      }

      const signedCommand = await wallet.signTransaction(payload.unsignedCommand);
      const submitResponse = await fetch(`${getApiBaseUrl()}/api/cases/${caseId}/anchor/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          signer: wallet.signer,
          signedCommand
        })
      });
      const submitted = (await submitResponse.json()) as { requestKey?: string; status?: string; error?: string };
      if (!submitResponse.ok || !submitted.requestKey) {
        throw new Error(submitted.error ?? "Unable to submit the Kadena anchor.");
      }

      setStatus(`Anchor ${submitted.status ?? "submitted"} with request key ${submitted.requestKey}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to anchor case.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel stack">
      <div className="page-header">
        <div>
          <span className="pill">Publish Investigation</span>
          <h2 className="section-title">Turn this trace into a public fraud case</h2>
        </div>
      </div>
      <div className="publish-layout">
        <div className="publish-form grid">
          <div className="trace-meta">
            <span className="pill">{wallet.currentAdapterName ?? "Wallet not selected"}</span>
            <span className="muted">{wallet.signer?.accountName ?? "Connect a Kadena wallet to sign"}</span>
          </div>
          <div className="audit-url-row">
            <div className="audit-url-copy">
              <span className="muted">Public Audit URL</span>
              <span className="code">{publicAuditUrl ?? "Create a public case to generate a shareable permalink."}</span>
            </div>
            <div className={urgencyGauge.toneClass}>
              <span className="muted">{urgencyGauge.label}</span>
              <strong>{urgencyGauge.value}</strong>
              <span>{urgencyGauge.descriptor}</span>
            </div>
          </div>
          <p className="velocity-warning">{urgencyGauge.warning}</p>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label>
            Summary
            <input value={summary} onChange={(event: ChangeEvent<HTMLInputElement>) => setSummary(event.target.value)} />
          </label>
          <label>
            Narrative
            <textarea value={narrative} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNarrative(event.target.value)} />
          </label>
          <div className="actions">
            <button className="button" type="button" disabled={pending} onClick={createCase}>
              {pending ? "Working..." : "Create Public Case"}
            </button>
            {caseId ? (
              <button className="ghost-button" type="button" disabled={pending || !wallet.signer} onClick={anchorCase}>
                Sign & Relay on Kadena
              </button>
            ) : null}
            {slug ? (
              <a className="ghost-button" href={`/case/${slug}`}>
                Open public case
              </a>
            ) : null}
          </div>
          {status ? <p className="muted">{status}</p> : null}
        </div>

        <aside className="timeline-sidebar">
          <div className="trace-meta">
            <span className="pill">Hop Timeline</span>
            <span className="muted">
              {velocityMetrics?.terminalPathCount ?? 0} terminal branch{velocityMetrics?.terminalPathCount === 1 ? "" : "es"}
            </span>
          </div>
          <div className="timeline-list">
            {timelineEntries.length > 0 ? (
              timelineEntries.map((entry) => (
                <article key={entry.id} className="timeline-entry">
                  <span className="timeline-gap">{entry.gapLabel}</span>
                  <strong>{entry.title}</strong>
                  <span className="muted">{entry.subtitle}</span>
                  <span className="muted">{entry.timestampLabel}</span>
                  {entry.terminalLabel ? <span className="pill">{entry.terminalLabel}</span> : null}
                  <span className="code">{entry.txHash}</span>
                </article>
              ))
            ) : (
              <article className="timeline-entry">
                <strong>No terminal exit timeline yet</strong>
                <span className="muted">As soon as the crawler sees a bridge or exchange endpoint, the hop history will appear here.</span>
              </article>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function defaultNarrative(findings: Finding[]) {
  const signalList = findings.slice(0, 4).map((finding) => finding.code.replace(/-/g, " "));
  return `This investigation follows stolen funds from the seed transaction into a branching laundering flow. Key signals observed: ${signalList.join(
    ", "
  ) || "risk scoring is still pending"}.\n\nThe trace snapshot is intended for public verification and can be anchored on Kadena without exposing private victim details.`;
}
