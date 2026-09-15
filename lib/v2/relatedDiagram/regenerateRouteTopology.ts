/**
 * Rebuild explicit-topology geometry from live card positions.
 * Membership / edges / ids stay frozen. Junctions are never inferred.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import {
  edgeMidpoint,
  outwardPoint,
  type EdgeSide,
  type Point,
} from "./orthogonalRouting";
import {
  BRIDGE_SAFE_MARGIN,
  CARD_ROUTE_CLEARANCE,
  MIN_ARROW_APPROACH,
  MIN_BRANCH_CLEARANCE,
  MIN_ENDPOINT_STUB,
  cardObstacle,
  clearBranchPoint,
  defaultRouteCanvas,
  normalizeOrthogonalPolyline,
  routeCardToBranch,
  routeFromBranchToChild,
  selectBestOrthogonalRoute,
  slideOrthogonalRail,
  type RouteObstacle,
} from "./routeHardening";
import type {
  ExplicitConnectionRoute,
  RelatedDiagramRouteTopology,
} from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";

const DEFAULT_STUB_PX = MIN_ENDPOINT_STUB;

function pinOf(
  card: RelatedDiagramCard,
  side: EdgeSide,
): Point {
  return edgeMidpoint(card.layout, side);
}

export type FanChildParam = {
  connectionId: string;
  cardId: string;
  targetEdge: EdgeSide;
};

export type FanGeometryParam = {
  groupId: string;
  kind: "standard" | "complex";
  sourceCardId: string;
  sourceEdge: EdgeSide;
  trunkId: string;
  branchPointId: string;
  connectionIds: string[];
  children: FanChildParam[];
  branchOffsetFromSourcePin: Point;
  childTopGap?: number;
  partnerCardId?: string;
  partnerEdge?: EdgeSide;
  detourOffsetFromPartnerPin?: number;
};

export type OneToOneGeometryParam = {
  connectionId: string;
  sourceCardId: string;
  targetCardId: string;
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
};

export type TopologyGeometryParams = {
  stubPx: number;
  fans: FanGeometryParam[];
  oneToOne: OneToOneGeometryParam[];
};

function otherCardId(
  conn: RelatedDiagramConnection,
  sourceCardId: string,
): string {
  return conn.sourceCardId === sourceCardId
    ? conn.targetCardId
    : conn.sourceCardId;
}

function findDetourY(trunkPoints: Point[], branch: Point): number | null {
  for (const p of trunkPoints) {
    if (Math.abs(p.y - branch.y) > 1.5 && Math.abs(p.x - branch.x) > 1.5) {
      return p.y;
    }
  }
  const ys = trunkPoints.map((p) => p.y);
  const unique = [...new Set(ys.map((y) => Math.round(y)))];
  const notBranch = unique.filter((y) => Math.abs(y - branch.y) > 1);
  return notBranch.length ? notBranch[0]! : null;
}

function findRailX(trunkPoints: Point[], sourcePin: Point): number {
  let rail = trunkPoints[0]?.x ?? 12;
  for (const p of trunkPoints) {
    if (p.x < rail - 0.2) rail = p.x;
  }
  if (Math.abs(rail - sourcePin.x) < 1) {
    const xs = trunkPoints.map((p) => p.x);
    rail = Math.min(...xs);
  }
  return rail;
}

function inferPartner(
  cards: RelatedDiagramCard[],
  exclude: Set<string>,
  detourY: number,
): { cardId: string; edge: EdgeSide; offset: number } | null {
  let best: { cardId: string; edge: EdgeSide; offset: number; score: number } | null =
    null;
  const edges: EdgeSide[] = ["bottom", "top", "left", "right"];
  for (const card of cards) {
    if (card.cardType !== "knowledge" || exclude.has(card.id)) continue;
    for (const edge of edges) {
      const p = pinOf(card, edge);
      const offset = detourY - p.y;
      const score = Math.abs(offset);
      if (score < 2 || score > 80) continue;
      if (!best || score < best.score) {
        best = { cardId: card.id, edge, offset, score };
      }
    }
  }
  return best;
}

export function captureTopologyGeometryParams(
  topology: RelatedDiagramRouteTopology,
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): TopologyGeometryParams {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const connById = new Map(connections.map((c) => [c.id, c]));
  const routeById = new Map(topology.routes.map((r) => [r.connectionId, r]));
  const grouped = new Set(
    topology.routeGroups.flatMap((g) => g.connectionIds),
  );

  let stubPx = DEFAULT_STUB_PX;
  const sample = topology.routes[0];
  if (sample && sample.points.length >= 2) {
    const a = sample.points[0]!;
    const b = sample.points[1]!;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d > 4 && d < 40) stubPx = Math.max(d, MIN_ENDPOINT_STUB);
  }

  const oneToOne: OneToOneGeometryParam[] = [];
  for (const route of topology.routes) {
    if (grouped.has(route.connectionId)) continue;
    const conn = connById.get(route.connectionId);
    if (!conn) continue;
    oneToOne.push({
      connectionId: route.connectionId,
      sourceCardId: conn.sourceCardId,
      targetCardId: conn.targetCardId,
      sourceEdge: route.sourceEdge,
      targetEdge: route.targetEdge,
    });
  }

  const fans: FanGeometryParam[] = [];
  for (const group of topology.routeGroups) {
    const trunk = topology.trunks.find((t) => t.id === group.trunkId);
    const bp = topology.branchPoints.find((b) => b.id === trunk?.branchPointId);
    const source = byId.get(group.sourceCardId);
    const firstRoute = routeById.get(group.connectionIds[0] ?? "");
    if (!trunk || !bp || !source || !firstRoute) continue;

    const sourceEdge = firstRoute.sourceEdge;
    const sourcePin = pinOf(source, sourceEdge);
    const children: FanChildParam[] = [];
    for (const connectionId of group.connectionIds) {
      const conn = connById.get(connectionId);
      const route = routeById.get(connectionId);
      if (!conn || !route) continue;
      children.push({
        connectionId,
        cardId: otherCardId(conn, group.sourceCardId),
        targetEdge: route.targetEdge,
      });
    }

    const kind: FanGeometryParam["kind"] =
      trunk.points.length > 3 ? "complex" : "standard";
    const fan: FanGeometryParam = {
      groupId: group.id,
      kind,
      sourceCardId: group.sourceCardId,
      sourceEdge,
      trunkId: trunk.id,
      branchPointId: bp.id,
      connectionIds: [...group.connectionIds],
      children,
      branchOffsetFromSourcePin: {
        x: bp.x - sourcePin.x,
        y: bp.y - sourcePin.y,
      },
    };

    if (kind === "complex") {
      const childPins = children
        .map((ch) => {
          const card = byId.get(ch.cardId);
          return card ? pinOf(card, ch.targetEdge) : null;
        })
        .filter((p): p is Point => p != null);
      if (childPins.length) {
        const minChildY = Math.min(...childPins.map((p) => p.y));
        fan.childTopGap = minChildY - bp.y;
      }
      const detourY = findDetourY(trunk.points, { x: bp.x, y: bp.y });
      const exclude = new Set([
        group.sourceCardId,
        ...children.map((c) => c.cardId),
      ]);
      if (detourY != null) {
        const partner = inferPartner(cards, exclude, detourY);
        if (partner) {
          fan.partnerCardId = partner.cardId;
          fan.partnerEdge = partner.edge;
          fan.detourOffsetFromPartnerPin = partner.offset;
        }
      }
    }

    fans.push(fan);
  }

  return { stubPx, fans, oneToOne };
}

function routingObstacles(
  cards: RelatedDiagramCard[],
): RouteObstacle[] {
  const legend = getA3LegendBounds(A3_WIDTH_PX, A3_HEIGHT_PX);
  return [
    ...cards.map(cardObstacle),
    { id: "__legend", ...legend },
  ];
}

function rebuildOneToOne(
  param: OneToOneGeometryParam,
  byId: Map<string, RelatedDiagramCard>,
  obstacles: RouteObstacle[],
): ExplicitConnectionRoute | null {
  const source = byId.get(param.sourceCardId);
  const target = byId.get(param.targetCardId);
  if (!source || !target) return null;
  const points =
    selectBestOrthogonalRoute({
      source: cardObstacle(source),
      target: cardObstacle(target),
      sourceEdge: param.sourceEdge,
      targetEdge: param.targetEdge,
      obstacles,
      canvas: defaultRouteCanvas(),
      stub: MIN_ENDPOINT_STUB,
      clearance: CARD_ROUTE_CLEARANCE,
    }) ??
    normalizeOrthogonalPolyline(
      [
        pinOf(source, param.sourceEdge),
        outwardPoint(pinOf(source, param.sourceEdge), param.sourceEdge, MIN_ENDPOINT_STUB),
        outwardPoint(pinOf(target, param.targetEdge), param.targetEdge, MIN_ARROW_APPROACH),
        pinOf(target, param.targetEdge),
      ],
      pinOf(source, param.sourceEdge),
      pinOf(target, param.targetEdge),
    );
  return {
    connectionId: param.connectionId,
    sourceEdge: param.sourceEdge,
    targetEdge: param.targetEdge,
    points,
  };
}

function preferFromEdge(edge: EdgeSide): Point {
  switch (edge) {
    case "top":
      return { x: 0, y: -1 };
    case "right":
      return { x: 1, y: 0 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
  }
}

export function regenerateExplicitTopologyGeometry(input: {
  topology: RelatedDiagramRouteTopology;
  cards: RelatedDiagramCard[];
  connections: RelatedDiagramConnection[];
  geometryParams: TopologyGeometryParams;
}): RelatedDiagramRouteTopology {
  const { topology, cards, geometryParams } = input;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const obstacles = routingObstacles(cards);
  const canvas = defaultRouteCanvas();
  const rebuiltRoutes = new Map<string, ExplicitConnectionRoute>();
  const rebuiltTrunks = new Map<string, RelatedDiagramRouteTopology["trunks"][number]>();
  const rebuiltBps = new Map<string, RelatedDiagramRouteTopology["branchPoints"][number]>();
  const standardFans = geometryParams.fans.filter((f) => f.kind !== "complex");
  const complexFans = geometryParams.fans.filter((f) => f.kind === "complex");

  const rebuildFan = (fan: FanGeometryParam) => {
    const source = byId.get(fan.sourceCardId);
    const prevTrunk = topology.trunks.find((t) => t.id === fan.trunkId);
    const prevBp = topology.branchPoints.find((b) => b.id === fan.branchPointId);
    if (!source || !prevTrunk || !prevBp) return;
    const sourcePin = pinOf(source, fan.sourceEdge);
    const nearbyRects = cards.map((c) => c.layout);

    let branch: Point;
    if (fan.kind === "complex" && fan.childTopGap != null) {
      const childPins = fan.children
        .map((ch) => {
          const card = byId.get(ch.cardId);
          return card ? pinOf(card, ch.targetEdge) : null;
        })
        .filter((p): p is Point => p != null);
      const midX =
        childPins.reduce((s, p) => s + p.x, 0) / Math.max(1, childPins.length);
      const minY = Math.min(...childPins.map((p) => p.y));
      branch = { x: midX, y: minY - fan.childTopGap };
    } else {
      branch = {
        x: sourcePin.x + fan.branchOffsetFromSourcePin.x,
        y: sourcePin.y + fan.branchOffsetFromSourcePin.y,
      };
    }
    branch = clearBranchPoint(
      branch,
      nearbyRects,
      preferFromEdge(fan.sourceEdge),
      MIN_BRANCH_CLEARANCE,
    );

    let trunkPoints: Point[];
    if (fan.kind === "complex") {
      const partner = fan.partnerCardId ? byId.get(fan.partnerCardId) : null;
      let detourY =
        partner && fan.partnerEdge && fan.detourOffsetFromPartnerPin != null
          ? pinOf(partner, fan.partnerEdge).y + fan.detourOffsetFromPartnerPin
          : findDetourY(prevTrunk.points, { x: prevBp.x, y: prevBp.y }) ??
            branch.y - 24;
      if (partner && fan.partnerEdge) {
        const partnerPin = pinOf(partner, fan.partnerEdge);
        const partnerFan = geometryParams.fans.find(
          (f) => f.sourceCardId === fan.partnerCardId,
        );
        const partnerBp = partnerFan
          ? rebuiltBps.get(partnerFan.branchPointId)
          : null;
        const v0 = partnerPin.y;
        const v1 = partnerBp?.y ?? partnerPin.y + 48;
        const lo = Math.min(v0, v1) + BRIDGE_SAFE_MARGIN + 10;
        const hi = Math.max(v0, v1) - BRIDGE_SAFE_MARGIN - 10;
        if (lo <= hi) {
          detourY = Math.min(hi, Math.max(lo, detourY));
        }
      }
      const detourX = sourcePin.x;
      const ignore = new Set([
        fan.sourceCardId,
        ...fan.children.map((c) => c.cardId),
      ]);
      let railX = findRailX(prevTrunk.points, sourcePin);
      railX = slideOrthogonalRail(
        railX,
        "x",
        detourY,
        branch.y,
        obstacles,
        ignore,
        canvas,
        railX <= sourcePin.x ? -1 : 1,
      );
      detourY = slideOrthogonalRail(
        detourY,
        "y",
        Math.min(detourX, railX),
        Math.max(detourX, railX),
        obstacles,
        ignore,
        canvas,
        detourY <= sourcePin.y ? -1 : 1,
      );
      const sourceStub = outwardPoint(sourcePin, fan.sourceEdge, MIN_ENDPOINT_STUB);
      trunkPoints = normalizeOrthogonalPolyline(
        [
          sourcePin,
          sourceStub,
          { x: detourX, y: detourY },
          { x: railX, y: detourY },
          { x: railX, y: branch.y },
          branch,
        ],
        sourcePin,
        branch,
      );
      for (const ch of fan.children) {
        const child = byId.get(ch.cardId);
        if (!child) continue;
        const tail = routeFromBranchToChild({
          branch,
          sourceEdge: fan.sourceEdge,
          child,
          targetEdge: ch.targetEdge,
          obstacles,
          canvas,
        });
        rebuiltRoutes.set(ch.connectionId, {
          connectionId: ch.connectionId,
          sourceEdge: fan.sourceEdge,
          targetEdge: ch.targetEdge,
          points: normalizeOrthogonalPolyline(
            [...trunkPoints, ...tail.slice(1)],
            sourcePin,
            pinOf(child, ch.targetEdge),
          ),
        });
      }
    } else {
      trunkPoints = routeCardToBranch({
        source,
        sourceEdge: fan.sourceEdge,
        branch,
        obstacles,
        canvas,
      });
      for (const ch of fan.children) {
        const child = byId.get(ch.cardId);
        if (!child) continue;
        const tail = routeFromBranchToChild({
          branch,
          sourceEdge: fan.sourceEdge,
          child,
          targetEdge: ch.targetEdge,
          obstacles,
          canvas,
        });
        rebuiltRoutes.set(ch.connectionId, {
          connectionId: ch.connectionId,
          sourceEdge: fan.sourceEdge,
          targetEdge: ch.targetEdge,
          points: normalizeOrthogonalPolyline(
            [...trunkPoints, ...tail.slice(1)],
            sourcePin,
            pinOf(child, ch.targetEdge),
          ),
        });
      }
    }

    rebuiltTrunks.set(fan.trunkId, {
      ...prevTrunk,
      points: trunkPoints,
    });
    rebuiltBps.set(fan.branchPointId, {
      ...prevBp,
      x: branch.x,
      y: branch.y,
    });
  };

  for (const fan of standardFans) rebuildFan(fan);
  for (const fan of complexFans) rebuildFan(fan);

  for (const one of geometryParams.oneToOne) {
    const route = rebuildOneToOne(one, byId, obstacles);
    if (route) rebuiltRoutes.set(one.connectionId, route);
  }

  return {
    schema: topology.schema,
    routeGroups: topology.routeGroups.map((g) => ({
      ...g,
      connectionIds: [...g.connectionIds],
    })),
    trunks: topology.trunks.map((t) => rebuiltTrunks.get(t.id) ?? t),
    branchPoints: topology.branchPoints.map((b) => rebuiltBps.get(b.id) ?? b),
    routes: topology.routes.map((r) => rebuiltRoutes.get(r.connectionId) ?? r),
  };
}

export function translateKnowledgeTopology(
  topology: RelatedDiagramRouteTopology,
  connections: RelatedDiagramConnection[],
  cards: RelatedDiagramCard[],
  dx: number,
  dy: number,
): RelatedDiagramRouteTopology {
  if (dx === 0 && dy === 0) return topology;
  const byId = new Map(cards.map((c) => [c.id, c]));
  const knowledgeConnIds = new Set(
    connections
      .filter((c) => {
        const s = byId.get(c.sourceCardId);
        const t = byId.get(c.targetCardId);
        return s?.cardType === "knowledge" && t?.cardType === "knowledge";
      })
      .map((c) => c.id),
  );
  const shift = (p: Point): Point => ({ x: p.x + dx, y: p.y + dy });
  return {
    schema: topology.schema,
    routeGroups: topology.routeGroups,
    trunks: topology.trunks.map((t) =>
      t.connectionIds.some((id) => knowledgeConnIds.has(id))
        ? { ...t, points: t.points.map(shift) }
        : t,
    ),
    branchPoints: topology.branchPoints.map((bp) =>
      bp.connectionIds.some((id) => knowledgeConnIds.has(id))
        ? { ...bp, x: bp.x + dx, y: bp.y + dy }
        : bp,
    ),
    routes: topology.routes.map((r) =>
      knowledgeConnIds.has(r.connectionId)
        ? { ...r, points: r.points.map(shift) }
        : r,
    ),
  };
}

export function topologyMembershipSnapshot(
  topology: RelatedDiagramRouteTopology,
) {
  return {
    groupIds: topology.routeGroups.map((g) => g.id),
    trunkIds: topology.trunks.map((t) => t.id),
    branchIds: topology.branchPoints.map((b) => b.id),
    groups: topology.routeGroups.map((g) => ({
      id: g.id,
      sourceCardId: g.sourceCardId,
      trunkId: g.trunkId,
      connectionIds: [...g.connectionIds],
    })),
    trunks: topology.trunks.map((t) => ({
      id: t.id,
      branchPointId: t.branchPointId,
      connectionIds: [...t.connectionIds],
    })),
    routes: topology.routes.map((r) => ({
      connectionId: r.connectionId,
      sourceEdge: r.sourceEdge,
      targetEdge: r.targetEdge,
    })),
  };
}
