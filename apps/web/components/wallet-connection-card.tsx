"use client";

import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";
import { Card, buttonStyles } from "./ui";

export function WalletConnectionCard() {
  const wallet = useKadenaWalletSession();

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 pb-4">
        <span className="pill">Kadena Wallet</span>
        <span className="font-mono text-xs font-medium text-muted-foreground">{wallet.targetNetworkId}</span>
      </div>
      <div className="grid gap-4">
        <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
          Wallet adapter
          <select
            className="input"
            value={wallet.currentAdapterName ?? ""}
            onChange={(event) => wallet.setCurrentAdapterName(event.target.value || null)}
            aria-label="Wallet adapter"
          >
            {wallet.detectedAdapters.length === 0 ? <option value="">No wallet detected</option> : null}
            {wallet.detectedAdapters.map((adapter) => (
              <option key={adapter.name} value={adapter.name}>
                {adapter.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-2 text-xs text-muted-foreground">
          <span className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-3 truncate">
            <span className="mb-1 block font-semibold">Account</span>
            <span className="font-mono">{wallet.activeAccount?.accountName ?? "Not connected"}</span>
          </span>
          <span className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-3 truncate">
            <span className="mb-1 block font-semibold">Network</span>
            <span className="font-mono">{wallet.activeNetwork?.networkId ?? "Unknown"}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={buttonStyles("primary")} type="button" onClick={wallet.connect}>
            {wallet.activeAccount ? "Reconnect Wallet" : "Connect Wallet"}
          </button>
          {wallet.activeAccount ? (
            <button className={buttonStyles("secondary")} type="button" onClick={wallet.disconnect}>
              Disconnect
            </button>
          ) : null}
          {wallet.networkMismatch ? (
            <button className={buttonStyles("secondary")} type="button" onClick={wallet.switchToTargetNetwork}>
              Switch to {wallet.targetNetworkId}
            </button>
          ) : null}
        </div>
        {wallet.walletError ? <p className="rounded-xl border border-red-500 bg-red-500/10 p-4 text-sm text-red-300">{wallet.walletError}</p> : null}
        {!wallet.currentAdapterName && wallet.detectedAdapters.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Install Ecko or run Chainweaver Legacy locally to enable live Kadena signing.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
