import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { WalletProviders } from "../components/wallet-providers";

export const metadata: Metadata = {
  title: "KadenaTrace",
  description: "Hybrid fraud tracing with off-chain analytics and Kadena attestations."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProviders>
          <nav className="shell" style={{ display: "flex", gap: "12px", paddingBottom: 0 }}>
            <Link href="/" className="ghost-button">Trace</Link>
            <Link href="/attestations" className="ghost-button">Attestations</Link>
          </nav>
          {children}
        </WalletProviders>
      </body>
    </html>
  );
}
