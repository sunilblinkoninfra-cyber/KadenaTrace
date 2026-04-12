"use client";

import { useKadenaWalletSession } from "../lib/use-kadena-wallet-session";

export function WalletConnectionCard() {
  const wallet = useKadenaWalletSession();

  return (
    <article className="panel card">
      <div className="trace-meta">
        <span className="pill">Kadena Wallet</span>
        <span className="code">{wallet.targetNetworkId}</span>
      </div>
      <div className="publish-form grid">
        <label>
          Wallet adapter
          <select
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
        <div className="facts">
          <span className="muted">
            Account: {wallet.activeAccount?.accountName ?? "Not connected"}
          </span>
          <span className="muted">
            Network: {wallet.activeNetwork?.networkId ?? "Unknown"}
          </span>
        </div>
        <div className="actions">
          <button className="button" type="button" onClick={wallet.connect}>
            {wallet.activeAccount ? "Reconnect Wallet" : "Connect Wallet"}
          </button>
          {wallet.activeAccount ? (
            <button className="ghost-button" type="button" onClick={wallet.disconnect}>
              Disconnect
            </button>
          ) : null}
          {wallet.networkMismatch ? (
            <button className="ghost-button" type="button" onClick={wallet.switchToTargetNetwork}>
              Switch to {wallet.targetNetworkId}
            </button>
          ) : null}
        </div>
        {wallet.walletError ? <p className="muted">{wallet.walletError}</p> : null}
        {!wallet.currentAdapterName && wallet.detectedAdapters.length === 0 ? (
          <p className="muted">
            Install Ecko or run Chainweaver Legacy locally to enable live Kadena signing.
          </p>
        ) : null}
      </div>
    </article>
  );
}
