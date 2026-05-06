// CopyShareLinkButton -- Copies the current public case URL to the clipboard with transient feedback.
"use client";

import { useEffect, useState, type ReactElement } from "react";
import { buttonStyles } from "./ui";

export function CopyShareLinkButton(): ReactElement {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const handleClick = async (): Promise<void> => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  };

  return (
    <div className="share-button-shell">
      <button className={buttonStyles("secondary")} type="button" onClick={() => void handleClick()} aria-label="Copy shareable case link">
        Copy shareable link
      </button>
      {copied ? <span className="share-tooltip">Copied!</span> : null}
    </div>
  );
}
