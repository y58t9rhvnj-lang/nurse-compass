/**
 * Lightweight orthogonal preview for the card being dragged (Slice 2A).
 * Live card pins only. No Junction / bridge / topology recalculation.
 */

import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";
import {
  chooseCardEdges,
  edgeMidpoint,
  polylineLength,
  type EdgeSide,
  type Point,
  type RoutedConnection,
} from "./orthogonalRouting";
import {
  cardObstacle,
  defaultRouteCanvas,
  generateOrthogonalCandidates,
  normalizeOrthogonalPolyline,
  validateOrthogonalRoute,
} from "./routeHardening";
import {
  previewIncidentFromStable,
  type StableRouteState,
} from "./incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "./routeTopology";

function hvPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) <= 0.2 || Math.abs(from.y - to.y) <= 0.2) {
    return [from, to];
  }
  return [from, { x: to.x, y: from.y }, to];
}

function vhPath(from: Point, to: Point): Point[] {
  if (Math.abs(from.x - to.x) <= 0.2 || Math.abs(from.y - to.y) <= 0.2) {
    return [from, to];
  }
  return [from, { x: from.x, y: to.y }, to];
}

export function previewOrthogonalPoints(
  source: RelatedDiagramCard,
  target: RelatedDiagramCard,
  cards: RelatedDiagramCard[] = [],
  sourceEdge?: EdgeSide,
  targetEdge?: EdgeSide,
): Point[] | null {
  const edges =
    sourceEdge && targetEdge
      ? { sourceEdge, targetEdge }
      : chooseCardEdges(source, target);
  const a = edgeMidpoint(source.layout, edges.sourceEdge);
  const b = edgeMidpoint(target.layout, edges.targetEdge);
  const hv = normalizeOrthogonalPolyline(hvPath(a, b), a, b);
  const vh = normalizeOrthogonalPolyline(vhPath(a, b), a, b);
  const obstacles = cards.map(cardObstacle);
  const check = (points: Point[]) =>
    validateOrthogonalRoute({
      points,
      sourcePin: a,
      targetPin: b,
      obstacles,
      sourceCardId: source.id,
      targetCardId: target.id,
      clearance: 0,
    }).ok;
  const simple = polylineLength(hv) <= polylineLength(vh) ? hv : vh;
  if (check(simple)) return simple;
  const candidates = generateOrthogonalCandidates({
    source: cardObstacle(source),
    target: cardObstacle(target),
    sourceEdge: edges.sourceEdge,
    targetEdge: edges.targetEdge,
    obstacles,
    canvas: defaultRouteCanvas(),
  });
  for (const pts of candidates) {
    if (check(pts)) return pts;
  }
  return null;
}

export function previewIncidentOrthogonalRoutes(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  movingCardId: string,
  topology?: RelatedDiagramRouteTopology,
  stableState?: StableRouteState,
): RoutedConnection[] {
  if (stableState) {
    return previewIncidentFromStable(
      stableState,
      cards,
      connections,
      movingCardId,
    );
  }
  const byId = new Map(cards.map((c) => [c.id, c]));
  const authored = new Map(
    (topology?.routes ?? []).map((r) => [r.connectionId, r]),
  );
  const out: RoutedConnection[] = [];
  for (const conn of connections) {
    if (
      conn.sourceCardId !== movingCardId &&
      conn.targetCardId !== movingCardId
    ) {
      continue;
    }
    const source = byId.get(conn.sourceCardId);
    const target = byId.get(conn.targetCardId);
    if (!source || !target) continue;
    const preset = authored.get(conn.id);
    const { sourceEdge, targetEdge } = preset
      ? { sourceEdge: preset.sourceEdge, targetEdge: preset.targetEdge }
      : chooseCardEdges(source, target);
    const points = previewOrthogonalPoints(
      source,
      target,
      cards,
      sourceEdge,
      targetEdge,
    );
    if (!points) continue;
    out.push({
      connectionId: conn.id,
      sourceCardId: source.id,
      targetCardId: target.id,
      sourceEdge,
      targetEdge,
      points,
    });
  }
  return out;
}

export function overlayPreviewRoutes(
  base: RoutedConnection[],
  previews: RoutedConnection[],
): RoutedConnection[] {
  const map = new Map(previews.map((p) => [p.connectionId, p]));
  const replaced = base.map((route) => map.get(route.connectionId) ?? route);
  const extra = previews.filter(
    (p) => !base.some((r) => r.connectionId === p.connectionId),
  );
  return [...replaced, ...extra];
}
