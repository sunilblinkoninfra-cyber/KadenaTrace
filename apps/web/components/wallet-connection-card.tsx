"use client";

import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";

export function WalletConnectionCard() {
  const wallet = useKadenaWalletSession();

  return (
    <article className="rounded-xl border border-border bg-card p-6 shadow-card transition-colors">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <span className="inline-flex items-center rounded-full bg-cyan/10 px-2.5 py-0.5 text-xs font-semibold text-cyan">Kadena Wallet</span>
        <span className="font-mono text-xs font-medium text-muted-foreground">{wallet.targetNetworkId}</span>
      </div>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Wallet adapter
          <select
            className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-cyan focus:bg-secondary focus:ring-1 focus:ring-cyan"
            value={wallet.currentAdapterName ?? ""}
            onChange={(event) => wallet.setCurrentAdapterName(event.target.value || null)}
          >
            {wallet.detectedAdapters.length === 0 ? <option value="">No wallet detected</option> : null}
            {wallet.detectedAdapters.map((adapter) => (
              <option key={adapter.name} value={adapter.name}>
                {adapter.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <span className="rounded-md bg-secondary/30 px-3 py-2 truncate">
            <span className="font-semibold block mb-1">Account</span>
            <span className="font-mono">{wallet.activeAccount?.accountName ?? "Not connected"}</span>
          </span>
          <span className="rounded-md bg-secondary/30 px-3 py-2 truncate">
            <span className="font-semibold block mb-1">Network</span>
            <span className="font-mono">{wallet.activeNetwork?.networkId ?? "Unknown"}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button className="inline-flex items-center justify-center rounded-md bg-cyan-gradient px-4 py-2 text-sm font-semibold text-background shadow-glow transition-all hover:scale-[1.02] hover:opacity-90 active:scale-[0.98]" type="button" onClick={wallet.connect}>
            {wallet.activeAccount ? "Reconnect Wallet" : "Connect Wallet"}
          </button>
          {wallet.activeAccount ? (
            <button className="inline-flex items-center justify-center rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-risk-high/50 hover:bg-risk-high-bg hover:text-risk-high" type="button" onClick={wallet.disconnect}>
              Disconnect
            </button>
          ) : null}
          {wallet.networkMismatch ? (
            <button className="inline-flex items-center justify-center rounded-md border border-border bg-secondary/50 px-4 py-2 text-sm font-medium text-foreground transition-all hover:border-cyan hover:bg-secondary" type="button" onClick={wallet.switchToTargetNetwork}>
              Switch to {wallet.targetNetworkId}
            </button>
          ) : null}
        </div>
        {wallet.walletError ? <p className="rounded-md bg-risk-high-bg p-3 text-sm text-risk-high">{wallet.walletError}</p> : null}
        {!wallet.currentAdapterName && wallet.detectedAdapters.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Install Ecko or run Chainweaver Legacy locally to enable live Kadena signing.
          </p>
        ) : null}
      </div>
    </article>
  );
}
