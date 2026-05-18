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
        <div className="mb-2">
          <span className="pill">Observability Dashboard</span>
          <h1 className="mt-2 text-3xl font-black text-slate-800 font-display uppercase tracking-tight">
            Attestations Dashboard
          </h1>
        </div>
        <ErrorStateCard
          title="Unable to connect to the tracing engine"
          message="The backend is waking up, unreachable, or temporarily unavailable. Retry the dashboard or use the demo investigation."
        >
          <div className="flex gap-3">
            <Link href="/attestations" className={buttonStyles("secondary")}>
              Retry
            </Link>
            <Link href="/trace/demo" className={buttonStyles("primary")}>
              Use Demo
            </Link>
          </div>
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="pill">Public Audits</span>
          <h1 className="mt-2 text-3xl font-black text-slate-800 font-display uppercase tracking-tight">
            Attestations Ledger
          </h1>
          <p className="text-sm font-semibold text-slate-500 mt-1 leading-relaxed max-w-xl">
            Live cryptographic ledger states registered on-chain for formal tracing disputes, block validations, and risk ratings.
          </p>
        </div>
        <div className="text-xs font-bold text-slate-500 bg-white border border-slate-200 shadow-sm px-4 py-2.5 rounded-xl">
          Total Anchor Attestations: <span className="font-display text-sky-600 font-black ml-1 text-sm">{allAttestations.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
        {[
          { label: "Critical Risk Anchors", value: counts.critical, tone: "border-red-200 bg-red-50 text-red-700" },
          { label: "High Risk Anchors", value: counts.high, tone: "border-amber-200 bg-amber-50 text-amber-700" },
          { label: "Medium Risk Anchors", value: counts.medium, tone: "border-sky-200 bg-sky-50 text-sky-700" },
          { label: "Low Risk Anchors", value: counts.low, tone: "border-emerald-200 bg-emerald-50 text-emerald-700" }
        ].map((item) => (
          <div
            key={item.label}
            className={`rounded-2xl border p-4.5 shadow-sm hover:scale-[1.01] transition-transform duration-200 ${item.tone}`}
          >
            <span className="block text-[10px] font-extrabold uppercase tracking-wider opacity-80 font-display">
              {item.label}
            </span>
            <strong className="block mt-2 font-display text-2xl font-black tracking-tight">
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white/95 to-slate-50/50 p-5 shadow-sm stack">
        <h2 className="text-lg font-black text-slate-800 font-display pb-3.5 border-b border-slate-200/60">
          Recent Blockchain Attestations
        </h2>
        <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/60">
                <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Wallet Address</th>
                <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Network Chain</th>
                <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Risk Rating</th>
                <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Score Verdict</th>
                <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Case Registry</th>
                <th className="px-4 py-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">Block Height</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-600">
              {recent.map((a, i) => (
                <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3.5">
                    <Link 
                      href={`/case/${a.caseSlug}`} 
                      className="font-mono font-bold text-sky-600 bg-sky-50 border border-sky-200/40 px-2 py-1 rounded-md"
                    >
                      {a.wallet.slice(0, 10)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-800 uppercase">{a.chain}</td>
                  <td className="px-4 py-3.5"><RiskBadge level={a.riskLevel} /></td>
                  <td className="px-4 py-3.5 font-mono text-slate-700">{a.riskScore}/100</td>
                  <td className="px-4 py-3.5 font-mono break-all font-semibold">
                    <Link 
                      href={`/case/${a.caseSlug}`}
                      className="text-slate-800 hover:text-sky-600 underline decoration-slate-200 hover:decoration-sky-400"
                    >
                      {a.caseSlug}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-500">{a.blockHeight ?? "N/A"}</td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-semibold">
                    No recent blockchain attestations recorded.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}
