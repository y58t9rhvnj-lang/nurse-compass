"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { clientToLogical } from "@/lib/v2/relatedDiagram/a3PointerMath";
import {
  connectionPermissions,
  connectionTapAnchorRect,
  isRelatedDiagramConnectionHitTarget,
  pickSelectableConnectionAtPoint,
} from "@/lib/v2/relatedDiagram/cardConnectionManage";
import {
  applyConnectionRouteCancel,
  applyConnectionRoutePointerDown,
  applyConnectionRoutePointerMove,
  applyConnectionRoutePointerUp,
  applyConnectionRouteSecondPointer,
  connectionRouteDragDelta,
  createIdleConnectionRouteGesture,
} from "@/lib/v2/relatedDiagram/connectionRouteGesture";
import { isolateDiagramOwnedPointer } from "@/lib/v2/relatedDiagram/diagramGestureOwnership";
import {
  selectedConnectionIdFromSelection,
  selectionFromCardId,
  type DiagramSelection,
} from "@/lib/v2/relatedDiagram/diagramSelection";
import type { DiagramHistoryAction } from "@/lib/v2/relatedDiagram/diagramHistory";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  stableRoutesList,
  type StableRouteState,
} from "@/lib/v2/relatedDiagram/incrementalRoutes";
import {
  canEditConnectionRoute,
  commitManualRouteEdit,
  dragOrthogonalSegment,
  isManualConnection,
} from "@/lib/v2/relatedDiagram/manualRouteEdit";
import type { Point } from "@/lib/v2/relatedDiagram/orthogonalRouting";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import { cloneTopology } from "@/lib/v2/relatedDiagram/diagramHistory";
import {
  applyPartialRouteTrace,
  canTraceConnectionRoute,
} from "@/lib/v2/relatedDiagram/routeTrace";
import {
  applyRouteTraceCancel,
  applyRouteTracePointerDown,
  applyRouteTracePointerMove,
  applyRouteTracePointerUp,
  applyRouteTraceSecondPointer,
  createIdleRouteTraceGesture,
} from "@/lib/v2/relatedDiagram/routeTraceGesture";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";

export type RouteEditPreview = {
  connectionId: string;
  points: Point[];
};

export type RouteTracePreview = {
  connectionId: string;
  raw: Point[];
};

function trackPointerDown(set: Set<number>, pointerId: number): number {
  set.add(pointerId);
  return set.size;
}

function trackPointerUp(set: Set<number>, pointerId: number): number {
  set.delete(pointerId);
  return set.size;
}

function logicalFromEvent(
  event: PointerEvent,
  viewportEl: HTMLElement | null,
  transform: { x: number; y: number; scale: number },
): Point | null {
  const viewport = viewportEl?.getBoundingClientRect();
  if (!viewport) return null;
  return clientToLogical(
    { x: event.clientX, y: event.clientY },
    { x: viewport.left, y: viewport.top },
    transform,
  );
}

