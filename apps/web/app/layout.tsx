import "./globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";
import { Activity } from "lucide-react";

import { WalletProviders } from "../components/wallet-providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KadenaTrace | Verifiable Blockchain Forensics",
  description: "Advanced trace analysis and fraud tracking across chains."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground font-sans selection:bg-cyan/20 selection:text-foreground" suppressHydrationWarning>
        <WalletProviders>
          <header className="sticky top-0 z-50 w-full border-b border-gray-800 bg-background/90 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-screen-xl items-center justify-between px-6">
              <Link
                href="/"
                className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-primary-foreground">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
                  KadenaTrace
                </span>
              </Link>

              <nav className="flex shrink-0 items-center gap-4 text-sm font-medium">
                <Link
                  href="/"
                  className="text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:text-foreground"
                >
                  Trace
                </Link>
                <Link
                  href="/waterfall"
                  className="text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:text-foreground"
                >
                  Waterfall
                </Link>
                <Link
                  href="/attestations"
                  className="text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:text-foreground"
                >
                  Attestations
                </Link>
              </nav>
            </div>
          </header>

          <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">{children}</div>
        </WalletProviders>
      </body>
    </html>
  );
}
