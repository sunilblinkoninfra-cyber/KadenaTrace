"use client";

import {
  Activity,
  Clock3,
  Database,
  Layers3,
  Search,
  TimerReset
} from "lucide-react";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement
} from "react";

import { cn } from "../lib/utils";
import {
  TIME_SCALE,
  buildSpanRows,
  buildTimelineMarkers,
  formatDurationLabel,
  getVisibleRowWindow,
  mapSpanToTimelineRect,
  summarizeTrace,
  type SpanRow,
  type TraceSpan
} from "../lib/trace-waterfall";

interface TraceWaterfallProps {
  traceId: string;
  spans: TraceSpan[];
}

const LABEL_COLUMN_WIDTH = 360;
const ROW_HEIGHT = 44;
const OVERSCAN = 6;
const MIN_BAR_WIDTH = 4;

export function TraceWaterfall({
  traceId,
  spans
}: TraceWaterfallProps): ReactElement {
  const timelineViewportRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(640);
  const [viewportWidth, setViewportWidth] = useState(880);

  const summary = useMemo(() => summarizeTrace(spans), [spans]);
  const rows = useMemo(() => buildSpanRows(spans), [spans]);
  const filteredRows = useMemo(
    () => filterRows(rows, deferredQuery),
    [rows, deferredQuery]
  );

  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(
    filteredRows[0]?.span.id ?? null
  );

  useEffect(() => {
    if (!timelineViewportRef.current) {
      return;
    }

    const element = timelineViewportRef.current;
    const updateViewport = (): void => {
      setViewportHeight(element.clientHeight || 640);
      setViewportWidth(element.clientWidth || 880);
    };

    updateViewport();

    const observer = new ResizeObserver(() => {
      updateViewport();
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!selectedSpanId || !filteredRows.some((row) => row.span.id === selectedSpanId)) {
      setSelectedSpanId(filteredRows[0]?.span.id ?? null);
    }
  }, [filteredRows, selectedSpanId]);

  const visibleWindow = useMemo(
    () =>
      getVisibleRowWindow({
        scrollTop,
        containerHeight: viewportHeight,
        rowHeight: ROW_HEIGHT,
        totalRows: filteredRows.length,
        overscan: OVERSCAN
      }),
    [filteredRows.length, scrollTop, viewportHeight]
  );

  const visibleRows = filteredRows.slice(
    visibleWindow.startIndex,
    visibleWindow.endIndex + 1
  );

  const totalTimelineWidth = Math.max(
    Math.ceil(summary.totalDuration * TIME_SCALE),
    viewportWidth
  );
  const totalRowsHeight = filteredRows.length * ROW_HEIGHT;
  const timelineMarkers = useMemo(
    () =>
      buildTimelineMarkers({
        traceStart: summary.traceStart,
        totalDuration: summary.totalDuration,
        minimumMarkerCount: Math.max(4, Math.floor(viewportWidth / 150))
      }),
    [summary.totalDuration, summary.traceStart, viewportWidth]
  );

  const selectedSpan =
    filteredRows.find((row) => row.span.id === selectedSpanId)?.span ??
    spans.find((span) => span.id === selectedSpanId) ??
    null;

  const maxDepth = rows.reduce(
    (maximum, row) => Math.max(maximum, row.depth),
    0
  );

  return (
    <section className="panel stack">
      <div className="page-header">
        <div>
          <span className="pill">Observability Waterfall</span>
          <h1 className="section-title">Trace Waterfall</h1>
          <p className="lede mt-2">
            Production-style span timeline with fixed time scaling, sticky labels, and row virtualization for large traces.
          </p>
        </div>
        <div className="trace-meta">
          <StatPill icon={<Activity className="h-3.5 w-3.5" />} label="Trace ID" value={traceId} mono />
          <StatPill icon={<Layers3 className="h-3.5 w-3.5" />} label="Spans" value={`${filteredRows.length}`} />
          <StatPill icon={<Clock3 className="h-3.5 w-3.5" />} label="Duration" value={formatDurationLabel(summary.totalDuration)} />
          <StatPill icon={<Database className="h-3.5 w-3.5" />} label="Depth" value={`${maxDepth + 1} levels`} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm">
        <label className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="input pl-10"
            placeholder="Filter spans by label, id, or metadata"
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              startTransition(() => {
                setQuery(nextValue);
              });
            }}
          />
        </label>

        <div className="trace-meta">
          <span className="pill">Scale {TIME_SCALE.toFixed(2)} px / ms</span>
          <span className="muted">Sticky span labels keep alignment stable while the timeline scrolls.</span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-card">
          <div
            className="grid border-b border-border/80 bg-surface-subtle"
            style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px minmax(0,1fr)` }}
          >
            <div className="border-r border-border/80 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Span hierarchy
              </div>
              <div className="mt-1 text-sm text-foreground">
                Service, operation name, and nesting depth
              </div>
            </div>

            <div className="overflow-hidden px-0 py-0">
              <div
                className="relative h-[62px] border-l border-border/0"
                style={{
                  width: totalTimelineWidth,
                  transform: `translateX(${-scrollLeft}px)`
                }}
              >
                {timelineMarkers.map((marker) => (
                  <div
                    key={marker.timestamp}
                    className="absolute inset-y-0"
                    style={{ left: marker.left }}
                  >
                    <div className="absolute inset-y-0 border-l border-border/70" />
                    <div className="absolute left-2 top-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                      {marker.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="grid place-items-center px-6 py-16 text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
                  <TimerReset className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No spans match this filter</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Try a service name, span label, or metadata key such as <span className="font-mono">status:ok</span>.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="grid"
              style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px minmax(0,1fr)` }}
            >
              <div className="relative h-[640px] overflow-hidden border-r border-border/80 bg-card">
                <div className="relative" style={{ height: totalRowsHeight }}>
                  {visibleRows.map((row, index) => {
                    const rowIndex = visibleWindow.startIndex + index;
                    return (
                      <SpanLabelRow
                        key={row.span.id}
                        row={row}
                        rowIndex={rowIndex}
                        selected={row.span.id === selectedSpanId}
                        onSelect={setSelectedSpanId}
                      />
                    );
                  })}
                </div>
              </div>

              <div
                ref={timelineViewportRef}
                className="relative h-[640px] overflow-auto bg-surface-subtle"
                onScroll={(event) => {
                  setScrollTop(event.currentTarget.scrollTop);
                  setScrollLeft(event.currentTarget.scrollLeft);
                }}
              >
                <div
                  className="relative"
                  style={{
                    width: totalTimelineWidth,
                    height: totalRowsHeight
                  }}
                >
                  {timelineMarkers.map((marker) => (
                    <div
                      key={`${marker.timestamp}-guide`}
                      className="absolute top-0 bottom-0 border-l border-border/60"
                      style={{ left: marker.left }}
                    />
                  ))}

                  {visibleRows.map((row, index) => {
                    const rowIndex = visibleWindow.startIndex + index;
                    return (
                      <SpanTimelineRow
                        key={row.span.id}
                        row={row}
                        rowIndex={rowIndex}
                        traceStart={summary.traceStart}
                        selected={row.span.id === selectedSpanId}
                        onSelect={setSelectedSpanId}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="timeline-sidebar">
          <div className="timeline-header">
            <div className="trace-meta">
              <span className="pill">Span Details</span>
              {selectedSpan ? <span className="muted">{selectedSpan.id}</span> : null}
            </div>
            <p className="muted">
              Select any span row to inspect timing, metadata, and hierarchy context without losing your place in the waterfall.
            </p>
          </div>

          {selectedSpan ? (
            <div className="timeline-list">
              <DetailCard label="Operation" value={selectedSpan.label} />
              <DetailCard label="Start offset" value={formatDurationLabel(selectedSpan.startTime - summary.traceStart)} />
              <DetailCard label="Duration" value={formatDurationLabel(selectedSpan.duration)} />
              <DetailCard label="Parent span" value={selectedSpan.parentId ?? "root"} mono />

              <article className="timeline-entry">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Metadata
                </div>
                <div className="mt-3 grid gap-2">
                  {Object.entries(selectedSpan.metadata).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/85 px-3 py-2"
                    >
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {key}
                      </span>
                      <span className="max-w-[180px] break-words text-right font-mono text-xs text-foreground">
                        {String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : (
            <article className="timeline-entry timeline-entry--empty mt-4">
              <strong>No span selected</strong>
              <span className="timeline-entry-copy">
                Pick a row in the waterfall to inspect its timing and metadata.
              </span>
            </article>
          )}
        </aside>
      </div>
    </section>
  );
}

function SpanLabelRow({
  row,
  rowIndex,
  selected,
  onSelect
}: {
  row: SpanRow;
  rowIndex: number;
  selected: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  return (
    <button
      className={cn(
        "absolute left-0 right-0 border-b border-border/50 px-4 text-left transition-colors",
        selected ? "bg-cyan/8" : "bg-transparent hover:bg-secondary/70"
      )}
      style={{
        top: rowIndex * ROW_HEIGHT,
        height: ROW_HEIGHT
      }}
      type="button"
      onClick={() => onSelect(row.span.id)}
    >
      <div
        className="flex h-full items-center gap-3"
        style={{ paddingLeft: 12 + row.depth * 18 }}
      >
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full",
            row.hasChildren ? "bg-cyan" : "bg-border"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {row.span.label}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">
            {row.span.metadata.service ? `${row.span.metadata.service} · ` : ""}
            {row.span.id}
          </div>
        </div>
      </div>
    </button>
  );
}

function SpanTimelineRow({
  row,
  rowIndex,
  traceStart,
  selected,
  onSelect
}: {
  row: SpanRow;
  rowIndex: number;
  traceStart: number;
  selected: boolean;
  onSelect: (id: string) => void;
}): ReactElement {
  const rect = mapSpanToTimelineRect(row.span, traceStart);
  const width = Math.max(rect.width, MIN_BAR_WIDTH);
  const style: CSSProperties = {
    top: rowIndex * ROW_HEIGHT,
    height: ROW_HEIGHT
  };

  return (
    <button
      className={cn(
        "absolute left-0 right-0 border-b border-border/50 text-left transition-colors",
        selected ? "bg-cyan/8" : "bg-transparent hover:bg-secondary/45"
      )}
      style={style}
      type="button"
      onClick={() => onSelect(row.span.id)}
    >
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-border/50" />
      <div
        className={cn(
          "absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-full border px-2 shadow-sm",
          selected
            ? "border-blue-500/30 bg-gradient-to-r from-cyan to-blue-500 text-white"
            : "border-cyan/20 bg-cyan/12 text-foreground"
        )}
        style={{
          left: rect.left,
          width
        }}
      >
        <span className="truncate font-mono text-[11px] font-semibold">
          {formatDurationLabel(row.span.duration)}
        </span>
      </div>
    </button>
  );
}

function StatPill({
  icon,
  label,
  value,
  mono = false
}: {
  icon: ReactElement;
  label: string;
  value: string;
  mono?: boolean;
}): ReactElement {
  return (
    <span className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card/95 px-3 py-2 text-sm shadow-sm">
      <span className="text-cyan">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-foreground", mono && "font-mono text-xs")}>
        {value}
      </span>
    </span>
  );
}

function DetailCard({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}): ReactElement {
  return (
    <article className="timeline-entry">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-2 text-sm text-foreground", mono && "font-mono text-xs")}>
        {value}
      </div>
    </article>
  );
}

function filterRows(rows: SpanRow[], query: string): SpanRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return rows;
  }

  const includedIds = new Set<string>();
  const rowById = new Map(rows.map((row) => [row.span.id, row]));

  for (const row of rows) {
    if (!matchesQuery(row.span, normalized)) {
      continue;
    }

    includedIds.add(row.span.id);
    let cursor = row.span.parentId;
    while (cursor) {
      includedIds.add(cursor);
      cursor = rowById.get(cursor)?.span.parentId ?? null;
    }
  }

  return rows.filter((row) => includedIds.has(row.span.id));
}

function matchesQuery(span: TraceSpan, query: string): boolean {
  if (span.label.toLowerCase().includes(query)) {
    return true;
  }

  if (span.id.toLowerCase().includes(query)) {
    return true;
  }

  return Object.entries(span.metadata).some(([key, value]) =>
    `${key}:${String(value)}`.toLowerCase().includes(query)
  );
}
