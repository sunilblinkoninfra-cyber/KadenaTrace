import type { ReactElement } from "react";

import { Card, InspectorPanel, Section, twoColumnClassName } from "./ui";

function SkeletonBlock({
  className
}: {
  className: string;
}): ReactElement {
  return (
    <div
      className={`rounded-md bg-[linear-gradient(90deg,rgba(30,41,59,0.85)_25%,rgba(51,65,85,0.95)_50%,rgba(30,41,59,0.85)_75%)] bg-[length:200%_100%] animate-[shimmer_1.6s_linear_infinite] ${className}`}
    />
  );
}

export function InvestigationSummarySkeleton(): ReactElement {
  return (
    <Section className="pt-0">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="grid gap-4">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-10 w-full" />
          <SkeletonBlock className="h-6 w-5/6" />
          <SkeletonBlock className="h-10 w-full" />
        </Card>
        <Card className="grid gap-4">
          <SkeletonBlock className="h-6 w-24" />
          <SkeletonBlock className="h-20 w-20 rounded-full" />
          <div className="grid grid-cols-2 gap-4">
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
        </Card>
      </div>
    </Section>
  );
}

export function TimelineSkeleton(): ReactElement {
  return (
    <Section className="pt-0">
      <Card className="grid gap-4">
        <SkeletonBlock className="h-6 w-36" />
        <div className="grid gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="grid gap-2 rounded-xl border border-gray-800 bg-gray-950 p-4">
              <SkeletonBlock className="h-5 w-28" />
              <SkeletonBlock className="h-5 w-3/4" />
              <SkeletonBlock className="h-4 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
}

export function GraphSkeleton(): ReactElement {
  return (
    <Section className="pt-0">
      <div className={twoColumnClassName}>
        <Card className="min-h-[520px] grid gap-4">
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-6 w-24" />
            <SkeletonBlock className="h-6 w-28" />
            <SkeletonBlock className="h-6 w-32" />
          </div>
          <div className="min-h-[520px] rounded-xl border border-gray-800 bg-gray-950 p-4">
            <div className="flex h-full min-h-[488px] items-center justify-center rounded-lg border border-gray-800">
              <div className="grid gap-4 text-center">
                <SkeletonBlock className="mx-auto h-12 w-12 rounded-full" />
                <SkeletonBlock className="h-4 w-48" />
              </div>
            </div>
          </div>
        </Card>
        <InspectorPanel>
          <SkeletonBlock className="h-6 w-28" />
          <SkeletonBlock className="h-6 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
          <SkeletonBlock className="mt-auto h-12 w-full" />
        </InspectorPanel>
      </div>
    </Section>
  );
}

export function SummaryCardsSkeleton(): ReactElement {
  return (
    <div className="summary-cards">
      {[0, 1, 2, 3].map((item) => (
        <Card key={item} className="grid gap-2">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-8 w-20" />
        </Card>
      ))}
    </div>
  );
}

export function TraceOverviewSkeleton(): ReactElement {
  return (
    <div className="grid gap-6 pb-10">
      <InvestigationSummarySkeleton />
      <TimelineSkeleton />
      <GraphSkeleton />
    </div>
  );
}
