import Link from "next/link";
import { getPublicCases } from "../../lib/api";
import { RiskBadge } from "../../components/risk-badge";

export const dynamic = "force-dynamic";

export default async function AttestationsPage() {
  const cases = await getPublicCases();
  if (!cases) return null;

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
    <main className="shell stack">
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

      <div className="panel card" style={{ marginTop: 24 }}>
        <h3>Recent Attestations</h3>
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
                <td className="code"><Link href={`/case/${a.caseSlug}`}>{a.wallet.slice(0, 10)}...</Link></td>
                <td>{a.chain}</td>
                <td><RiskBadge level={a.riskLevel} /></td>
                <td>{a.riskScore}/100</td>
                <td><Link href={`/case/${a.caseSlug}`}>{a.caseSlug}</Link></td>
                <td>{a.blockHeight ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
