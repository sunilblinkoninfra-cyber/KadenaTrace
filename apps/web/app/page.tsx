import Link from "next/link";

import { SearchForm } from "../components/search-form";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="shell">
      <div className="hero" style={{ minHeight: "70vh", alignItems: "center" }}>
        <div className="hero-main" style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ marginBottom: "24px" }}>
            <span className="mode-badge">Ethereum • 2-Hop Trace</span>
          </div>
          
          <h1 className="hero-title">
            Trace suspicious<br />
            <span style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              blockchain funds
            </span>
          </h1>
          
          <p className="hero-lede" style={{ margin: "0 auto 32px" }}>
            KadenaTrace follows wallet transactions, identifies risk patterns like fan-out bursts, rapid hops, and large fund splits — transforming complex blockchain data into clear, verifiable investigations.
          </p>

          <SearchForm />

          <div style={{ marginTop: "32px", display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/trace/demo" className="ghost-button">
              View Demo Investigation
            </Link>
            <span className="muted" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
              <span style={{ width: "8px", height: "8px", background: "#22c55e", borderRadius: "50%" }}></span>
              Live tracing available
            </span>
          </div>
        </div>
      </div>

      <section className="grid three-up" style={{ marginTop: "48px" }}>
        <article className="panel card" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>🔍</div>
          <h2 className="section-title">2-Hop Analysis</h2>
          <p className="muted">
            Traces transactions 2 hops deep to identify immediate fund movements and splitting patterns.
          </p>
        </article>
        <article className="panel card" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>🚨</div>
          <h2 className="section-title">Risk Detection</h2>
          <p className="muted">
            Automatically flags fan-out bursts, rapid hops, large splits, and other suspicious patterns.
          </p>
        </article>
        <article className="panel card" style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "32px", marginBottom: "16px" }}>✔</div>
          <h2 className="section-title">Verifiable</h2>
          <p className="muted">
            Every trace generates a hash for independent verification and audit trails.
          </p>
        </article>
      </section>
    </main>
  );
}