import Link from "next/link";
import { SearchForm } from "../components/search-form";
import { Shield, Zap, Search } from "lucide-react";
import { buttonStyles } from "../components/ui";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-cyan/12 blur-[130px]" />
      <div className="pointer-events-none absolute -left-32 top-36 h-[420px] w-[420px] rounded-full bg-primary/8 blur-[110px]" />
      <div className="pointer-events-none absolute -right-28 bottom-24 h-[420px] w-[420px] rounded-full bg-blue-400/10 blur-[110px]" />

      <div className="relative z-10 mx-auto flex max-w-screen-xl flex-col gap-6 px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center animate-slide-in" style={{ animationDelay: '0ms' }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan"></span>
              </span>
              Ethereum • 2-Hop Trace
            </span>
          </div>

          <h1 className="mb-6 font-display text-5xl font-semibold tracking-tight text-foreground sm:text-7xl animate-slide-in" style={{ animationDelay: '100ms' }}>
            Trace suspicious<br />
            <span className="bg-gradient-to-r from-cyan to-blue-600 bg-clip-text text-transparent">
              blockchain funds
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-muted-foreground animate-slide-in" style={{ animationDelay: '200ms' }}>
            KadenaTrace follows wallet transactions, identifies risk patterns like fan-out bursts, rapid hops, and large fund splits — transforming complex blockchain data into clear, verifiable investigations.
          </p>

          <div className="animate-slide-in" style={{ animationDelay: '300ms' }}>
            <SearchForm />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 animate-slide-in" style={{ animationDelay: '400ms' }}>
            <Link href="/trace/demo" className={buttonStyles("secondary")}>
              View Demo Investigation
            </Link>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-green-400"></span>
              Live tracing available
            </div>
          </div>
        </div>

        <div className="mt-32 grid gap-6 sm:grid-cols-3 animate-slide-in" style={{ animationDelay: '500ms' }}>
          <FeatureCard 
            icon={<Search className="h-6 w-6 text-cyan" />}
            title="2-Hop Analysis"
            description="Traces transactions 2 hops deep to identify immediate fund movements and splitting patterns."
          />
          <FeatureCard 
            icon={<Zap className="h-6 w-6 text-risk-med" />}
            title="Risk Detection"
            description="Automatically flags fan-out bursts, rapid hops, large splits, and other suspicious patterns."
          />
          <FeatureCard 
            icon={<Shield className="h-6 w-6 text-risk-low" />}
            title="Verifiable"
            description="Every trace generates a hash for independent verification and audit trails."
          />
        </div>
      </div>
    </main>
  );
}

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gray-900 p-6 transition-colors hover:border-gray-700">
    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gray-800 ring-1 ring-gray-700">
      {icon}
    </div>
    <h3 className="mb-2 text-lg font-medium text-foreground">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);
