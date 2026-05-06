import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { AttestationPanel } from "../../../components/attestation-panel";
import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { CopyShareLinkButton } from "../../../components/copy-share-link-button";
import { DisputePanel } from "../../../components/dispute-panel";
import { RiskBadge } from "../../../components/risk-badge";
import { TraceOverview } from "../../../components/trace-overview";
import { ErrorStateCard, PageShell, buttonStyles } from "../../../components/ui";
import { WalletConnectionCard } from "../../../components/wallet-connection-card";
import { fetchCase } from "../../../lib/api";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const caseData = await fetchCase(slug);

  if (!caseData) {
    return {
      title: "Case not found | KadenaTrace",
      description: "KadenaTrace public case"
    };
  }

  return {
    title: `${caseData.title} | KadenaTrace`,
    description: caseData.summary,
    openGraph: {
      title: `${caseData.title} | KadenaTrace`,
      description: caseData.summary,
      type: "article",
      url: `https://kadenatrace.app/case/${slug}`
    },
    twitter: {
      card: "summary",
      title: `${caseData.title} | KadenaTrace`,
      description: caseData.summary
    }
  };
}

export default async function PublicCasePage({ params }: { params: Promise<{ slug: string }> }): Promise<ReactElement> {
  const { slug } = await params;
  const fraudCase = await fetchCase(slug);
  const disputeFlowEnabled = process.env.DISPUTE_FLOW_ENABLED === "true";

  if (!fraudCase) {
    return (
      <PageShell>
        <ErrorStateCard
          title="Public case not found"
          message="The share link may be wrong, or the public case is not available yet."
        >
          <Link href="/" className={buttonStyles("secondary")}>
            Back to dashboard
          </Link>
        </ErrorStateCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className={getVerificationBannerClassName(fraudCase.anchor?.status)}>
        {fraudCase.anchor?.status === "confirmed"
          ? `✓ Anchored on Kadena testnet04 — Block ${fraudCase.anchor.blockHeight ?? "pending"} — Request key: ${fraudCase.anchor.requestKey}`
          : fraudCase.anchor
            ? "⏳ Anchor submitted, awaiting confirmation"
            : "⚠ Not yet anchored — anchor this case via the trace page"}
      </div>

      <section className="panel stack">
        <div className="page-header">
          <div>
            <span className="pill">Public Fraud Case</span>
            <h1 className="section-title">{fraudCase.title}</h1>
            <p className="lede">{fraudCase.summary}</p>
          </div>
          <div className="actions">
            <CopyShareLinkButton />
            {disputeFlowEnabled ? (
              <a href="#dispute-flow" className={buttonStyles("secondary")}>
                Raise Dispute
              </a>
            ) : null}
            <Link href="/" className={buttonStyles("secondary")}>
              New trace
            </Link>
          </div>
        </div>
        <div className="trace-meta">
          <span className="code">{fraudCase.seed.seedValue}</span>
          <span className="pill">{fraudCase.seed.chain}</span>
          <span className="muted">Updated {new Date(fraudCase.updatedAt).toLocaleString()}</span>
        </div>
      </section>

      <section className="grid two-up">
        <article className="panel stack">
          <h2 className="section-title">Case narrative</h2>
          <p className="muted whitespace-pre-wrap">
            {fraudCase.narrative}
          </p>
          <h3 className="text-lg font-medium text-gray-100">Evidence references</h3>
          <div className="findings-list">
            {fraudCase.sourceRefs.map((source) => (
              <article key={source.id} className="finding">
                <div className="trace-meta">
                  <span className="pill">{source.type}</span>
                  {source.chain ? <span className="code">{source.chain}</span> : null}
                </div>
                <p className="break-words text-base font-medium text-gray-100">{source.label}</p>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className={buttonStyles("secondary")}>
                    Open source
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </article>
        <div className="grid gap-4">
          <WalletConnectionCard />
          <CaseAnchorCard anchor={fraudCase.anchor} />
        </div>
      </section>

      <TraceOverview
        trace={fraudCase.trace}
        traceId={fraudCase.trace.traceId}
        graphTitle="Frozen trace snapshot"
        graphSubtitle="This public case view replays the frozen graph, risk findings, and path explanations that back the published narrative."
        showVerificationStrip={false}
        autoScrollSummary={false}
      />

      <section className="grid two-up">
        <AttestationPanel fraudCase={fraudCase} />
        <article className="panel stack">
          <h2 className="section-title">Published attestations</h2>
          <div className="findings-list">
            {fraudCase.attestations.length > 0 ? (
              fraudCase.attestations.map((attestation, index) => (
                <article key={`${attestation.requestKey ?? attestation.attestationId ?? index}`} className="finding">
                  <div className="trace-meta">
                    <span className="pill">{attestation.chain}</span>
                    <RiskBadge level={attestation.riskLevel} />
                  </div>
                  <p className="break-words text-base font-medium text-gray-100">
                    {attestation.wallet} scored {attestation.riskScore}/100 by {attestation.signer}
                  </p>
                  {attestation.note ? <p className="muted">{attestation.note}</p> : null}
                  {attestation.requestKey ? <span className="code">{attestation.requestKey}</span> : null}
                  {attestation.blockHeight ? <p className="muted">Block height {attestation.blockHeight}</p> : null}
                </article>
              ))
            ) : (
              <article className="finding">
                <p className="muted">No live attestations have been published for this case yet.</p>
              </article>
            )}
          </div>
        </article>
      </section>

      {disputeFlowEnabled ? (
        <section id="dispute-flow" className="panel stack">
          <h2 className="section-title">Dispute this case</h2>
          <p className="muted">
            If you believe this case was anchored incorrectly, raise a formal on-chain dispute. Your reason is hashed
            locally before being committed — the raw text never leaves your browser. Step 2 requires the governance
            keyset to review and resolve.
          </p>
          <DisputePanel caseId={fraudCase.caseId} caseSlug={fraudCase.slug} />
        </section>
      ) : null}
    </PageShell>
  );
}

function getVerificationBannerClassName(status: string | undefined): string {
  if (status === "confirmed") {
    return "verification-banner verification-banner--confirmed";
  }
  if (status) {
    return "verification-banner verification-banner--pending";
  }
  return "verification-banner verification-banner--missing";
}
