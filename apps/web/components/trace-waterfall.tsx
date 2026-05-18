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
import { motion, AnimatePresence } from "framer-motion";

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
import { buttonStyles } from "./ui";

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
    <section className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-glow backdrop-blur-md stack">
      <div className="page-header">
        <div>
          <span className="pill">Observability Waterfall</span>
          <h1 className="section-title mt-1.5 font-display text-2xl font-black text-slate-800">
            Trace Waterfall
          </h1>
          <p className="lede mt-2 text-sm leading-relaxed text-slate-600 font-medium">
            Production-grade span timeline with fixed time scaling, sticky labels, and row virtualization for high-speed audits.
          </p>
        </div>
        <div className="trace-meta">
          <StatPill icon={<Activity className="h-4 w-4" />} label="Trace ID" value={traceId} mono />
          <StatPill icon={<Layers3 className="h-4 w-4" />} label="Spans" value={`${filteredRows.length}`} />
          <StatPill icon={<Clock3 className="h-4 w-4" />} label="Duration" value={formatDurationLabel(summary.totalDuration)} />
          <StatPill icon={<Database className="h-4 w-4" />} label="Depth" value={`${maxDepth + 1} levels`} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4.5 rounded-2xl border border-slate-200/60 bg-white/80 p-4.5 shadow-sm">
        <label className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-11"
            placeholder="Filter spans by label, id, or metadata keys..."
            value={query}
            onChange={(event) => {
              const nextValue = event.target.value;
              startTransition(() => {
                setQuery(nextValue);
              });
            }}
          />
        </label>

        <div className="trace-meta text-xs">
          <span className="pill font-display uppercase tracking-wider text-[10px]">
            Scale {TIME_SCALE.toFixed(0)} px / ms
          </span>
          <span className="font-semibold text-slate-500">
            Horizontal timeline scrolls independently while service labels stay anchored.
          </span>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div
            className="grid border-b border-slate-200/60 bg-slate-50/60"
            style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px minmax(0,1fr)` }}
          >
            <div className="border-r border-slate-200/60 px-4 py-3.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                Span hierarchy
              </div>
              <div className="mt-1 text-xs font-semibold text-slate-600">
                Service, operation, and hop level
              </div>
            </div>

            <div className="overflow-hidden px-0 py-0">
              <div
                className="relative h-[66px]"
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
                    <div className="absolute inset-y-0 border-l border-slate-200/40" />
                    <div className="absolute left-2.5 top-3.5 whitespace-nowrap font-mono text-[10px] font-bold text-slate-500">
                      {marker.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className="grid place-items-center px-6 py-20 text-center">
              <div className="max-w-md">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200 text-slate-500">
                  <TimerReset className="h-6 w-6" />
                </div>
                <h3 className="font-display text-base font-bold text-slate-800">No spans match this filter</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 font-medium">
                  Try typing service fields like <span className="font-mono bg-slate-100 px-1 rounded">status:ok</span>.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="grid"
              style={{ gridTemplateColumns: `${LABEL_COLUMN_WIDTH}px minmax(0,1fr)` }}
            >
              {/* Virtualized Labels */}
              <div className="relative h-[640px] overflow-hidden border-r border-slate-200/60 bg-white">
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

              {/* Virtualized Timelines */}
              <div
                ref={timelineViewportRef}
                className="relative h-[640px] overflow-auto bg-slate-50/30"
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
                      className="absolute top-0 bottom-0 border-l border-slate-200/30"
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

        {/* Sidebar Inspector Panel */}
        <aside className="timeline-sidebar">
          <div className="timeline-header pb-4 border-b border-slate-200/60">
            <div className="trace-meta">
              <span className="pill font-display text-[10px] uppercase tracking-wider">Span Inspector</span>
              {selectedSpan ? (
                <span className="font-mono text-xs text-slate-500 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                  {selectedSpan.id}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 font-medium">
              Select any span row to inspect timing offsets, cryptographic payloads, and metadata properties immediately.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {selectedSpan ? (
              <motion.div
                key={selectedSpan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="timeline-list"
              >
                <DetailCard label="Operation Name" value={selectedSpan.label} />
                <DetailCard label="Start Delay" value={formatDurationLabel(selectedSpan.startTime - summary.traceStart)} />
                <DetailCard label="Execution Duration" value={formatDurationLabel(selectedSpan.duration)} />
                <DetailCard label="Parent Anchor ID" value={selectedSpan.parentId ?? "Forensic Root [Tx]"} mono />

                <article className="timeline-entry">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                    Payload Metadata
                  </div>
                  <div className="mt-3.5 grid gap-2">
                    {Object.entries(selectedSpan.metadata).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-start justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
                          {key}
                        </span>
                        <span className="max-w-[170px] break-all text-right font-mono text-[11px] font-bold text-slate-700 leading-relaxed">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </article>
              </motion.div>
            ) : (
              <article className="timeline-entry timeline-entry--empty mt-4 text-center py-10 border-dashed border-slate-300">
                <strong className="block text-slate-700 font-bold mb-1">No span selected</strong>
                <span className="timeline-entry-copy text-slate-400 font-medium">
                  Pick a row in the timeline grid to inspect details.
                </span>
              </article>
            )}
          </AnimatePresence>
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
        "absolute left-0 right-0 border-b border-slate-200/50 px-4 text-left transition-colors cursor-pointer",
        selected
          ? "bg-sky-50/70 border-l-4 border-l-sky-500 pl-3 font-semibold"
          : "bg-transparent hover:bg-slate-50/80"
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
        style={{ paddingLeft: (selected ? 8 : 12) + row.depth * 18 }}
      >
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full border border-white",
            row.hasChildren ? "bg-sky-500 shadow-glow" : "bg-slate-200"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-bold text-slate-800">
            {row.span.label}
          </div>
          <div className="truncate font-mono text-[9px] font-bold text-slate-500">
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
        "absolute left-0 right-0 border-b border-slate-200/50 text-left transition-colors cursor-pointer",
        selected ? "bg-sky-50/40" : "bg-transparent hover:bg-slate-100/30"
      )}
      style={style}
      type="button"
      onClick={() => onSelect(row.span.id)}
    >
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-slate-200/50" />
      <div
        className={cn(
          "absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-lg border px-2 shadow-sm transition-all duration-200 hover:-translate-y-1/2 hover:scale-[1.01] cursor-pointer",
          selected
            ? "border-sky-500/30 bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-glow"
            : "border-sky-200/60 bg-sky-50 text-sky-700"
        )}
        style={{
          left: rect.left,
          width
        }}
      >
        <span className="truncate font-mono text-[10px] font-extrabold">
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
    <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold shadow-sm">
      <span className="text-sky-500">{icon}</span>
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
        {label}
      </span>
      <span className={cn("text-slate-800", mono && "font-mono font-bold text-xs")}>
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
      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 font-display">
        {label}
      </div>
      <div
        className={cn("mt-2 text-xs font-bold text-slate-700 leading-relaxed", mono && "font-mono text-[11px]")}
      >
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
