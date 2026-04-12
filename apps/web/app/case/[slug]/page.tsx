import type { Metadata } from "next";
import Link from "next/link";

import { AttestationPanel } from "../../../components/attestation-panel";
import { CaseAnchorCard } from "../../../components/case-anchor-card";
import { CopyShareLinkButton } from "../../../components/copy-share-link-button";
import { RiskBadge } from "../../../components/risk-badge";
import { SummaryCards } from "../../../components/summary-cards";
import { TraceGraphPanel } from "../../../components/trace-graph-panel";
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

export default async function PublicCasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fraudCase = await fetchCase(slug);
  const disputeFlowEnabled = process.env.DISPUTE_FLOW_ENABLED === "true";

  if (!fraudCase) {
    return (
      <main className="shell">
        <div className="panel card">
          <h1 className="section-title">Public case not found</h1>
          <p className="muted">The slug may be wrong, or the API has not seeded the example case yet.</p>
          <Link href="/" className="ghost-button">
            Back to dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="shell grid" style={{ gap: 22 }}>
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
              <a href="#dispute-flow" className="ghost-button">
                Raise Dispute
              </a>
            ) : null}
            <Link href="/" className="ghost-button">
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

      <SummaryCards metrics={fraudCase.trace.metrics} graph={fraudCase.trace.graph} seed={fraudCase.seed} />

      <section className="grid two-up">
        <article className="panel stack">
          <h2 className="section-title">Case narrative</h2>
          <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
            {fraudCase.narrative}
          </p>
          <h3>Evidence references</h3>
          <div className="findings-list">
            {fraudCase.sourceRefs.map((source) => (
              <article key={source.id} className="finding">
                <div className="trace-meta">
                  <span className="pill">{source.type}</span>
                  {source.chain ? <span className="code">{source.chain}</span> : null}
                </div>
                <p>{source.label}</p>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="ghost-button">
                    Open source
                  </a>
                ) : null}
              </article>
            ))}
          </div>
        </article>
        <div className="grid" style={{ gap: 16 }}>
          <WalletConnectionCard />
          <CaseAnchorCard anchor={fraudCase.anchor} />
        </div>
      </section>

      <TraceGraphPanel
        graph={fraudCase.trace.graph}
        findings={fraudCase.trace.findings}
        metrics={fraudCase.trace.metrics}
        suspiciousPaths={fraudCase.trace.suspiciousPaths}
        seedValue={fraudCase.seed.seedValue}
        title="Frozen trace snapshot"
        subtitle="This public case view replays the frozen graph, risk findings, and path explanations that back the published narrative."
      />

      <section className="panel stack">
        <h2 className="section-title">Risk findings</h2>
        <div className="findings-list">
          {fraudCase.trace.findings.map((finding) => (
            <article key={`${finding.code}-${finding.explanation}`} className="finding">
              <div className="trace-meta">
                <span className="pill">{finding.code}</span>
                <RiskBadge level={finding.severity === "critical" ? "critical" : finding.severity} />
                <span className="muted">{(finding.confidence * 100).toFixed(0)}% confidence</span>
              </div>
              <p>{finding.explanation}</p>
            </article>
          ))}
        </div>
      </section>

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
                  <p>
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
            If you believe this fraud case was anchored in error, you can raise
            a formal on-chain dispute. The <code>raise-dispute</code> defpact
            requires a case ID, a unique dispute ID, and a SHA-256 hash of your
            reason document. Step 2 of the pact requires the governance keyset
            to review and mark the dispute.
          </p>
          <div className="panel card" style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 8 }}>How to raise a dispute</h3>
            <ol
              style={{
                paddingLeft: "1.2rem",
                fontSize: "13px",
                color: "var(--color-text-secondary)",
                lineHeight: 1.8
              }}
            >
              <li>
                Install the Pact CLI from{" "}
                <a href="https://github.com/kadena-io/pact/releases" target="_blank" rel="noreferrer">
                  github.com/kadena-io/pact
                </a>
                .
              </li>
              <li>
                Prepare a dispute reason document and compute its SHA-256 hash:
                <br />
                <code>echo -n "your reason text" | sha256sum</code>
              </li>
              <li>
                Call <code>raise-dispute</code> on the deployed module with your
                dispute ID, case ID <code>{fraudCase.caseId}</code>, and the
                reason hash.
              </li>
              <li>
                After submission, the governance keyset must sign step 2 to
                mark the dispute as reviewed.
              </li>
            </ol>
            <p className="muted" style={{ marginTop: 8, fontSize: "12px" }}>
              Case ID: <code>{fraudCase.caseId}</code>
              {fraudCase.anchor?.requestKey
                ? ` — Anchored at request key: ${fraudCase.anchor.requestKey}`
                : ""}
            </p>
          </div>
        </section>
      ) : null}
    </main>
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
