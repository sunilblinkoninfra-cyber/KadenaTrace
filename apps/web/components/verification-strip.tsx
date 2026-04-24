"use client";

import { useState, type ReactElement } from "react";

interface VerificationStripProps {
  traceHash: string;
}

export function VerificationStrip({ traceHash }: VerificationStripProps): ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(traceHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="verification-strip animate-fade-in">
      <span className="check-icon">✓</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: "4px" }}>Verified on Kadena</div>
        <div className="trace-hash" style={{ wordBreak: "break-all", fontSize: "12px" }}>
          {traceHash}
        </div>
      </div>
      <button
        type="button"
        className="ghost-button"
        onClick={handleCopy}
        style={{ fontSize: "12px", padding: "8px 12px" }}
      >
        {copied ? "Copied!" : "Copy Hash"}
      </button>
      <button
        type="button"
        className="ghost-button"
        onClick={() => window.open("https://github.com/sunilblinkoninfra-cyber/KadenaTrace", "_blank")}
        style={{ fontSize: "12px", padding: "8px 12px" }}
      >
        Verify via CLI
      </button>
      <p className="muted" style={{ fontSize: "11px", width: "100%", marginTop: "8px" }}>
        This trace can be independently reproduced using the KadenaTrace CLI.
      </p>
    </div>
  );
}