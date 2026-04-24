"use client";

import { useState, type ReactElement } from "react";

export function VerificationStrip({
  traceHash
}: {
  traceHash: string;
}): ReactElement {
  const [showCommand, setShowCommand] = useState(false);
  const [copied, setCopied] = useState(false);
  const verifyCommand = `npm run verify-trace -- ${traceHash}`;

  const copyHash = async (): Promise<void> => {
    await navigator.clipboard.writeText(traceHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="verification-strip panel">
      <div className="verification-strip-copy">
        <div className="trace-meta">
          <span className="pill">Verified on Kadena</span>
          <span className="muted">Cryptographic verification</span>
        </div>
        <h2 className="section-title">Trace Hash</h2>
        <p className="verification-explainer">
          This trace has been cryptographically verified and can be independently reproduced.
        </p>
        <span className="code verification-code">{traceHash}</span>
      </div>

      <div className="verification-strip-actions">
        <button className="ghost-button" type="button" onClick={() => void copyHash()}>
          {copied ? "Hash copied" : "Copy Hash"}
        </button>
        <button className="ghost-button" type="button" onClick={() => setShowCommand((current) => !current)}>
          Verify via CLI
        </button>
      </div>

      {showCommand ? (
        <div className="verification-command">
          <span className="muted">Run this locally to verify the trace hash:</span>
          <code>{verifyCommand}</code>
        </div>
      ) : null}
    </section>
  );
}
