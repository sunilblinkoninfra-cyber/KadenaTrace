"use client";

import type { PreparedCaseAnchorPayload } from "@kadenatrace/pact";
import { useState, type ChangeEvent, type ReactElement } from "react";

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

export function PublishCasePanel({ trace }: { trace: TraceRecord }): ReactElement {
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

  async function createCase(): Promise<void> {
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

  async function anchorCase(): Promise<void> {
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
          <p className="lede" style={{ marginTop: 10 }}>
            Create a public investigation page, then optionally anchor the final snapshot on Kadena for external verification.
          </p>
        </div>
      </div>
      <div className="publish-layout">
        <div className="publish-form">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="form-meta-card">
              <div className="trace-meta" style={{ marginBottom: 10 }}>
                <span className="pill">{wallet.currentAdapterName ?? "Wallet not selected"}</span>
                <span className="muted">{wallet.signer?.accountName ?? "Connect a Kadena wallet to sign"}</span>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {wallet.signer
                  ? "Your connected Kadena wallet will sign the publication and anchoring flow."
                  : "Connect a Kadena wallet when you are ready to sign the investigation record."}
              </p>
            </div>

            <div className={urgencyGauge.toneClass}>
              <span className="urgency-label">{urgencyGauge.label}</span>
              <strong>{urgencyGauge.value}</strong>
              <p className="urgency-copy">{urgencyGauge.descriptor}</p>
            </div>
          </div>

          <div className="audit-url-card">
            <div className="audit-url-copy">
              <span className="form-section-label">Public Audit URL</span>
              <span className="code">
                {publicAuditUrl ?? "Create a public case to generate a shareable permalink."}
              </span>
              <p className="muted" style={{ margin: 0 }}>
                Once created, this becomes the shareable public case page for investigators, partners, and reviewers.
              </p>
            </div>
          </div>

          <p className="velocity-warning">{urgencyGauge.warning}</p>

          <div className="publish-form-grid">
            <label>
              <span className="form-label-title">Case Title</span>
              <input
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label>
              <span className="form-label-title">Executive Summary</span>
              <input
                className="input"
                value={summary}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSummary(event.target.value)}
              />
            </label>
          </div>

          <label>
            <span className="form-label-title">Public Narrative</span>
            <span className="form-label-copy">
              Keep this readable for reviewers. Focus on the laundering pattern, affected branches, and why the case matters.
            </span>
            <textarea
              className="input"
              value={narrative}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNarrative(event.target.value)}
            />
          </label>

          {status ? <p className="publish-status">{status}</p> : null}

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
        </div>

        <aside className="timeline-sidebar">
          <div className="timeline-header">
            <div className="trace-meta">
              <span className="pill">Hop Timeline</span>
              <span className="muted">
                {velocityMetrics?.terminalPathCount ?? 0} terminal branch{velocityMetrics?.terminalPathCount === 1 ? "" : "es"}
              </span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Follow how quickly the trace reaches bridges, exchanges, or other terminal destinations.
            </p>
          </div>

          <div className="timeline-list">
            {timelineEntries.length > 0 ? (
              timelineEntries.map((entry) => (
                <article key={entry.id} className="timeline-entry">
                  <span className="timeline-gap">{entry.gapLabel}</span>
                  <strong>{entry.title}</strong>
                  <span className="timeline-entry-copy">{entry.subtitle}</span>
                  <span className="timeline-entry-copy">{entry.timestampLabel}</span>
                  {entry.terminalLabel ? <span className="pill">{entry.terminalLabel}</span> : null}
                  <span className="code">{entry.txHash}</span>
                </article>
              ))
            ) : (
              <article className="timeline-entry timeline-entry--empty">
                <strong>No terminal exit timeline yet</strong>
                <span className="timeline-entry-copy">
                  As soon as the crawler sees a bridge or exchange endpoint, the hop history will appear here.
                </span>
              </article>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function defaultNarrative(findings: Finding[]): string {
  const signalList = findings.slice(0, 4).map((finding) => finding.code.replace(/-/g, " "));
  return `This investigation follows stolen funds from the seed transaction into a branching laundering flow. Key signals observed: ${signalList.join(
    ", "
  ) || "risk scoring is still pending"}.\n\nThe trace snapshot is intended for public verification and can be anchored on Kadena without exposing private victim details.`;
}
