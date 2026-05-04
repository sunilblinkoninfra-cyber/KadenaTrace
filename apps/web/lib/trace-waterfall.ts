export interface TraceSpan {
  id: string;
  parentId: string | null;
  startTime: number;
  duration: number;
  label: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface SpanRow {
  span: TraceSpan;
  depth: number;
  hasChildren: boolean;
}

export interface TimelineMarker {
  timestamp: number;
  left: number;
  label: string;
}

export interface TraceSummary {
  traceStart: number;
  traceEnd: number;
  totalDuration: number;
}

export interface VisibleRowWindowInput {
  scrollTop: number;
  containerHeight: number;
  rowHeight: number;
  totalRows: number;
  overscan: number;
}

export const TIME_SCALE = 0.12;

const MARKER_STEPS_MS = [
  10,
  25,
  50,
  100,
  250,
  500,
  1_000,
  2_500,
  5_000,
  10_000,
  15_000,
  30_000,
  60_000
] as const;

export function summarizeTrace(spans: TraceSpan[]): TraceSummary {
  if (spans.length === 0) {
    return {
      traceStart: 0,
      traceEnd: 0,
      totalDuration: 0
    };
  }

  const traceStart = Math.min(...spans.map((span) => span.startTime));
  const traceEnd = Math.max(...spans.map((span) => span.startTime + span.duration));

  return {
    traceStart,
    traceEnd,
    totalDuration: traceEnd - traceStart
  };
}

export function mapSpanToTimelineRect(
  span: TraceSpan,
  traceStart: number
): { left: number; width: number } {
  return {
    left: roundToTenth((span.startTime - traceStart) * TIME_SCALE),
    width: roundToTenth(span.duration * TIME_SCALE)
  };
}

export function buildSpanRows(spans: TraceSpan[]): SpanRow[] {
  const childrenByParent = new Map<string | null, TraceSpan[]>();
  const spanIds = new Set(spans.map((span) => span.id));

  for (const span of spans) {
    const parentId = span.parentId && spanIds.has(span.parentId) ? span.parentId : null;
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(span);
    childrenByParent.set(parentId, siblings);
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) => {
      if (left.startTime !== right.startTime) {
        return left.startTime - right.startTime;
      }
      return left.label.localeCompare(right.label);
    });
  }

  const rows: SpanRow[] = [];

  const visit = (parentId: string | null, depth: number): void => {
    const siblings = childrenByParent.get(parentId) ?? [];

    for (const span of siblings) {
      rows.push({
        span,
        depth,
        hasChildren: (childrenByParent.get(span.id)?.length ?? 0) > 0
      });
      visit(span.id, depth + 1);
    }
  };

  visit(null, 0);
  return rows;
}

export function buildTimelineMarkers(input: {
  traceStart: number;
  totalDuration: number;
  minimumMarkerCount?: number;
}): TimelineMarker[] {
  const { traceStart, totalDuration } = input;
  const minimumMarkerCount = Math.max(2, input.minimumMarkerCount ?? 6);

  if (totalDuration <= 0) {
    return [
      {
        timestamp: traceStart,
        left: 0,
        label: "0 ms"
      }
    ];
  }

  const targetStep = totalDuration / Math.max(1, minimumMarkerCount - 1);
  const step = MARKER_STEPS_MS.find((candidate) => candidate >= targetStep) ?? MARKER_STEPS_MS.at(-1)!;

  const markers: TimelineMarker[] = [];
  for (let timestamp = traceStart; timestamp < traceStart + totalDuration; timestamp += step) {
    const offset = timestamp - traceStart;
    markers.push({
      timestamp,
      left: roundToTenth(offset * TIME_SCALE),
      label: formatDurationLabel(offset)
    });
  }

  markers.push({
    timestamp: traceStart + totalDuration,
    left: roundToTenth(totalDuration * TIME_SCALE),
    label: formatDurationLabel(totalDuration)
  });

  return dedupeMarkers(markers);
}

export function getVisibleRowWindow(input: VisibleRowWindowInput): {
  startIndex: number;
  endIndex: number;
} {
  if (input.totalRows <= 0) {
    return { startIndex: 0, endIndex: -1 };
  }

  const visibleCount = Math.max(1, Math.ceil(input.containerHeight / input.rowHeight));
  const startIndex = Math.max(0, Math.floor(input.scrollTop / input.rowHeight) - input.overscan);
  const endIndex = Math.min(
    input.totalRows - 1,
    Math.floor(input.scrollTop / input.rowHeight) + visibleCount + input.overscan
  );

  return {
    startIndex,
    endIndex
  };
}

export function formatDurationLabel(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${Math.round(durationMs)} ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
  }

  return `${(durationMs / 60_000).toFixed(1)} min`;
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function dedupeMarkers(markers: TimelineMarker[]): TimelineMarker[] {
  const seen = new Set<number>();
  return markers.filter((marker) => {
    if (seen.has(marker.timestamp)) {
      return false;
    }

    seen.add(marker.timestamp);
    return true;
  });
}
