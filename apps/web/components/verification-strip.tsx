import { useState } from "react";
import { Check, Copy, ShieldCheck, Terminal } from "lucide-react";

interface Props {
  traceHash: string;
}

export const VerificationStrip = ({ traceHash }: Props) => {
  const [copied, setCopied] = useState<"hash" | "cli" | null>(null);

  const copy = async (text: string, key: "hash" | "cli") => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const shortHash = `${traceHash.slice(0, 10)}…${traceHash.slice(-8)}`;
  const cliCmd = `kadena verify ${traceHash}`;

  return (
    <section className="border-b border-border bg-surface w-full">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-verified-bg px-2.5 py-1 text-xs font-semibold text-verified">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified on Kadena
          </span>

          <button
            onClick={() => copy(traceHash, "hash")}
            className="group inline-flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs text-foreground/80 transition-smooth hover:border-cyan/50 hover:text-foreground"
            title="Copy trace hash"
          >
            <span className="text-muted-foreground">Trace:</span>
            <span>{shortHash}</span>
            {copied === "hash" ? (
              <Check className="h-3.5 w-3.5 text-verified" />
            ) : (
              <Copy className="h-3.5 w-3.5 opacity-50 group-hover:opacity-100" />
            )}
          </button>

          <span className="hidden text-xs text-muted-foreground sm:inline">
            This trace can be independently reproduced.
          </span>
        </div>

        <button
          onClick={() => copy(cliCmd, "cli")}
          className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-3 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary h-8 gap-2 self-start lg:self-auto"
        >
          <Terminal className="h-3.5 w-3.5" />
          {copied === "cli" ? "Copied!" : "Verify via CLI"}
        </button>
      </div>
    </section>
  );
};
