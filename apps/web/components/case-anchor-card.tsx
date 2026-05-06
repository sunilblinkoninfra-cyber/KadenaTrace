import type { CaseAnchor } from "@kadenatrace/shared";
import { Card } from "./ui";

export function CaseAnchorCard({ anchor }: { anchor?: CaseAnchor }) {
  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-4">
        <span className="pill">Kadena Anchor</span>
        <span className="font-mono text-xs font-medium text-muted-foreground">{anchor?.status ?? "not anchored"}</span>
      </div>
      {anchor ? (
        <div className="grid gap-2 text-sm text-foreground/80">
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
            <div className="grid gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Command preview</h4>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-gray-800 bg-gray-950 p-3 font-mono text-xs text-muted-foreground">{anchor.txPreview}</pre>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted-foreground">This case has not been anchored yet. Create a public case and submit the anchor step.</p>
      )}
    </Card>
  );
}
