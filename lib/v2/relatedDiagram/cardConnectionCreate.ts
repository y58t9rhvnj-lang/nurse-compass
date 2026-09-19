/**
 * Slice 2B-2E-1 — student Connection create only.
 * Plans one new route against the current StableRouteState.
 * Does not reroute existing geometry. No edit / delete / reverse.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds } from "./a3Legend";
import { getCardActionCapabilities } from "./cardActionCapabilities";
import { MIN_JUNCTION_BRIDGE_DISTANCE, sourceExitCorridor, targetEntryCorridor } from "./geometryGuard";
import {
  cloneStableRouteState,
  pointsDeepEqual,
  stableRoutesList,
  type StableRouteState,
  type StoredRouteGeometry,
} from "./incrementalRoutes";
import {
  chooseCardEdges,
  classifyRouteInteractions,
  edgeMidpoint,
  isColinearOverlap,
  outwardPoint,
  planOrthogonalRoutes,
  type CrossingBridge,
  type EdgeSide,
  type OrthogonalRoutePlan,
  type Point,
  type RouteJunction,
  type RoutedConnection,
} from "./orthogonalRouting";
import { findRectilinearPath } from "./rectilinearPathfinder";
import { secondaryEdgePair, type CongestionContext } from "./routeCongestion";
import {
  MIN_ARROW_APPROACH,
  MIN_ENDPOINT_STUB,
  cardObstacle,
  defaultRouteCanvas,
  generateOrthogonalCandidates,
  validateOrthogonalRoute,
  type RouteObstacle,
} from "./routeHardening";
import {
  compareQualityReports,
  evaluateRouteQuality,
  selectQualityCandidate,
  type RouteQualityReport,
} from "./routeQuality";
import { upsertConnection } from "./semanticGraph";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramConnectionRelationType,
  RelatedDiagramSemanticGraph,
} from "./types";

export const STUDENT_CONNECTION_ORIGIN = "student_diagram" as const;

export const STUDENT_CONNECTION_RELATIONS = [
  "current",
  "potential",
  "treatment",
] as const;

export const STUDENT_CONNECTION_EDGE_SIDES: EdgeSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

export const STUDENT_CONNECTION_EDGE_PAIR_COUNT =
  STUDENT_CONNECTION_EDGE_SIDES.length * STUDENT_CONNECTION_EDGE_SIDES.length;

export const ATTACHMENT_SPACING = 12;
export const ATTACHMENT_CORNER_CLEARANCE = 16;

export const EDGE_RUN_PROXIMITY_PX = 48;
export const PERIMETER_ESCALATION_EDGE_RUN = 800;
export const PERIMETER_ESCALATION_RATIO = 0.7;
export const PERIMETER_ESCALATION_MAX_PAIRS = 2;

export function polylineManhattanLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length +=
      Math.abs(points[i]!.x - points[i - 1]!.x) +
      Math.abs(points[i]!.y - points[i - 1]!.y);
  }
  return length;
}

export function canvasEdgeRun(
  points: Point[],
  proximity = EDGE_RUN_PROXIMITY_PX,
): number {
  let run = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const nearEdge =
      Math.min(a.x, b.x) <= proximity ||
      Math.max(a.x, b.x) >= A3_WIDTH_PX - proximity ||
      Math.min(a.y, b.y) <= proximity ||
      Math.max(a.y, b.y) >= A3_HEIGHT_PX - proximity;
    if (nearEdge) {
      run += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    }
  }
  return run;
}

export function shouldEscalatePerimeterRoute(points: Point[]): boolean {
  const length = polylineManhattanLength(points);
  if (length <= 0) return false;
  const run = canvasEdgeRun(points);
  return (
    run >= PERIMETER_ESCALATION_EDGE_RUN &&
    run / length >= PERIMETER_ESCALATION_RATIO
  );
}

export function rankEscalationEdgePairs(input: {
  sourcePins: Record<EdgeSide, Point | null>;
  targetPins: Record<EdgeSide, Point | null>;
  preferred: { sourceEdge: EdgeSide; targetEdge: EdgeSide };
  secondary: { sourceEdge: EdgeSide; targetEdge: EdgeSide };
  limit?: number;
}): Array<{ sourceEdge: EdgeSide; targetEdge: EdgeSide; manhattan: number }> {
  const limit = input.limit ?? PERIMETER_ESCALATION_MAX_PAIRS;
  const ranked: Array<{
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
    manhattan: number;
    tie: number;
  }> = [];
  for (const pair of studentConnectionEdgePairs()) {
    const sourcePin = input.sourcePins[pair.sourceEdge];
    const targetPin = input.targetPins[pair.targetEdge];
    if (!sourcePin || !targetPin) continue;
    ranked.push({
      sourceEdge: pair.sourceEdge,
      targetEdge: pair.targetEdge,
      manhattan:
        Math.abs(sourcePin.x - targetPin.x) +
        Math.abs(sourcePin.y - targetPin.y),
      tie: edgePairRank(pair, input.preferred, input.secondary),
    });
  }
  ranked.sort((a, b) => {
    if (a.manhattan !== b.manhattan) return a.manhattan - b.manhattan;
    if (a.tie !== b.tie) return a.tie - b.tie;
    if (a.sourceEdge !== b.sourceEdge) {
      return a.sourceEdge < b.sourceEdge ? -1 : 1;
    }
    return a.targetEdge < b.targetEdge ? -1 : 1;
  });
  const unique: Array<{
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
    manhattan: number;
  }> = [];
  const seen = new Set<string>();
  for (const row of ranked) {
    const key = `${row.sourceEdge}:${row.targetEdge}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      sourceEdge: row.sourceEdge,
      targetEdge: row.targetEdge,
      manhattan: row.manhattan,
    });
    if (unique.length >= limit) break;
  }
  return unique;
}

export function studentConnectionEdgePairs(): Array<{
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
}> {
  const pairs: Array<{ sourceEdge: EdgeSide; targetEdge: EdgeSide }> = [];
  for (const sourceEdge of STUDENT_CONNECTION_EDGE_SIDES) {
    for (const targetEdge of STUDENT_CONNECTION_EDGE_SIDES) {
      pairs.push({ sourceEdge, targetEdge });
    }
  }
  return pairs;
}

export type CardEdgeBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function attachmentSpan(box: CardEdgeBox, edge: EdgeSide): number {
  return edge === "top" || edge === "bottom" ? box.width : box.height;
}

export function attachmentOffsetsForEdge(box: CardEdgeBox, edge: EdgeSide): number[] {
  const maxOff = attachmentSpan(box, edge) / 2 - ATTACHMENT_CORNER_CLEARANCE;
  const offsets = [0];
  if (maxOff < ATTACHMENT_SPACING - 0.01) return offsets;
  for (
    let step = ATTACHMENT_SPACING;
    step <= maxOff + 0.01;
    step += ATTACHMENT_SPACING
  ) {
    offsets.push(-step, step);
  }
  return offsets;
}

export function edgeAttachmentPin(
  box: CardEdgeBox,
  edge: EdgeSide,
  offset: number,
): Point {
  const center = edgeMidpoint(box, edge);
  if (edge === "top" || edge === "bottom") {
    return { x: center.x + offset, y: center.y };
  }
  return { x: center.x, y: center.y + offset };
}

export function alongCardEdge(point: Point, edge: EdgeSide): number {
  return edge === "top" || edge === "bottom" ? point.x : point.y;
}

export function occupiedPinsOnEdge(
  routeState: StableRouteState | undefined,
  cardId: string,
  edge: EdgeSide,
  excludeConnectionId?: string,
): Point[] {
  if (!routeState) return [];
  const pins: Point[] = [];
  for (const route of Object.values(routeState.byId)) {
    if (route.connectionId === excludeConnectionId) continue;
    if (route.sourceCardId === cardId && route.sourceEdge === edge) {
      pins.push({ ...route.sourcePin });
    }
    if (route.targetCardId === cardId && route.targetEdge === edge) {
      pins.push({ ...route.targetPin });
    }
  }
  return pins;
}

export function isPinOccupiedOnEdge(
  pin: Point,
  edge: EdgeSide,
  occupied: Point[],
  spacing = ATTACHMENT_SPACING,
): boolean {
  return occupied.some(
    (other) =>
      Math.abs(alongCardEdge(other, edge) - alongCardEdge(pin, edge)) <
      spacing - 0.01,
  );
}

export function freeAttachmentOffsets(
  box: CardEdgeBox,
  edge: EdgeSide,
  occupied: Point[],
): number[] {
  return attachmentOffsetsForEdge(box, edge).filter(
    (offset) =>
      !isPinOccupiedOnEdge(edgeAttachmentPin(box, edge, offset), edge, occupied),
  );
}

export function cardHasEdgeOccupancy(
  routeState: StableRouteState | undefined,
  cardId: string,
  excludeConnectionId?: string,
): boolean {
  return STUDENT_CONNECTION_EDGE_SIDES.some(
    (edge) => occupiedPinsOnEdge(routeState, cardId, edge, excludeConnectionId).length > 0,
  );
}

export function rebindOrthogonalAttachment(
  points: Point[],
  sourceEdge: EdgeSide,
  sourceOffset: number,
  targetEdge: EdgeSide,
  targetOffset: number,
): Point[] | null {
  if (points.length < 3) return null;
  if (sourceOffset === 0 && targetOffset === 0) {
    return points.map((point) => ({ ...point }));
  }
  const src =
    sourceEdge === "top" || sourceEdge === "bottom"
      ? { x: sourceOffset, y: 0 }
      : { x: 0, y: sourceOffset };
  const tgt =
    targetEdge === "top" || targetEdge === "bottom"
      ? { x: targetOffset, y: 0 }
      : { x: 0, y: targetOffset };
  const out = points.map((point) => ({ ...point }));
  out[0] = { x: out[0]!.x + src.x, y: out[0]!.y + src.y };
  out[1] = { x: out[1]!.x + src.x, y: out[1]!.y + src.y };
  const last = out.length - 1;
  out[last] = { x: out[last]!.x + tgt.x, y: out[last]!.y + tgt.y };
  out[last - 1] = { x: out[last - 1]!.x + tgt.x, y: out[last - 1]!.y + tgt.y };
  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]!;
    const b = out[i]!;
    if (Math.abs(a.x - b.x) > 0.51 && Math.abs(a.y - b.y) > 0.51) return null;
  }
  return out;
}

export type StudentConnectionRelation =
  (typeof STUDENT_CONNECTION_RELATIONS)[number];

export const STUDENT_CONNECTION_RELATION_LABELS: Record<
  StudentConnectionRelation,
  string
> = {
  current: "顕在",
  potential: "潜在",
  treatment: "治療",
};

export const CONNECT_NOTICE_SELF = "同じカードにはつなぐことができません";
export const CONNECT_NOTICE_DUPLICATE = "このカード間にはすでに接続があります";
export const CONNECT_NOTICE_ROUTE_FAILED = "この接続は配置できません";
export const CONNECT_NOTICE_FORBIDDEN = "このカードにはつなぐことができません";

export type ConnectTargetFailureCode =
  | "self_connection"
  | "duplicate_pair"
  | "endpoint_missing"
  | "connect_forbidden";

export type ConnectTargetEvaluation =
  | { ok: true; source: RelatedDiagramCard; target: RelatedDiagramCard }
  | { ok: false; code: ConnectTargetFailureCode; message: string };

export type StudentConnectionCreateFailureCode =
  | ConnectTargetFailureCode
  | "invalid_relation"
  | "route_failed";

export type StudentConnectionCreateResult =
  | {
      ok: true;
      graph: RelatedDiagramSemanticGraph;
      connection: RelatedDiagramConnection;
      routeState: StableRouteState;
      topology: RelatedDiagramRouteTopology | undefined;
    }
  | {
      ok: false;
      code: StudentConnectionCreateFailureCode;
      message: string;
    };

export type RelationComposeDraft = {
  sourceCardId: string;
  targetCardId: string;
};

export type StudentConnectionCandidateEvaluation = {
  accepted: boolean;
  validationOk: boolean;
  overlapsPriorRoutes: boolean;
  quality: RouteQualityReport | null;
  interaction: {
    bridges: CrossingBridge[];
    junctions: RouteJunction[];
  } | null;
  minJunctionBridgeDistance: number | null;
};

export type StudentConnectionRouteDecision = {
  plan: OrthogonalRoutePlan;
  stored: StoredRouteGeometry | null;
  usedPathfinder: boolean;
  priorRouteCount: number;
  normalGeneratedCount: number;
  normalAcceptedCount: number;
  edgePairsExplored: number;
  evaluateCount: number;
  pathfinderCalls: number;
  attachmentTried: number;
  planningMs: number;
  escalationFired: boolean;
  quality: RouteQualityReport | null;
  interaction: {
    bridges: CrossingBridge[];
    junctions: RouteJunction[];
  } | null;
};

export function newStudentConnectionId(now = Date.now()): string {
  return `cn_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneConnection(
  connection: RelatedDiagramConnection,
): RelatedDiagramConnection {
  return { ...connection };
}

export function isStudentConnectionRelation(
  value: RelatedDiagramConnectionRelationType | string,
): value is StudentConnectionRelation {
  return (
    value === "current" || value === "potential" || value === "treatment"
  );
}

export function findConnectionForCardPair(
  graph: RelatedDiagramSemanticGraph,
  cardIdA: string,
  cardIdB: string,
): RelatedDiagramConnection | null {
  return (
    graph.connections.find(
      (connection) =>
        (connection.sourceCardId === cardIdA &&
          connection.targetCardId === cardIdB) ||
        (connection.sourceCardId === cardIdB &&
          connection.targetCardId === cardIdA),
    ) ?? null
  );
}

export function connectNoticeForCode(
  code: StudentConnectionCreateFailureCode,
): string {
  switch (code) {
    case "self_connection":
      return CONNECT_NOTICE_SELF;
    case "duplicate_pair":
      return CONNECT_NOTICE_DUPLICATE;
    case "route_failed":
      return CONNECT_NOTICE_ROUTE_FAILED;
    case "connect_forbidden":
    case "endpoint_missing":
    case "invalid_relation":
      return CONNECT_NOTICE_FORBIDDEN;
  }
}

export function evaluateConnectTarget(input: {
  graph: RelatedDiagramSemanticGraph;
  sourceCardId: string;
  targetCardId: string;
}): ConnectTargetEvaluation {
  if (input.sourceCardId === input.targetCardId) {
    return {
      ok: false,
      code: "self_connection",
      message: CONNECT_NOTICE_SELF,
    };
  }
  const source = input.graph.cards.find((card) => card.id === input.sourceCardId);
  const target = input.graph.cards.find((card) => card.id === input.targetCardId);
  if (!source || !target) {
    return {
      ok: false,
      code: "endpoint_missing",
      message: CONNECT_NOTICE_FORBIDDEN,
    };
  }
  if (
    !getCardActionCapabilities(source).canConnect ||
    !getCardActionCapabilities(target).canConnect
  ) {
    return {
      ok: false,
      code: "connect_forbidden",
      message: CONNECT_NOTICE_FORBIDDEN,
    };
  }
  if (findConnectionForCardPair(input.graph, source.id, target.id)) {
    return {
      ok: false,
      code: "duplicate_pair",
      message: CONNECT_NOTICE_DUPLICATE,
    };
  }
  return { ok: true, source, target };
}

function canvasRect() {
  return { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX };
}

function connectionObstacles(cards: RelatedDiagramCard[]): RouteObstacle[] {
  return [...cards.map(cardObstacle), { id: "__legend__", ...getA3LegendBounds() }];
}

function congestionFromRouteState(
  routeState: StableRouteState | undefined,
  topology: RelatedDiagramRouteTopology | undefined,
  connectionId: string,
): CongestionContext {
  const routes = routeState
    ? Object.values(routeState.byId)
        .filter((route) => route.connectionId !== connectionId)
        .map((route) => ({
          connectionId: route.connectionId,
          points: route.points,
          groupId: topology?.routeGroups.find((group) =>
            group.connectionIds.includes(route.connectionId),
          )?.id,
        }))
    : [];
  return {
    routes,
    exemptIds: new Set([connectionId]),
    bridges: (routeState?.bridges ?? [])
      .filter(
        (bridge) =>
          bridge.jumperConnectionId !== connectionId &&
          bridge.underConnectionId !== connectionId,
      )
      .map((bridge) => ({ x: bridge.x, y: bridge.y })),
    junctions: (topology?.branchPoints ?? []).map((point) => ({
      x: point.x,
      y: point.y,
    })),
  };
}

function priorRoutedConnections(
  routeState: StableRouteState | undefined,
  connectionId: string,
): RoutedConnection[] {
  if (!routeState) return [];
  return stableRoutesList(routeState).filter(
    (route) => route.connectionId !== connectionId,
  );
}

function clonePoints(points: Point[]): Point[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function routedForCandidate(
  connection: RelatedDiagramConnection,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  points: Point[],
): RoutedConnection {
  return {
    connectionId: connection.id,
    sourceCardId: connection.sourceCardId,
    targetCardId: connection.targetCardId,
    sourceEdge,
    targetEdge,
    points: clonePoints(points),
  };
}

function storedFromRouted(
  connection: RelatedDiagramConnection,
  routed: RoutedConnection,
): StoredRouteGeometry | null {
  if (routed.points.length < 2) return null;
  return {
    connectionId: connection.id,
    sourceCardId: connection.sourceCardId,
    targetCardId: connection.targetCardId,
    sourceEdge: routed.sourceEdge,
    targetEdge: routed.targetEdge,
    sourcePin: { ...routed.points[0]! },
    targetPin: { ...routed.points[routed.points.length - 1]! },
    points: clonePoints(routed.points),
  };
}

function polylineKey(points: Point[]): string {
  return points.map((point) => `${Math.round(point.x)}:${Math.round(point.y)}`).join("|");
}

function uniquePolylines(candidates: Point[][]): Point[][] {
  const seen = new Set<string>();
  const out: Point[][] = [];
  for (const points of candidates) {
    if (points.length < 2) continue;
    const key = polylineKey(points);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(points);
  }
  return out;
}

function uniqueEdgePairPolylines(
  rows: Array<{ points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide }>,
): Array<{ points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide }> {
  const seen = new Set<string>();
  const out: Array<{
    points: Point[];
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
  }> = [];
  for (const row of rows) {
    if (row.points.length < 2) continue;
    const key = `${row.sourceEdge}:${row.targetEdge}|${polylineKey(row.points)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

function edgePairRank(
  row: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
  preferred: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
  secondary: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
): number {
  if (
    row.sourceEdge === preferred.sourceEdge &&
    row.targetEdge === preferred.targetEdge
  ) {
    return 0;
  }
  if (
    row.sourceEdge === secondary.sourceEdge &&
    row.targetEdge === secondary.targetEdge
  ) {
    return 1;
  }
  return 2;
}

function pickAcceptedStudentCandidate<
  T extends {
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
    evaluation: StudentConnectionCandidateEvaluation;
  },
>(
  pool: T[],
  preferred: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
  secondary: { sourceEdge: EdgeSide; targetEdge: EdgeSide },
): T | null {
  const qualityBest = selectQualityCandidate(
    pool,
    (item) => item.evaluation.quality!,
  );
  if (!qualityBest) return null;
  const ties = pool.filter(
    (item) =>
      compareQualityReports(
        item.evaluation.quality!,
        qualityBest.evaluation.quality!,
      ) === 0,
  );
  ties.sort(
    (a, b) =>
      edgePairRank(a, preferred, secondary) -
      edgePairRank(b, preferred, secondary),
  );
  return ties[0] ?? qualityBest;
}

function bridgesForConnection(
  bridges: CrossingBridge[],
  connectionId: string,
): CrossingBridge[] {
  return bridges.filter(
    (bridge) =>
      bridge.jumperConnectionId === connectionId ||
      bridge.underConnectionId === connectionId,
  );
}

function bridgeSignature(bridges: CrossingBridge[], connectionId: string): string {
  return bridgesForConnection(bridges, connectionId)
    .map(
      (bridge) =>
        `${Math.round(bridge.x)}:${Math.round(bridge.y)}:${bridge.jumperConnectionId}:${bridge.underConnectionId}:${bridge.jumperAxis}`,
    )
    .sort()
    .join("|");
}

function minJunctionBridgeDistance(
  bridges: CrossingBridge[],
  junctions: Array<{ x: number; y: number }>,
  connectionId: string,
): number | null {
  const relevant = bridgesForConnection(bridges, connectionId);
  if (relevant.length === 0 || junctions.length === 0) return null;
  let best = Infinity;
  for (const bridge of relevant) {
    for (const junction of junctions) {
      best = Math.min(
        best,
        Math.hypot(junction.x - bridge.x, junction.y - bridge.y),
      );
    }
  }
  return Number.isFinite(best) ? best : null;
}

function interactionSpacingOk(
  classified: { bridges: CrossingBridge[]; junctions: RouteJunction[] },
  connectionId: string,
): boolean {
  const distance = minJunctionBridgeDistance(
    classified.bridges,
    classified.junctions,
    connectionId,
  );
  return distance == null || distance >= MIN_JUNCTION_BRIDGE_DISTANCE;
}

function qualityMeetsFreeze(quality: RouteQualityReport): boolean {
  return quality.legal && quality.class !== "reject";
}

export function studentConnectionOverlapsPriorRoutes(
  points: Point[],
  routeState: StableRouteState | undefined,
  connectionId: string,
): boolean {
  const prior = priorRoutedConnections(routeState, connectionId);
  for (let i = 1; i < points.length; i++) {
    const a1 = points[i - 1]!;
    const a2 = points[i]!;
    for (const other of prior) {
      for (let j = 1; j < other.points.length; j++) {
        if (isColinearOverlap(a1, a2, other.points[j - 1]!, other.points[j]!)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function evaluateStudentConnectionPolyline(input: {
  cards: RelatedDiagramCard[];
  connection: RelatedDiagramConnection;
  points: Point[];
  sourceEdge: EdgeSide;
  targetEdge: EdgeSide;
  routeState?: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): StudentConnectionCandidateEvaluation {
  const source = input.cards.find((card) => card.id === input.connection.sourceCardId);
  const target = input.cards.find((card) => card.id === input.connection.targetCardId);
  if (!source || !target || input.points.length < 2) {
    return {
      accepted: false,
      validationOk: false,
      overlapsPriorRoutes: false,
      quality: null,
      interaction: null,
      minJunctionBridgeDistance: null,
    };
  }
  const sourcePin = { ...input.points[0]! };
  const targetPin = { ...input.points[input.points.length - 1]! };
  const obstacles = connectionObstacles(input.cards);
  const validation = validateOrthogonalRoute({
    points: input.points,
    sourcePin,
    targetPin,
    obstacles,
    sourceCardId: source.id,
    targetCardId: target.id,
    clearance: 0,
    sourceEdge: input.sourceEdge,
    targetEdge: input.targetEdge,
  });
  const overlapsPriorRoutes = studentConnectionOverlapsPriorRoutes(
    input.points,
    input.routeState,
    input.connection.id,
  );
  const congestion = congestionFromRouteState(
    input.routeState,
    input.topology,
    input.connection.id,
  );
  const quality = evaluateRouteQuality({
    points: input.points,
    sourcePin,
    targetPin,
    congestion,
    hardReasons: validation.reasons,
  });
  const routed = routedForCandidate(
    input.connection,
    input.sourceEdge,
    input.targetEdge,
    input.points,
  );
  const interaction = classifyRouteInteractions(
    [...priorRoutedConnections(input.routeState, input.connection.id), routed],
    input.cards,
    input.topology,
  );
  const junctionDistance = minJunctionBridgeDistance(
    interaction.bridges,
    interaction.junctions,
    input.connection.id,
  );
  return {
    accepted:
      validation.ok &&
      !overlapsPriorRoutes &&
      qualityMeetsFreeze(quality) &&
      interactionSpacingOk(interaction, input.connection.id),
    validationOk: validation.ok,
    overlapsPriorRoutes,
    quality,
    interaction,
    minJunctionBridgeDistance: junctionDistance,
  };
}

function emptyFailedPlan(
  connection: RelatedDiagramConnection,
  sourceEdge: EdgeSide,
  targetEdge: EdgeSide,
  points: Point[],
): OrthogonalRoutePlan {
  return {
    routes: [],
    bridges: [],
    junctions: [],
    invalidRoutes: [
      {
        connectionId: connection.id,
        sourceCardId: connection.sourceCardId,
        targetCardId: connection.targetCardId,
        sourceEdge,
        targetEdge,
        points: clonePoints(points),
        reasons: ["no-legal-route"],
      },
    ],
  };
}

function planFromAccepted(
  routed: RoutedConnection,
  interaction: { bridges: CrossingBridge[]; junctions: RouteJunction[] },
): OrthogonalRoutePlan {
  return {
    routes: [routed],
    bridges: interaction.bridges.map((bridge) => ({ ...bridge })),
    junctions: interaction.junctions.map((junction) => ({ ...junction })),
    invalidRoutes: [],
  };
}

function pathfinderPolylines(input: {
  source: RelatedDiagramCard;
  target: RelatedDiagramCard;
  cards: RelatedDiagramCard[];
  congestion: CongestionContext;
  priorRoutes: Point[][];
  sourcePinFor: (edge: EdgeSide) => Point;
  targetPinFor: (edge: EdgeSide) => Point;
}): {
  rows: Array<{ points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide }>;
  calls: number;
} {
  let calls = 0;
  const tryPair = (sourceEdge: EdgeSide, targetEdge: EdgeSide) => {
    const sourcePin = input.sourcePinFor(sourceEdge);
    const targetPin = input.targetPinFor(targetEdge);
    const args = {
      start: sourcePin,
      goal: targetPin,
      startStub: outwardPoint(sourcePin, sourceEdge, MIN_ENDPOINT_STUB),
      goalApproach: outwardPoint(targetPin, targetEdge, MIN_ARROW_APPROACH),
      obstacles: connectionObstacles(input.cards),
      ignoreIds: new Set<string>(),
      corridors: [
        sourceExitCorridor(input.source.id, sourcePin, sourceEdge),
        targetEntryCorridor(input.target.id, targetPin, targetEdge),
      ],
      priorRoutes: input.priorRoutes,
      congestion: input.congestion,
    };
    calls += 2;
    return uniquePolylines(
      [
        findRectilinearPath(args),
        findRectilinearPath({ ...args, congestion: undefined, clearance: 0 }),
      ].filter((points): points is Point[] => Boolean(points)),
    ).map((points) => ({ points, sourceEdge, targetEdge }));
  };
  const rows: Array<{
    points: Point[];
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
  }> = [];
  for (const pair of studentConnectionEdgePairs()) {
    rows.push(...tryPair(pair.sourceEdge, pair.targetEdge));
  }
  return { rows: uniqueEdgePairPolylines(rows), calls };
}

export function decideStudentConnectionRoute(input: {
  cards: RelatedDiagramCard[];
  connection: RelatedDiagramConnection;
  topology?: RelatedDiagramRouteTopology;
  routeState?: StableRouteState;
}): StudentConnectionRouteDecision {
  const started = performance.now();
  const source = input.cards.find((card) => card.id === input.connection.sourceCardId);
  const target = input.cards.find((card) => card.id === input.connection.targetCardId);
  const prior = priorRoutedConnections(input.routeState, input.connection.id);
  const priorRouteCount = prior.length;
  const blank = (
    extra: Partial<StudentConnectionRouteDecision>,
  ): StudentConnectionRouteDecision => ({
    plan: extra.plan ?? emptyFailedPlan(input.connection, "right", "left", []),
    stored: extra.stored ?? null,
    usedPathfinder: extra.usedPathfinder ?? false,
    priorRouteCount,
    normalGeneratedCount: extra.normalGeneratedCount ?? 0,
    normalAcceptedCount: extra.normalAcceptedCount ?? 0,
    edgePairsExplored: extra.edgePairsExplored ?? 0,
    evaluateCount: extra.evaluateCount ?? 0,
    pathfinderCalls: extra.pathfinderCalls ?? 0,
    attachmentTried: extra.attachmentTried ?? 0,
    escalationFired: extra.escalationFired ?? false,
    planningMs: performance.now() - started,
    quality: extra.quality ?? null,
    interaction: extra.interaction ?? null,
  });
  if (!source || !target) {
    return blank({});
  }

  const edges = chooseCardEdges(source, target);
  const secondary = secondaryEdgePair(edges);
  const sourceBox = cardObstacle(source);
  const targetBox = cardObstacle(target);
  const sourcePin = edgeMidpoint(sourceBox, edges.sourceEdge);
  const targetPin = edgeMidpoint(targetBox, edges.targetEdge);
  const canvas = defaultRouteCanvas();
  const obstacles = connectionObstacles(input.cards);
  const congestion = congestionFromRouteState(
    input.routeState,
    input.topology,
    input.connection.id,
  );
  const edgePairs = studentConnectionEdgePairs();
  const excludeId = input.connection.id;
  const sourceOccupied = Object.fromEntries(
    STUDENT_CONNECTION_EDGE_SIDES.map((edge) => [
      edge,
      occupiedPinsOnEdge(input.routeState, source.id, edge, excludeId),
    ]),
  ) as Record<EdgeSide, Point[]>;
  const targetOccupied = Object.fromEntries(
    STUDENT_CONNECTION_EDGE_SIDES.map((edge) => [
      edge,
      occupiedPinsOnEdge(input.routeState, target.id, edge, excludeId),
    ]),
  ) as Record<EdgeSide, Point[]>;
  const sourceFree = Object.fromEntries(
    STUDENT_CONNECTION_EDGE_SIDES.map((edge) => [
      edge,
      freeAttachmentOffsets(sourceBox, edge, sourceOccupied[edge]),
    ]),
  ) as Record<EdgeSide, number[]>;
  const targetFree = Object.fromEntries(
    STUDENT_CONNECTION_EDGE_SIDES.map((edge) => [
      edge,
      freeAttachmentOffsets(targetBox, edge, targetOccupied[edge]),
    ]),
  ) as Record<EdgeSide, number[]>;
  const occupancyPresent =
    cardHasEdgeOccupancy(input.routeState, source.id, excludeId) ||
    cardHasEdgeOccupancy(input.routeState, target.id, excludeId);

  const isolated = planOrthogonalRoutes(input.cards, [input.connection], {
    canvas: canvasRect(),
    extraObstacles: [getA3LegendBounds()],
    topology: input.topology,
  });
  const generatedByPair = new Map<
    string,
    Array<{ points: Point[]; sourceEdge: EdgeSide; targetEdge: EdgeSide }>
  >();
  const generated: Array<{
    points: Point[];
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
  }> = [];
  for (const pair of edgePairs) {
    const rows = generateOrthogonalCandidates({
      source: sourceBox,
      target: targetBox,
      sourceEdge: pair.sourceEdge,
      targetEdge: pair.targetEdge,
      obstacles,
      canvas,
    }).map((points) => ({
      points,
      sourceEdge: pair.sourceEdge,
      targetEdge: pair.targetEdge,
    }));
    generatedByPair.set(`${pair.sourceEdge}:${pair.targetEdge}`, rows);
    generated.push(...rows);
  }
  for (const route of isolated.routes) {
    if (route.connectionId !== input.connection.id) continue;
    const key = `${route.sourceEdge}:${route.targetEdge}`;
    const row = {
      points: route.points,
      sourceEdge: route.sourceEdge,
      targetEdge: route.targetEdge,
    };
    generated.push(row);
    generatedByPair.set(key, [...(generatedByPair.get(key) ?? []), row]);
  }
  const normalCandidates = uniqueEdgePairPolylines(generated);

  type Scored = {
    points: Point[];
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
    evaluation: StudentConnectionCandidateEvaluation;
  };
  let evaluateCount = 0;
  let attachmentTried = 1;
  const scoreCandidate = (
    points: Point[],
    sourceEdge: EdgeSide,
    targetEdge: EdgeSide,
  ): StudentConnectionCandidateEvaluation => {
    evaluateCount += 1;
    return evaluateStudentConnectionPolyline({
      cards: input.cards,
      connection: input.connection,
      points,
      sourceEdge,
      targetEdge,
      routeState: input.routeState,
      topology: input.topology,
    });
  };

  const accepted: Scored[] = [];
  const seen = new Set<string>();
  const consider = (
    points: Point[],
    sourceEdge: EdgeSide,
    targetEdge: EdgeSide,
  ) => {
    const key = `${sourceEdge}:${targetEdge}|${polylineKey(points)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const evaluation = scoreCandidate(points, sourceEdge, targetEdge);
    if (evaluation.accepted) {
      accepted.push({ points, sourceEdge, targetEdge, evaluation });
    }
  };

  // Stage A: center 16-pair, skip a pair end whose center is occupied.
  for (const pair of edgePairs) {
    const sourceCenterFree = sourceFree[pair.sourceEdge].includes(0);
    const targetCenterFree = targetFree[pair.targetEdge].includes(0);
    if (!sourceCenterFree || !targetCenterFree) continue;
    for (const row of generatedByPair.get(`${pair.sourceEdge}:${pair.targetEdge}`) ?? []) {
      consider(row.points, row.sourceEdge, row.targetEdge);
    }
  }

  // Stage B: nearest free offsets on occupied edges, then next frees only if needed.
  if (occupancyPresent) {
    const maxDepth = Math.max(
      1,
      ...STUDENT_CONNECTION_EDGE_SIDES.map((edge) =>
        sourceOccupied[edge].length > 0 || targetOccupied[edge].length > 0
          ? Math.max(sourceFree[edge].length, targetFree[edge].length)
          : 1,
      ),
    );
    for (let depth = 0; depth < maxDepth; depth++) {
      const before = accepted.length;
      for (const pair of edgePairs) {
        const srcOffs =
          sourceOccupied[pair.sourceEdge].length > 0
            ? sourceFree[pair.sourceEdge]
            : [0];
        const tgtOffs =
          targetOccupied[pair.targetEdge].length > 0
            ? targetFree[pair.targetEdge]
            : [0];
        if (srcOffs.length === 0 || tgtOffs.length === 0) continue;
        const srcOff = srcOffs[Math.min(depth, srcOffs.length - 1)] ?? 0;
        const tgtOff = tgtOffs[Math.min(depth, tgtOffs.length - 1)] ?? 0;
        if (srcOff === 0 && tgtOff === 0) continue;
        const rows = generatedByPair.get(`${pair.sourceEdge}:${pair.targetEdge}`) ?? [];
        attachmentTried += 1;
        for (const row of rows) {
          const rebound = rebindOrthogonalAttachment(
            row.points,
            pair.sourceEdge,
            srcOff,
            pair.targetEdge,
            tgtOff,
          );
          if (!rebound) continue;
          consider(rebound, pair.sourceEdge, pair.targetEdge);
        }
      }
      if (accepted.length > before) break;
    }
  }

  const pickAccepted = (pool: Scored[]) =>
    pickAcceptedStudentCandidate(pool, edges, secondary);

  const finish = (
    best: Scored,
    usedPathfinder: boolean,
    pathfinderCalls: number,
    escalationFired = false,
  ) => {
    const routed = routedForCandidate(
      input.connection,
      best.sourceEdge,
      best.targetEdge,
      best.points,
    );
    return blank({
      plan: planFromAccepted(routed, best.evaluation.interaction!),
      stored: storedFromRouted(input.connection, routed),
      usedPathfinder,
      normalGeneratedCount: normalCandidates.length,
      normalAcceptedCount: accepted.length,
      edgePairsExplored: STUDENT_CONNECTION_EDGE_PAIR_COUNT,
      evaluateCount,
      pathfinderCalls,
      attachmentTried,
      escalationFired,
      quality: best.evaluation.quality,
      interaction: best.evaluation.interaction,
    });
  };

  const legalPin = (
    box: typeof sourceBox,
    edge: EdgeSide,
    frees: number[],
  ): Point | null => {
    if (frees.length === 0) return null;
    return edgeAttachmentPin(box, edge, frees[0]!);
  };

  const escalatePerimeter = (normalBest: Scored) => {
    const sourcePins = Object.fromEntries(
      STUDENT_CONNECTION_EDGE_SIDES.map((edge) => [
        edge,
        legalPin(sourceBox, edge, sourceFree[edge]),
      ]),
    ) as Record<EdgeSide, Point | null>;
    const targetPins = Object.fromEntries(
      STUDENT_CONNECTION_EDGE_SIDES.map((edge) => [
        edge,
        legalPin(targetBox, edge, targetFree[edge]),
      ]),
    ) as Record<EdgeSide, Point | null>;
    const pairs = rankEscalationEdgePairs({
      sourcePins,
      targetPins,
      preferred: edges,
      secondary,
    });
    let pathfinderCalls = 0;
    const seenPairs = new Set<string>();
    for (const pair of pairs) {
      const key = `${pair.sourceEdge}:${pair.targetEdge}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      const sourcePinFor = sourcePins[pair.sourceEdge];
      const targetPinFor = targetPins[pair.targetEdge];
      if (!sourcePinFor || !targetPinFor) continue;
      pathfinderCalls += 1;
      const found = findRectilinearPath({
        start: sourcePinFor,
        goal: targetPinFor,
        startStub: outwardPoint(sourcePinFor, pair.sourceEdge, MIN_ENDPOINT_STUB),
        goalApproach: outwardPoint(
          targetPinFor,
          pair.targetEdge,
          MIN_ARROW_APPROACH,
        ),
        obstacles,
        ignoreIds: new Set<string>(),
        corridors: [
          sourceExitCorridor(source.id, sourcePinFor, pair.sourceEdge),
          targetEntryCorridor(target.id, targetPinFor, pair.targetEdge),
        ],
        priorRoutes: prior.map((route) => route.points),
        clearance: 0,
      });
      if (!found) continue;
      consider(found, pair.sourceEdge, pair.targetEdge);
    }
    const picked = pickAccepted(accepted) ?? normalBest;
    const usedPathfinder =
      polylineKey(picked.points) !== polylineKey(normalBest.points);
    return finish(picked, usedPathfinder, pathfinderCalls, true);
  };

  const normalBest = pickAccepted(accepted);
  if (normalBest) {
    if (shouldEscalatePerimeterRoute(normalBest.points)) {
      return escalatePerimeter(normalBest);
    }
    return finish(normalBest, false, 0, false);
  }

  const pinFor = (
    box: typeof sourceBox,
    edge: EdgeSide,
    frees: number[],
    index = 0,
  ) => edgeAttachmentPin(box, edge, frees[Math.min(index, Math.max(0, frees.length - 1))] ?? 0);

  let pathfinderCalls = 0;
  let recoveredRaw: Array<{
    points: Point[];
    sourceEdge: EdgeSide;
    targetEdge: EdgeSide;
  }> = [];
  const maxPfDepth = Math.max(
    1,
    ...STUDENT_CONNECTION_EDGE_SIDES.map((edge) =>
      Math.max(sourceFree[edge].length, targetFree[edge].length),
    ),
  );
  for (let depth = 0; depth < maxPfDepth; depth++) {
    const anyNewOffset =
      depth === 0 ||
      STUDENT_CONNECTION_EDGE_SIDES.some(
        (edge) =>
          (sourceOccupied[edge].length > 0 && depth < sourceFree[edge].length) ||
          (targetOccupied[edge].length > 0 && depth < targetFree[edge].length),
      );
    if (!anyNewOffset) break;
    attachmentTried += 1;
    const found = pathfinderPolylines({
      source,
      target,
      cards: input.cards,
      congestion,
      priorRoutes: prior.map((route) => route.points),
      sourcePinFor: (edge) =>
        pinFor(
          sourceBox,
          edge,
          sourceOccupied[edge].length > 0 ? sourceFree[edge] : [0],
          depth,
        ),
      targetPinFor: (edge) =>
        pinFor(
          targetBox,
          edge,
          targetOccupied[edge].length > 0 ? targetFree[edge] : [0],
          depth,
        ),
    });
    pathfinderCalls += found.calls;
    recoveredRaw = found.rows;
    const recovered = found.rows
      .map((row) => ({
        ...row,
        evaluation: scoreCandidate(row.points, row.sourceEdge, row.targetEdge),
      }))
      .filter((row) => row.evaluation.accepted);
    const recoveredBest = pickAccepted(recovered);
    if (recoveredBest) {
      return finish(recoveredBest, true, pathfinderCalls);
    }
    if (depth === 0 && !occupancyPresent) break;
  }

  return blank({
    plan: emptyFailedPlan(input.connection, edges.sourceEdge, edges.targetEdge, [
      sourcePin,
      targetPin,
    ]),
    usedPathfinder: recoveredRaw.length > 0,
    normalGeneratedCount: normalCandidates.length,
    normalAcceptedCount: 0,
    edgePairsExplored: STUDENT_CONNECTION_EDGE_PAIR_COUNT,
    evaluateCount,
    pathfinderCalls,
    attachmentTried,
  });
}

export function studentConnectionRouteAccepted(
  plan: OrthogonalRoutePlan,
  connectionId: string,
): boolean {
  return plan.routes.some((route) => route.connectionId === connectionId);
}

export function planStudentConnectionRoute(input: {
  cards: RelatedDiagramCard[];
  connection: RelatedDiagramConnection;
  topology?: RelatedDiagramRouteTopology;
  routeState?: StableRouteState;
}): OrthogonalRoutePlan {
  return decideStudentConnectionRoute(input).plan;
}

function storedFromAccepted(
  connection: RelatedDiagramConnection,
  plan: OrthogonalRoutePlan,
): StoredRouteGeometry | null {
  const accepted = plan.routes.find(
    (route) => route.connectionId === connection.id,
  );
  if (!accepted) return null;
  return storedFromRouted(connection, accepted);
}

function existingRoutesUnchanged(
  previous: StableRouteState,
  next: StableRouteState,
  newConnectionId: string,
): boolean {
  for (const [id, route] of Object.entries(previous.byId)) {
    if (id === newConnectionId) continue;
    const after = next.byId[id];
    if (!after || !pointsDeepEqual(route.points, after.points)) return false;
  }
  return true;
}

function mergeMatchesPlan(
  planned: { bridges: CrossingBridge[]; junctions: RouteJunction[] },
  merged: { bridges: CrossingBridge[]; junctions: RouteJunction[] },
  connectionId: string,
): boolean {
  if (bridgeSignature(planned.bridges, connectionId) !== bridgeSignature(merged.bridges, connectionId)) {
    return false;
  }
  return interactionSpacingOk(merged, connectionId);
}

export function mergeStudentConnectionRoute(input: {
  previous: StableRouteState;
  stored: StoredRouteGeometry;
  cards: RelatedDiagramCard[];
  topology?: RelatedDiagramRouteTopology;
}): StableRouteState {
  const next = cloneStableRouteState(input.previous);
  next.byId[input.stored.connectionId] = {
    ...input.stored,
    sourcePin: { ...input.stored.sourcePin },
    targetPin: { ...input.stored.targetPin },
    points: clonePoints(input.stored.points),
  };
  next.lastValidPoints[input.stored.connectionId] = clonePoints(input.stored.points);
  delete next.invalidReasons[input.stored.connectionId];
  const classified = classifyRouteInteractions(
    stableRoutesList(next),
    input.cards,
    input.topology,
  );
  next.bridges = classified.bridges.map((bridge) => ({ ...bridge }));
  return next;
}

export function finalizeStudentConnectionCreate(input: {
  previousGraph: RelatedDiagramSemanticGraph;
  nextGraph: RelatedDiagramSemanticGraph;
  connection: RelatedDiagramConnection;
  plan: OrthogonalRoutePlan;
  previousRouteState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): StudentConnectionCreateResult {
  if (!studentConnectionRouteAccepted(input.plan, input.connection.id)) {
    return {
      ok: false,
      code: "route_failed",
      message: CONNECT_NOTICE_ROUTE_FAILED,
    };
  }
  const stored = storedFromAccepted(input.connection, input.plan);
  if (!stored) {
    return {
      ok: false,
      code: "route_failed",
      message: CONNECT_NOTICE_ROUTE_FAILED,
    };
  }
  const planned = evaluateStudentConnectionPolyline({
    cards: input.nextGraph.cards,
    connection: input.connection,
    points: stored.points,
    sourceEdge: stored.sourceEdge,
    targetEdge: stored.targetEdge,
    routeState: input.previousRouteState,
    topology: input.topology,
  });
  if (!planned.accepted || !planned.interaction) {
    return {
      ok: false,
      code: "route_failed",
      message: CONNECT_NOTICE_ROUTE_FAILED,
    };
  }
  const routeState = mergeStudentConnectionRoute({
    previous: input.previousRouteState,
    stored,
    cards: input.nextGraph.cards,
    topology: input.topology,
  });
  const merged = classifyRouteInteractions(
    stableRoutesList(routeState),
    input.nextGraph.cards,
    input.topology,
  );
  if (
    !existingRoutesUnchanged(
      input.previousRouteState,
      routeState,
      input.connection.id,
    ) ||
    !mergeMatchesPlan(planned.interaction, merged, input.connection.id)
  ) {
    return {
      ok: false,
      code: "route_failed",
      message: CONNECT_NOTICE_ROUTE_FAILED,
    };
  }
  return {
    ok: true,
    graph: input.nextGraph,
    connection: cloneConnection(input.connection),
    routeState,
    topology: input.topology,
  };
}

export function commitStudentConnectionCreate(input: {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
  sourceCardId: string;
  targetCardId: string;
  relationType: RelatedDiagramConnectionRelationType;
  connectionId?: string;
  now?: string;
}): StudentConnectionCreateResult {
  const target = evaluateConnectTarget({
    graph: input.graph,
    sourceCardId: input.sourceCardId,
    targetCardId: input.targetCardId,
  });
  if (!target.ok) return target;
  if (!isStudentConnectionRelation(input.relationType)) {
    return {
      ok: false,
      code: "invalid_relation",
      message: CONNECT_NOTICE_FORBIDDEN,
    };
  }
  const ts = input.now ?? "2026-09-18T00:00:00.000Z";
  const drafted: RelatedDiagramConnection = {
    id: input.connectionId ?? newStudentConnectionId(),
    sourceCardId: input.sourceCardId,
    targetCardId: input.targetCardId,
    relationType: input.relationType,
    origin: STUDENT_CONNECTION_ORIGIN,
    createdAt: ts,
    updatedAt: ts,
  };
  const decision = decideStudentConnectionRoute({
    cards: input.graph.cards,
    connection: drafted,
    topology: input.topology,
    routeState: input.routeState,
  });
  if (!decision.stored || !studentConnectionRouteAccepted(decision.plan, drafted.id)) {
    return {
      ok: false,
      code: "route_failed",
      message: CONNECT_NOTICE_ROUTE_FAILED,
    };
  }
  const upserted = upsertConnection(input.graph, {
    id: drafted.id,
    sourceCardId: drafted.sourceCardId,
    targetCardId: drafted.targetCardId,
    relationType: drafted.relationType,
    origin: drafted.origin,
    now: ts,
  });
  if (!upserted.ok) {
    return {
      ok: false,
      code:
        upserted.code === "self_connection" ||
        upserted.code === "endpoint_missing"
          ? upserted.code
          : "connect_forbidden",
      message: upserted.message,
    };
  }
  return finalizeStudentConnectionCreate({
    previousGraph: input.graph,
    nextGraph: upserted.graph,
    connection: upserted.value,
    plan: decision.plan,
    previousRouteState: input.routeState,
    topology: input.topology,
  });
}
