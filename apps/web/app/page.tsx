import Link from "next/link";
import { SearchForm } from "../components/search-form";
import { Shield, Zap, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="relative flex-1 overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute -left-40 top-40 w-[500px] h-[500px] bg-primary/5 blur-[100px] pointer-events-none rounded-full" />
      <div className="absolute -right-40 bottom-40 w-[500px] h-[500px] bg-indigo-500/5 blur-[100px] pointer-events-none rounded-full" />

      <div className="mx-auto max-w-7xl px-6 py-20 lg:py-32 relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 flex justify-center animate-slide-in" style={{ animationDelay: '0ms' }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500"></span>
              </span>
              Ethereum • 2-Hop Trace
            </span>
          </div>

          <h1 className="font-display text-5xl font-bold tracking-tight text-white sm:text-7xl mb-6 animate-slide-in" style={{ animationDelay: '100ms' }}>
            Trace suspicious<br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              blockchain funds
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground mb-10 animate-slide-in" style={{ animationDelay: '200ms' }}>
            ClearHop follows wallet transactions, identifies risk patterns like fan-out bursts, rapid hops, and large fund splits — transforming complex blockchain data into clear, verifiable investigations.
          </p>

          <div className="animate-slide-in" style={{ animationDelay: '300ms' }}>
            <SearchForm />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 animate-slide-in" style={{ animationDelay: '400ms' }}>
            <Link 
              href="/trace/demo" 
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-white/20 backdrop-blur-sm"
            >
              View Demo Investigation
            </Link>
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              Live tracing available
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="mt-32 grid gap-6 sm:grid-cols-3 animate-slide-in" style={{ animationDelay: '500ms' }}>
          <FeatureCard 
            icon={<Search className="h-6 w-6 text-cyan-400" />}
            title="2-Hop Analysis"
            description="Traces transactions 2 hops deep to identify immediate fund movements and splitting patterns."
          />
          <FeatureCard 
            icon={<Zap className="h-6 w-6 text-orange-400" />}
            title="Risk Detection"
            description="Automatically flags fan-out bursts, rapid hops, large splits, and other suspicious patterns."
          />
          <FeatureCard 
            icon={<Shield className="h-6 w-6 text-emerald-400" />}
            title="Verifiable"
            description="Every trace generates a hash for independent verification and audit trails."
          />
        </div>
      </div>
    </main>
  );
}

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-card/50 p-8 backdrop-blur-sm transition-colors hover:bg-card/80">
    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
      {icon}
    </div>
    <h3 className="mb-3 font-display text-lg font-semibold text-white">{title}</h3>
    <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);