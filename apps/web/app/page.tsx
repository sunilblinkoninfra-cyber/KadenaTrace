import Link from "next/link";

import { getPublicCases } from "../lib/api";
import { SearchForm } from "../components/search-form";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const publicCases = (await getPublicCases()) ?? [];

  return (
    <main className="shell grid" style={{ gap: 28 }}>
      <section className="hero">
        <div className="hero-card panel">
          <span className="pill">Hybrid Fraud Tracing</span>
          <h1 className="headline">Make stolen-funds stories visible, verifiable, and auditable.</h1>
          <p className="lede">
            KadenaTrace follows wallet-to-wallet laundering paths across Ethereum, BSC, and Bitcoin, highlights risk
            signals, and turns investigations into public cases that can be anchored on Kadena.
          </p>
        </div>
        <div className="panel stack">
          <SearchForm />
        </div>
      </section>

      <section className="grid three-up">
        <article className="panel card">
          <h2 className="section-title">Trace recursively</h2>
          <p className="muted">
            Expand from a compromised wallet or transaction hash and preserve the branching flow as an evidence-backed
            graph.
          </p>
        </article>
        <article className="panel card">
          <h2 className="section-title">Explain the risk</h2>
          <p className="muted">
            Fan-out bursts, rapid hops, bridge exits, mixer touchpoints, and exchange sink consolidation are scored
            deterministically.
          </p>
        </article>
        <article className="panel card">
          <h2 className="section-title">Anchor the case</h2>
          <p className="muted">
            Freeze the investigation snapshot off-chain, hash the metadata, and attach an auditable Pact record for
            public verification.
          </p>
        </article>
      </section>

      <section className="panel stack">
        <div className="page-header">
          <div>
            <span className="pill">Public Investigations</span>
            <h2 className="section-title">Pre-seeded demo investigations</h2>
          </div>
          <Link className="ghost-button" href="/trace/demo">
            Use Demo Case
          </Link>
        </div>
        <div className="case-list">
          {publicCases.length > 0 ? (
            publicCases.map((item) => (
              <Link key={item.caseId} href={`/case/${item.slug}`} className="case-tile">
                <div className="trace-meta">
                  <span className="pill">{item.seed.chain}</span>
                  <span className="code">{item.seed.seedValue}</span>
                </div>
                <h3>{item.title}</h3>
                <p className="muted">{item.summary}</p>
              </Link>
            ))
          ) : (
            <div className="case-tile">
              <h3>Unable to connect to tracing engine.</h3>
              <p className="muted">
                Possible reasons:
                API waking up (cold start), network issue, or the backend is unavailable. The demo case below still
                works without the API.
              </p>
              <Link className="ghost-button" href="/trace/demo">
                Open demo investigation
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
