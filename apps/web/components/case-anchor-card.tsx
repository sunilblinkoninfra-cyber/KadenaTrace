import type { CaseAnchor } from "@kadenatrace/shared/client";

export function CaseAnchorCard({ anchor }: { anchor?: CaseAnchor }) {
  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-card transition-colors">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <span className="inline-flex items-center rounded-full bg-cyan/10 px-2.5 py-0.5 text-xs font-semibold text-cyan">Kadena Anchor</span>
        <span className="font-mono text-xs font-medium text-muted-foreground">{anchor?.status ?? "not anchored"}</span>
      </div>
      {anchor ? (
        <div className="flex flex-col gap-3 text-sm text-foreground/80">
          <p>
            Request key <span className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{anchor.requestKey}</span>
          </p>
          <p>
            Chain {anchor.chainId} on {anchor.networkId}
          </p>
          <p>
            Metadata hash <span className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{anchor.metadataHash}</span>
          </p>
          {anchor.signerAccount ? (
            <p>
              Signer <span className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{anchor.signerAccount}</span>
            </p>
          ) : null}
          {anchor.signerPublicKey ? (
            <p>
              Public key <span className="rounded bg-secondary/50 px-1.5 py-0.5 font-mono text-xs text-muted-foreground">{anchor.signerPublicKey}</span>
            </p>
          ) : null}
          {anchor.blockHeight ? <p>Block height {anchor.blockHeight}</p> : null}
          {anchor.error ? <p className="text-risk-high">{anchor.error}</p> : null}
          {anchor.txPreview ? (
            <div className="mt-2">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Command preview</h4>
              <pre className="rounded-md border border-border bg-secondary/30 p-3 font-mono text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap">{anchor.txPreview}</pre>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">This case has not been anchored yet. Create a public case and submit the anchor step.</p>
      )}
    </article>
  );
}
