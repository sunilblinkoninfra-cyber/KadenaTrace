import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";
import { cn } from "../lib/utils";

export const pageShellClassName =
  "mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-6 px-6 py-6 lg:py-8 animate-slide-in";

export const sectionShellClassName =
  "mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6";

export const twoColumnClassName =
  "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]";

export const sidebarClassName =
  "flex h-full w-full flex-col gap-4 lg:w-[360px]";

export const focusRingClassName =
  "focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-background";

type ButtonVariant = "primary" | "secondary" | "danger" | "subtle";

export function buttonStyles(variant: ButtonVariant = "secondary"): string {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-bold transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50",
    focusRingClassName,
    variant === "primary" &&
      "border-sky-600 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-glow hover:shadow-glow-cyan hover:from-sky-600 hover:to-blue-700",
    variant === "secondary" &&
      "border-slate-200 bg-white/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 shadow-sm",
    variant === "danger" &&
      "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 shadow-sm",
    variant === "subtle" &&
      "border-transparent bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-800"
  );
}

export function Card({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">): ReactElement {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/50 bg-white/70 p-5 shadow-glow backdrop-blur-md transition-all duration-300 hover:shadow-glow-cyan hover:border-white/80",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function InspectorPanel({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"aside">): ReactElement {
  return (
    <aside
      className={cn(
        "mt-0 flex h-full w-full flex-col gap-4 rounded-2xl border border-white/50 bg-white/70 p-5 shadow-glow backdrop-blur-md lg:w-[360px] transition-all duration-300 hover:shadow-glow-cyan",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export function PageShell({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"main">): ReactElement {
  return (
    <main className={cn(pageShellClassName, className)} {...props}>
      {children}
    </main>
  );
}

export function Section({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section">): ReactElement {
  return (
    <section className={cn(sectionShellClassName, className)} {...props}>
      {children}
    </section>
  );
}

export function ErrorStateCard({
  title,
  message,
  children,
  className
}: {
  title: string;
  message: ReactNode;
  children?: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <div
      className={cn(
        "rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-rose-700 shadow-sm backdrop-blur-sm",
        className
      )}
      role="alert"
    >
      <div className="grid gap-2">
        <h2 className="font-display text-lg font-bold text-rose-800">{title}</h2>
        <p className="text-sm leading-6 text-rose-700/90 font-medium">{message}</p>
        {children ? <div className="flex flex-wrap gap-2 pt-2">{children}</div> : null}
      </div>
    </div>
  );
}
