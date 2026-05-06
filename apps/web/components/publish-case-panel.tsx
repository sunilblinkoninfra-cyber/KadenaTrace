"use client";

import type { PreparedCaseAnchorPayload } from "@kadenatrace/pact";
import { useState, type ChangeEvent, type ReactElement } from "react";

import type { Finding, TraceRecord } from "@kadenatrace/shared";

import { buildPublicAuditUrl, buildTimelineSidebar, getUrgencyGauge } from "../lib/frontend-logic";
import { getApiBaseUrl } from "../lib/api";
import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";
import { Card, InspectorPanel, buttonStyles, twoColumnClassName } from "./ui";

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
      <section className="mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6">
      <div>
        <div>
          <span className="pill">Publish Investigation</span>
          <h2 className="mt-2 text-xl font-semibold text-foreground">Turn this trace into a public fraud case</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a public investigation page, then optionally anchor the final snapshot on Kadena for external verification.
          </p>
        </div>
      </div>

      <div className={twoColumnClassName}>
        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <div className="grid gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Signing Wallet
                </div>
                <div className="trace-meta gap-2">
                  <span className="pill">{wallet.currentAdapterName ?? "Wallet not selected"}</span>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {wallet.signer?.accountName ?? "Connect a Kadena wallet to sign"}
                </div>
                <p className="text-sm text-muted-foreground">
                  {wallet.signer
                    ? "Your connected Kadena wallet will sign the publication and anchoring flow."
                    : "Connect a Kadena wallet when you are ready to sign the investigation record."}
                </p>
              </div>
            </Card>

            <div className={resolveUrgencyCardClassName(urgencyGauge.toneClass)}>
              <div className="grid gap-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {urgencyGauge.label}
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {urgencyGauge.value}
                </div>
                <p className="text-sm text-muted-foreground">
                  {urgencyGauge.descriptor}
                </p>
                <p className="text-sm text-muted-foreground">
                  {urgencyGauge.warning}
                </p>
              </div>
            </div>
          </div>

          <Card>
            <div className="grid gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Public Audit URL
              </div>
              <span className="code">
                {publicAuditUrl ?? "Create a public case to generate a shareable permalink."}
              </span>
              <p className="text-sm text-muted-foreground">
                Once created, this becomes the shareable public case page for investigators, partners, and reviewers.
              </p>
            </div>
          </Card>

          <Card className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="text-sm font-semibold text-foreground">Case Title</span>
                <input
                  className="input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <label>
                <span className="text-sm font-semibold text-foreground">Executive Summary</span>
                <input
                  className="input"
                  value={summary}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSummary(event.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold text-foreground">Public Narrative</span>
              <span className="text-sm text-muted-foreground">
                Keep this readable for reviewers. Focus on the laundering pattern, affected branches, and why the case matters.
              </span>
              <textarea
                className="input min-h-[220px]"
                value={narrative}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setNarrative(event.target.value)}
              />
            </label>

            {status ? (
              <p className="rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-300">
                {status}
              </p>
            ) : null}

            <div className="actions">
              <button className={buttonStyles("primary")} type="button" disabled={pending} onClick={createCase}>
                {pending ? "Working..." : "Create Public Case"}
              </button>
              {caseId ? (
                <button className={buttonStyles("secondary")} type="button" disabled={pending || !wallet.signer} onClick={anchorCase}>
                  Sign & Relay on Kadena
                </button>
              ) : null}
              {slug ? (
                <a className={buttonStyles("secondary")} href={`/case/${slug}`}>
                  Open public case
                </a>
              ) : null}
            </div>
          </Card>
        </div>

        <InspectorPanel className="min-h-[520px]">
          <div className="flex h-full flex-col gap-4">
            <div className="grid gap-2">
              <div className="trace-meta gap-2">
                <span className="pill">{wallet.currentAdapterName ?? "Wallet not selected"}</span>
                <span className="muted">
                  {velocityMetrics?.terminalPathCount ?? 0} terminal branch{velocityMetrics?.terminalPathCount === 1 ? "" : "es"}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-foreground">Hop Timeline</h3>
              <p className="text-sm text-muted-foreground">
                Follow how quickly the trace reaches bridges, exchanges, or other terminal destinations.
              </p>
            </div>

            {timelineEntries.length > 0 ? (
              <div className="grid gap-4">
                {timelineEntries.map((entry) => (
                  <article key={entry.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                    <div className="grid gap-2">
                      <span className="inline-flex w-fit rounded-full bg-cyan/10 px-2 py-1 text-[11px] font-semibold text-cyan">
                        {entry.gapLabel}
                      </span>
                      <strong className="text-base font-semibold text-foreground">{entry.title}</strong>
                      <span className="text-sm text-muted-foreground">{entry.subtitle}</span>
                      <span className="text-sm text-muted-foreground">{entry.timestampLabel}</span>
                      {entry.terminalLabel ? <span className="pill">{entry.terminalLabel}</span> : null}
                      <span className="code">{entry.txHash}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 p-6 text-center">
                <p className="max-w-[220px] text-sm text-muted-foreground">
                  No terminal exit detected yet.
                  <br />
                  Timeline will appear once funds reach exchanges or bridges.
                </p>
              </div>
            )}
          </div>
        </InspectorPanel>
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

function resolveUrgencyCardClassName(toneClass: string): string {
  if (toneClass.includes("critical")) {
    return "rounded-xl border border-red-500 bg-red-500/10 p-4";
  }
  if (toneClass.includes("active")) {
    return "rounded-xl border border-yellow-500 bg-yellow-500/10 p-4";
  }
  return "rounded-xl border border-green-500 bg-green-500/10 p-4";
}
