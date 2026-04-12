"use client";

import { KadenaWalletProvider } from "@kadena/wallet-adapter-react";
import { createChainweaverLegacyAdapter } from "@kadena/wallet-adapter-chainweaver-legacy";
import { createEckoAdapter } from "@kadena/wallet-adapter-ecko";
import type { ReactNode } from "react";

const adapters = [createEckoAdapter(), createChainweaverLegacyAdapter()];

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <KadenaWalletProvider adapters={adapters} defaultAdapterName="Ecko">
      {children}
    </KadenaWalletProvider>
  );
}

