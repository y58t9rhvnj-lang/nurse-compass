/**
 * DEV-only card-drag counters for Phase 2-0 before/after comparison.
 * Not rendered in production UI.
 */

export type CardDragPerfCounters = {
  committedGraphUpdates: number;
  applyIncrementalCardMoveCalls: number;
  applyLightweightCardDropCalls: number;
  previewConnectionCount: number;
  rafFlushCount: number;
  nonDraggedCardRenders: number;
  nonIncidentConnectionRenders: number;
};

const empty = (): CardDragPerfCounters => ({
  committedGraphUpdates: 0,
  applyIncrementalCardMoveCalls: 0,
  applyLightweightCardDropCalls: 0,
  previewConnectionCount: 0,
  rafFlushCount: 0,
  nonDraggedCardRenders: 0,
  nonIncidentConnectionRenders: 0,
});

let counters = empty();

export function resetCardDragPerf(): void {
  counters = empty();
}

export function recordCardDragPerf(
  patch: Partial<CardDragPerfCounters>,
): void {
  counters = { ...counters, ...patch };
}

export function bumpCardDragPerf(
  key: keyof CardDragPerfCounters,
  by = 1,
): void {
  counters = { ...counters, [key]: counters[key] + by };
}

export function getCardDragPerf(): CardDragPerfCounters {
  return { ...counters };
}

export function publishCardDragPerf(): void {
  if (typeof window === "undefined") return;
  (
    window as Window & { __rdCardDragPerf?: CardDragPerfCounters }
  ).__rdCardDragPerf = getCardDragPerf();
}
