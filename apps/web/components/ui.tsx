import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react";

import { cn } from "../lib/utils";

export const pageShellClassName =
  "mx-auto flex w-full max-w-screen-xl flex-1 flex-col gap-6 px-6 py-6 lg:py-8";

export const sectionShellClassName =
  "mx-auto flex w-full max-w-screen-xl flex-col gap-6 px-6";

export const twoColumnClassName =
  "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]";

export const sidebarClassName =
  "flex h-full w-full flex-col gap-4 xl:w-[360px]";

export const focusRingClassName =
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950";

type ButtonVariant = "primary" | "secondary" | "danger" | "subtle";

export function buttonStyles(variant: ButtonVariant = "secondary"): string {
  return cn(
    "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    focusRingClassName,
    variant === "primary" && "bg-blue-600 text-white hover:bg-blue-500",
    variant === "secondary" && "bg-gray-800 text-gray-100 hover:bg-gray-700",
    variant === "danger" && "bg-red-600 text-white hover:bg-red-500",
    variant === "subtle" && "border border-gray-800 bg-gray-900 text-gray-100 hover:border-gray-700 hover:bg-gray-800"
  );
}

export function Card({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"div">): ReactElement {
  return (
    <div
      className={cn("rounded-xl border border-gray-800 bg-gray-900 p-4", className)}
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
        "mt-0 flex h-full w-full flex-col gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 xl:w-[360px]",
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
        "rounded-xl border border-red-500 bg-red-500/10 p-4 text-red-400",
        className
      )}
      role="alert"
    >
      <div className="grid gap-2">
        <h2 className="text-lg font-medium text-red-300">{title}</h2>
        <p className="text-sm leading-6 text-red-200/80">{message}</p>
        {children ? <div className="flex flex-wrap gap-2 pt-2">{children}</div> : null}
      </div>
    </div>
  );
}