export function useConnectionRouteInteraction(input: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  selectedCardId: string | null;
  selectCard: (cardId: string | null) => void;
  draggingCardId: string | null;
  transform: { x: number; y: number; scale: number };
  viewportEl: () => HTMLElement | null;
  blocked?: boolean;
  onRouteStateChange: (next: StableRouteState) => void;
  onTopologyChange: (next: RelatedDiagramRouteTopology | undefined) => void;
  onHistoryPush: (action: DiagramHistoryAction) => void;
}) {
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    null,
  );
  const [connectionAnchor, setConnectionAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [traceArmed, setTraceArmed] = useState(false);
  const [routeEditPreview, setRouteEditPreview] = useState<RouteEditPreview | null>(
    null,
  );
  const [routeTracePreview, setRouteTracePreview] =
    useState<RouteTracePreview | null>(null);
  const gestureRef = useRef(createIdleConnectionRouteGesture());
  const traceGestureRef = useRef(createIdleRouteTraceGesture());
  const pointersRef = useRef(new Set<number>());
  const captureElRef = useRef<Element | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const pendingEditPreviewRef = useRef<RouteEditPreview | null | undefined>(
    undefined,
  );
  const pendingTracePreviewRef = useRef<RouteTracePreview | null | undefined>(
    undefined,
  );
  const liveRef = useRef({
    graph: input.graph,
    routeState: input.routeState,
    topology: input.topology,
    selectedConnectionId,
    transform: input.transform,
    selectCard: input.selectCard,
    viewportEl: input.viewportEl,
    onRouteStateChange: input.onRouteStateChange,
    onTopologyChange: input.onTopologyChange,
    onHistoryPush: input.onHistoryPush,
    setRouteEditPreview,
    setRouteTracePreview,
    setTraceArmed,
    setSelectedConnectionId,
    setConnectionAnchor,
  });
  liveRef.current = {
    graph: input.graph,
    routeState: input.routeState,
    topology: input.topology,
    selectedConnectionId,
    transform: input.transform,
    selectCard: input.selectCard,
    viewportEl: input.viewportEl,
    onRouteStateChange: input.onRouteStateChange,
    onTopologyChange: input.onTopologyChange,
    onHistoryPush: input.onHistoryPush,
    setRouteEditPreview,
    setRouteTracePreview,
    setTraceArmed,
    setSelectedConnectionId,
    setConnectionAnchor,
  };
  const dragBaseRef = useRef<{
    points: Point[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  } | null>(null);
  const traceBaseRef = useRef<{
    connectionId: string;
    points: Point[];
    routeState: StableRouteState;
    topology?: RelatedDiagramRouteTopology;
  } | null>(null);

  const flushPreviewRaf = () => {
    if (previewRafRef.current != null) return;
    previewRafRef.current = requestAnimationFrame(() => {
      previewRafRef.current = null;
      if (pendingEditPreviewRef.current !== undefined) {
        liveRef.current.setRouteEditPreview(pendingEditPreviewRef.current);
        pendingEditPreviewRef.current = undefined;
      }
      if (pendingTracePreviewRef.current !== undefined) {
        liveRef.current.setRouteTracePreview(pendingTracePreviewRef.current);
        pendingTracePreviewRef.current = undefined;
      }
    });
  };

  const diagramSelection: DiagramSelection = useMemo(() => {
    if (selectedConnectionId) {
      return { kind: "connection", connectionId: selectedConnectionId };
    }
    return selectionFromCardId(input.selectedCardId);
  }, [input.selectedCardId, selectedConnectionId]);

  const selectedConnection = useMemo(() => {
    const connectionId = selectedConnectionIdFromSelection(diagramSelection);
    if (!connectionId) return null;
    const connection =
      input.graph.connections.find((row) => row.id === connectionId) ?? null;
    if (!connection || !connectionPermissions(connection).selectable) return null;
    return connection;
  }, [diagramSelection, input.graph.connections]);

  const selectedIsManual = Boolean(
    selectedConnection &&
      isManualConnection(input.topology, selectedConnection),
  );
  const selectedCanTrace = Boolean(
    selectedConnection &&
      canTraceConnectionRoute(input.topology, selectedConnection),
  );

  const clearConnectionSelection = useCallback(() => {
    setSelectedConnectionId(null);
    setConnectionAnchor(null);
    setTraceArmed(false);
    setRouteTracePreview(null);
    setRouteEditPreview(null);
    traceGestureRef.current = applyRouteTraceCancel();
  }, []);

  const beginRouteTrace = useCallback(() => {
    if (!selectedConnection || !selectedCanTrace) return;
    setTraceArmed(true);
  }, [selectedCanTrace, selectedConnection]);

  useEffect(() => {
    if (input.selectedCardId) {
      setSelectedConnectionId(null);
      setConnectionAnchor(null);
      setTraceArmed(false);
      setRouteTracePreview(null);
    }
  }, [input.selectedCardId]);

  useEffect(() => {
    if (input.draggingCardId) {
      gestureRef.current = applyConnectionRouteCancel();
      traceGestureRef.current = applyRouteTraceCancel();
      dragBaseRef.current = null;
      traceBaseRef.current = null;
      setTraceArmed(false);
      setRouteEditPreview(null);
      setRouteTracePreview(null);
    }
  }, [input.draggingCardId]);

  const handleConnectionPointerDown = useCallback(
    (event: ReactPointerEvent<SVGPathElement>) => {
      if (input.blocked || traceArmed) return;
      if (event.pointerType === "touch" && event.isPrimary === false) return;
      isolateDiagramOwnedPointer(event);
      const viewport = input.viewportEl()?.getBoundingClientRect();
      if (!viewport) return;
      const picked = pickSelectableConnectionAtPoint({
        point: clientToLogical(
          { x: event.clientX, y: event.clientY },
          { x: viewport.left, y: viewport.top },
          input.transform,
        ),
        cards: input.graph.cards,
        connections: input.graph.connections,
        routes: stableRoutesList(input.routeState),
      });
      if (!picked) return;
      const connection =
        input.graph.connections.find((row) => row.id === picked.connectionId) ??
        null;
      if (!connection) return;
      const stored = input.routeState.byId[connection.id];
      gestureRef.current = applyConnectionRoutePointerDown({
        pointerId: event.pointerId,
        pointerCount: Math.max(1, pointersRef.current.size),
        isPrimary: event.isPrimary,
        connectionId: connection.id,
        selectedConnectionId,
        clientX: event.clientX,
        clientY: event.clientY,
        logicalPoint: clientToLogical(
          { x: event.clientX, y: event.clientY },
          { x: viewport.left, y: viewport.top },
          input.transform,
        ),
        points: stored?.points ?? [],
        connection,
        topology: input.topology,
        cardDragging: input.draggingCardId != null,
      });
      if (gestureRef.current.phase === "pressing" && stored) {
        dragBaseRef.current = {
          points: stored.points.map((point) => ({ ...point })),
          routeState: cloneStableRouteState(input.routeState),
          topology: cloneTopology(input.topology),
        };
        captureElRef.current = event.currentTarget;
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
    },
    [input, selectedConnectionId, traceArmed],
  );

  const handleTracePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (input.blocked || !traceArmed || !selectedConnection) return;
      if (event.pointerType === "touch" && event.isPrimary === false) return;
      isolateDiagramOwnedPointer(event);
      const viewport = input.viewportEl()?.getBoundingClientRect();
      if (!viewport) return;
      const stored = input.routeState.byId[selectedConnection.id];
      if (!stored) return;
      const logical = clientToLogical(
        { x: event.clientX, y: event.clientY },
        { x: viewport.left, y: viewport.top },
        input.transform,
      );
      traceGestureRef.current = applyRouteTracePointerDown({
        pointerId: event.pointerId,
        pointerCount: Math.max(1, pointersRef.current.size),
        isPrimary: event.isPrimary,
        connectionId: selectedConnection.id,
        logical,
        connection: selectedConnection,
        topology: input.topology,
        cardDragging: input.draggingCardId != null,
        traceArmed: true,
      });
      if (traceGestureRef.current.phase !== "tracing") return;
      traceBaseRef.current = {
        connectionId: selectedConnection.id,
        points: stored.points.map((point) => ({ ...point })),
        routeState: cloneStableRouteState(input.routeState),
        topology: cloneTopology(input.topology),
      };
      captureElRef.current = event.currentTarget;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pendingTracePreviewRef.current = {
        connectionId: selectedConnection.id,
        raw: traceGestureRef.current.raw,
      };
      flushPreviewRaf();
    },
    [input, selectedConnection, traceArmed],
  );

  useEffect(() => {
    const pointers = pointersRef.current;
    const releaseCapture = (pointerId?: number) => {
      const el = captureElRef.current;
      const id = pointerId ?? gestureRef.current.pointerId ?? traceGestureRef.current.pointerId;
      if (el && id != null) {
        try {
          el.releasePointerCapture?.(id);
        } catch {
          /* already released */
        }
      }
      captureElRef.current = null;
    };
    const clearSegmentPreview = () => {
      pendingEditPreviewRef.current = null;
      liveRef.current.setRouteEditPreview(null);
      dragBaseRef.current = null;
    };
    const clearTracePreview = () => {
      pendingTracePreviewRef.current = null;
      liveRef.current.setRouteTracePreview(null);
      liveRef.current.setTraceArmed(false);
      traceBaseRef.current = null;
      traceGestureRef.current = applyRouteTraceCancel();
    };
    const onDown = (event: PointerEvent) => {
      const count = trackPointerDown(pointers, event.pointerId);
      if (count >= 2) {
        const ownedId = gestureRef.current.pointerId;
        const phase = gestureRef.current.phase;
        gestureRef.current = applyConnectionRouteSecondPointer(gestureRef.current);
        if (phase === "pressing" || phase === "dragging") {
          clearSegmentPreview();
          releaseCapture(ownedId ?? undefined);
        }
        if (
          traceGestureRef.current.phase === "tracing" ||
          traceGestureRef.current.phase === "cancelled"
        ) {
          applyRouteTraceSecondPointer(traceGestureRef.current);
          clearTracePreview();
          releaseCapture(traceGestureRef.current.pointerId ?? undefined);
        }
      }
    };
    const onMove = (event: PointerEvent) => {
      if (traceGestureRef.current.phase === "tracing") {
        const logical = logicalFromEvent(
          event,
          liveRef.current.viewportEl(),
          liveRef.current.transform,
        );
        if (!logical) return;
        const next = applyRouteTracePointerMove(traceGestureRef.current, {
          pointerId: event.pointerId,
          pointerCount: pointers.size,
          logical,
        });
        traceGestureRef.current = next;
        if (next.phase === "cancelled") {
          clearTracePreview();
          releaseCapture(event.pointerId);
          return;
        }
        if (next.connectionId) {
          pendingTracePreviewRef.current = {
            connectionId: next.connectionId,
            raw: next.raw,
          };
          flushPreviewRaf();
        }
        return;
      }
      const next = applyConnectionRoutePointerMove(gestureRef.current, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerCount: pointers.size,
      });
      gestureRef.current = next;
      if (next.phase !== "dragging" || !next.connectionId || !next.segment) return;
      const base = dragBaseRef.current;
      if (!base) return;
      const { deltaX, deltaY } = connectionRouteDragDelta(
        next,
        liveRef.current.transform.scale,
      );
      const points = dragOrthogonalSegment({
        points: base.points,
        segmentIndex: next.segment.index,
        deltaX,
        deltaY,
        grab: next.startLogical ?? undefined,
      });
      const routeEditPreview = {
        connectionId: next.connectionId,
        points,
      };
      pendingEditPreviewRef.current = routeEditPreview;
      flushPreviewRaf();
    };
    const onUp = (event: PointerEvent) => {
      trackPointerUp(pointers, event.pointerId);
      if (
        traceGestureRef.current.phase === "tracing" ||
        traceGestureRef.current.phase === "cancelled"
      ) {
        const logical = logicalFromEvent(
          event,
          liveRef.current.viewportEl(),
          liveRef.current.transform,
        ) ?? { x: 0, y: 0 };
        const result = applyRouteTracePointerUp(
          traceGestureRef.current,
          event.pointerId,
          logical,
        );
        traceGestureRef.current = result.state;
        pendingTracePreviewRef.current = null;
        liveRef.current.setRouteTracePreview(null);
        liveRef.current.setTraceArmed(false);
        releaseCapture(event.pointerId);
        const base = traceBaseRef.current;
        traceBaseRef.current = null;
        if (!result.commit || !base) return;
        const connection = liveRef.current.graph.connections.find(
          (row) => row.id === result.commit!.connectionId,
        );
        if (
          !connection ||
          !canTraceConnectionRoute(liveRef.current.topology, connection)
        ) {
          return;
        }
        const traced = applyPartialRouteTrace({
          existing: base.points,
          rawTrace: result.commit.raw,
        });
        if (!traced.ok) return;
        const committed = commitManualRouteEdit({
          connection,
          routeState: base.routeState,
          topology: base.topology,
          points: traced.points,
          cards: liveRef.current.graph.cards,
        });
        liveRef.current.onRouteStateChange(committed.routeState);
        liveRef.current.onTopologyChange(committed.topology);
        const beforePoints = base.routeState.byId[connection.id]?.points ?? [];
        const afterPoints = committed.routeState.byId[connection.id]?.points ?? [];
        if (pointsDeepEqual(beforePoints, afterPoints)) return;
        liveRef.current.onHistoryPush({
          type: "editRoute",
          connectionId: connection.id,
          before: {
            routeState: cloneStableRouteState(base.routeState),
            topology: cloneTopology(base.topology),
          },
          after: {
            routeState: cloneStableRouteState(committed.routeState),
            topology: cloneTopology(committed.topology),
          },
        });
        return;
      }
      const result = applyConnectionRoutePointerUp(
        gestureRef.current,
        event.pointerId,
        liveRef.current.transform.scale,
      );
      gestureRef.current = result.state;
      if (!result.commit) {
        if (result.state.phase !== "pressing" && result.state.phase !== "dragging") {
          releaseCapture(event.pointerId);
        }
        if (result.state.phase !== "pressing") {
          pendingEditPreviewRef.current = null;
          liveRef.current.setRouteEditPreview(null);
          dragBaseRef.current = null;
        }
        return;
      }
      if (result.commit.kind === "tap") {
        liveRef.current.selectCard(null);
        liveRef.current.setSelectedConnectionId(result.commit.connectionId);
        liveRef.current.setConnectionAnchor(
          connectionTapAnchorRect(result.commit.clientX, result.commit.clientY),
        );
        liveRef.current.setTraceArmed(false);
        pendingEditPreviewRef.current = null;
        liveRef.current.setRouteEditPreview(null);
        releaseCapture(event.pointerId);
        dragBaseRef.current = null;
        return;
      }
      const connection = liveRef.current.graph.connections.find(
        (row) => row.id === result.commit!.connectionId,
      );
      const base = dragBaseRef.current;
      dragBaseRef.current = null;
      pendingEditPreviewRef.current = null;
      liveRef.current.setRouteEditPreview(null);
      if (!connection || !base || !canEditConnectionRoute(liveRef.current.topology, connection)) {
        return;
      }
      releaseCapture(event.pointerId);
      const committed = commitManualRouteEdit({
        connection,
        routeState: base.routeState,
        topology: base.topology,
        points: dragOrthogonalSegment({
          points: base.points,
          segmentIndex: result.commit.segmentIndex,
          deltaX: result.commit.deltaX,
          deltaY: result.commit.deltaY,
          grab: result.commit.grab ?? undefined,
        }),
        cards: liveRef.current.graph.cards,
      });
      liveRef.current.onRouteStateChange(committed.routeState);
      liveRef.current.onTopologyChange(committed.topology);
      const beforePoints = base.routeState.byId[connection.id]?.points ?? [];
      const afterPoints = committed.routeState.byId[connection.id]?.points ?? [];
      if (pointsDeepEqual(beforePoints, afterPoints)) return;
      liveRef.current.onHistoryPush({
        type: "editRoute",
        connectionId: connection.id,
        before: {
          routeState: cloneStableRouteState(base.routeState),
          topology: cloneTopology(base.topology),
        },
        after: {
          routeState: cloneStableRouteState(committed.routeState),
          topology: cloneTopology(committed.topology),
        },
      });
    };
    const onCancel = (event: PointerEvent) => {
      trackPointerUp(pointers, event.pointerId);
      const phase = gestureRef.current.phase;
      gestureRef.current = applyConnectionRouteCancel();
      if (phase === "pressing" || phase === "dragging") {
        clearSegmentPreview();
      }
      if (traceGestureRef.current.phase === "tracing") {
        clearTracePreview();
      }
      releaseCapture(event.pointerId);
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onCancel, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onCancel, true);
      if (previewRafRef.current != null) {
        cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }
    };
  }, []);

  const handleSurfacePointerDownGuard = useCallback(
    (target: EventTarget | null) =>
      isRelatedDiagramConnectionHitTarget(target) ||
      (target instanceof Element &&
        Boolean(target.closest("[data-rd-route-trace-capture]"))),
    [],
  );

  return {
    diagramSelection,
    selectedConnectionId,
    selectedConnection,
    selectedIsManual,
    selectedCanTrace,
    connectionAnchor,
    traceArmed,
    routeEditPreview,
    routeTracePreview,
    handleConnectionPointerDown,
    handleTracePointerDown,
    handleSurfacePointerDownGuard,
    clearConnectionSelection,
    beginRouteTrace,
  };
}
