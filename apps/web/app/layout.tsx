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
  title: "ClearHop | Verifiable Blockchain Forensics",
  description: "Advanced trace analysis and fraud tracking across chains."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen bg-background text-foreground selection:bg-cyan-500/30 font-sans">
        <WalletProviders>
          <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
              <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-gradient text-background shadow-glow">
                  <Activity className="h-5 w-5" />
                </div>
                <span className="font-display text-lg font-bold tracking-tight text-white">ClearHop</span>
              </Link>
              
              <nav className="flex items-center gap-6 text-sm font-medium">
                <Link href="/" className="text-white/70 transition-colors hover:text-white">Trace</Link>
                <Link href="/attestations" className="text-white/70 transition-colors hover:text-white">Attestations</Link>
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
