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
          <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2 sm:gap-2.5 transition-opacity hover:opacity-80 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-gradient text-primary-foreground shadow-glow">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                  KadenaTrace
                </span>
              </Link>
              
              <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium shrink-0">
                <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
                  Trace
                </Link>
                <Link href="/waterfall" className="text-muted-foreground transition-colors hover:text-foreground">
                  Waterfall
                </Link>
                <Link href="/attestations" className="text-muted-foreground transition-colors hover:text-foreground">
                  Attestations
                </Link>
              </nav>
            </div>
          </header>
          
          <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">
            {children}
          </div>
        </WalletProviders>
      </body>
    </html>
  );
}
