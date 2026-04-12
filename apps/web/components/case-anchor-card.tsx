import type { CaseAnchor } from "@kadenatrace/shared";

export function CaseAnchorCard({ anchor }: { anchor?: CaseAnchor }) {
  return (
    <article className="panel card">
      <div className="trace-meta">
        <span className="pill">Kadena Anchor</span>
        <span className="code">{anchor?.status ?? "not anchored"}</span>
      </div>
      {anchor ? (
        <>
          <p className="muted">
            Request key <span className="code">{anchor.requestKey}</span>
          </p>
          <p className="muted">
            Chain {anchor.chainId} on {anchor.networkId}
          </p>
          <p className="muted">
            Metadata hash <span className="code">{anchor.metadataHash}</span>
          </p>
          {anchor.signerAccount ? (
            <p className="muted">
              Signer <span className="code">{anchor.signerAccount}</span>
            </p>
          ) : null}
          {anchor.signerPublicKey ? (
            <p className="muted">
              Public key <span className="code">{anchor.signerPublicKey}</span>
            </p>
          ) : null}
          {anchor.blockHeight ? <p className="muted">Block height {anchor.blockHeight}</p> : null}
          {anchor.error ? <p className="muted">{anchor.error}</p> : null}
          {anchor.txPreview ? (
            <>
              <h4>Command preview</h4>
              <pre style={{ whiteSpace: "pre-wrap" }}>{anchor.txPreview}</pre>
            </>
          ) : null}
        </>
      ) : (
        <p className="muted">This case has not been anchored yet. Create a public case and submit the anchor step.</p>
      )}
    </article>
  );
}
