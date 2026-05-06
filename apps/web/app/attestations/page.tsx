import Link from "next/link";
import { getPublicCases } from "../../lib/api";
import { RiskBadge } from "../../components/risk-badge";
import { ErrorStateCard, PageShell, buttonStyles } from "../../components/ui";

export const dynamic = "force-dynamic";

export default async function AttestationsPage() {
  const cases = await getPublicCases();
  if (!cases || !Array.isArray(cases)) {
    return (
      <PageShell>
        <h1 className="section-title">Attestations Dashboard</h1>
        <ErrorStateCard
          title="Unable to connect to the tracing engine"
          message="The backend is waking up, unreachable, or temporarily unavailable. Retry the dashboard or use the demo investigation."
        >
          <Link href="/attestations" className={buttonStyles("secondary")}>
            Retry
          </Link>
          <Link href="/trace/demo" className={buttonStyles("primary")}>
            Use Demo
          </Link>
        </ErrorStateCard>
      </PageShell>
    );
  }

  const allAttestations = cases.flatMap(c => 
    c.attestations.map(a => ({ ...a, caseSlug: c.slug }))
  ).sort((a, b) => {
    const bTime = new Date(b.submittedAt ?? "0").getTime();
    const aTime = new Date(a.submittedAt ?? "0").getTime();
    return bTime - aTime;
  });

  const recent = allAttestations.slice(0, 20);

  const counts = {
    critical: allAttestations.filter(a => a.riskLevel === "critical").length,
    high: allAttestations.filter(a => a.riskLevel === "high").length,
    medium: allAttestations.filter(a => a.riskLevel === "medium").length,
    low: allAttestations.filter(a => a.riskLevel === "low").length
  };

  return (
    <PageShell>
      <h1 className="section-title">Attestations Dashboard</h1>
      <p className="muted">Total attestations: {allAttestations.length}</p>

      <div className="summary-cards">
        <div className="summary-card">
          <span className="muted">Critical Risk</span>
          <strong>{counts.critical}</strong>
        </div>
        <div className="summary-card">
          <span className="muted">High Risk</span>
          <strong>{counts.high}</strong>
        </div>
        <div className="summary-card">
          <span className="muted">Medium Risk</span>
          <strong>{counts.medium}</strong>
        </div>
        <div className="summary-card">
          <span className="muted">Low Risk</span>
          <strong>{counts.low}</strong>
        </div>
      </div>

      <div className="panel stack">
        <h2 className="text-lg font-medium text-gray-100">Recent Attestations</h2>
        <div className="overflow-x-auto">
          <table className="score-table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Chain</th>
                <th>Risk Level</th>
                <th>Score</th>
                <th>Case</th>
                <th>Block Height</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a, i) => (
                <tr key={i}>
                  <td>
                    <Link href={`/case/${a.caseSlug}`} className="code">
                      {a.wallet.slice(0, 10)}...
                    </Link>
                  </td>
                  <td>{a.chain}</td>
                  <td><RiskBadge level={a.riskLevel} /></td>
                  <td>{a.riskScore}/100</td>
                  <td className="break-words"><Link href={`/case/${a.caseSlug}`}>{a.caseSlug}</Link></td>
                  <td>{a.blockHeight ?? "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
