/**
 * Slice 2A routing hardening tests.
 * Run: npx tsx lib/v2/relatedDiagram/routeHardening.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { applyCardPositionToGraph } from "./cardInteractionState";
import { applyKnowledgeGroupDelta } from "./knowledgeGroupLayout";
import {
  BRIDGE_RADIUS_PX,
  hopRadiusForSegment,
  isOrthogonalPolyline,
  planOrthogonalRoutes,
} from "./orthogonalRouting";
import {
  BRANCH_EXIT_SPACING,
  BRIDGE_SAFE_MARGIN,
  CARD_ROUTE_CLEARANCE,
  MIN_ARROW_APPROACH,
  MIN_BRANCH_CLEARANCE,
  MIN_ENDPOINT_STUB,
  cardObstacle,
  clearBranchPoint,
  firstSegmentLength,
  isSafeBridgePlacement,
  keepOutRect,
  lastSegmentLength,
  minBridgeSegmentLength,
  normalizeOrthogonalPolyline,
  polylineContinuity,
  polylineViolatesKeepOuts,
  selectBestOrthogonalRoute,
  validateOrthogonalRoute,
} from "./routeHardening";
import { ROUTE_TOPOLOGY_SCHEMA } from "./routeTopology";
import {
  captureTopologyGeometryParams,
  regenerateExplicitTopologyGeometry,
  topologyMembershipSnapshot,
  translateKnowledgeTopology,
} from "./regenerateRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import type { RelatedDiagramCard } from "./types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

function card(
  id: string,
  x: number,
  y: number,
  width = 80,
  height = 40,
): RelatedDiagramCard {
  return {
    id,
    cardType: "information",
    text: id,
    state: null,
    origin: "patient_information",
    layout: { x, y, width, height, zIndex: 0 },
    isLocked: true,
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
  };
}

function scene() {
  const s = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  assert.ok(s.routeTopology);
  const params = captureTopologyGeometryParams(
    s.routeTopology!,
    s.graph.cards,
    s.graph.connections,
  );
  return { ...s, params, topology: s.routeTopology! };
}

function regen(
  s: ReturnType<typeof scene>,
  cards = s.graph.cards,
  topology = s.topology,
) {
  return regenerateExplicitTopologyGeometry({
    topology,
    cards,
    connections: s.graph.connections,
    geometryParams: s.params,
  });
}

test("A1-4 continuity normalize: pins, no gap, no zero, no dup, orthogonal", () => {
  const source = { x: 10, y: 20 };
  const target = { x: 110, y: 80 };
  const raw = [
    { x: 10.2, y: 20 },
    { x: 10.2, y: 20 },
    { x: 60, y: 20.3 },
    { x: 80, y: 20.3 },
    { x: 80, y: 80 },
    { x: 110, y: 80 },
  ];
  const pts = normalizeOrthogonalPolyline(raw, source, target);
  const c = polylineContinuity(pts);
  assert.equal(pts[0]!.x, source.x);
  assert.equal(pts[0]!.y, source.y);
  assert.equal(pts[pts.length - 1]!.x, target.x);
  assert.equal(pts[pts.length - 1]!.y, target.y);
  assert.equal(c.continuous, true);
  assert.equal(c.noZeroLength, true);
  assert.equal(c.noDuplicates, true);
  assert.equal(c.orthogonal, true);
});

test("normalize keeps exact source and target pins; adds a bend instead", () => {
  const source = { x: 10, y: 20 };
  const target = { x: 140, y: 90 };
  const pts = normalizeOrthogonalPolyline(
    [source, { x: 80, y: 55 }, { x: 120, y: 70 }],
    source,
    target,
  );
  assert.equal(pts[0]!.x, source.x);
  assert.equal(pts[0]!.y, source.y);
  assert.equal(pts[pts.length - 1]!.x, target.x);
  assert.equal(pts[pts.length - 1]!.y, target.y);
  assert.ok(isOrthogonalPolyline(pts));
});

test("B5-7 unrelated card and keep-out are not pierced; endpoints still connect", () => {
  const source = card("a", 0, 80);
  const target = card("b", 280, 80);
  const wall = card("wall", 110, 50, 80, 100);
  const points = selectBestOrthogonalRoute({
    source: cardObstacle(source),
    target: cardObstacle(target),
    sourceEdge: "right",
    targetEdge: "left",
    obstacles: [source, wall, target].map(cardObstacle),
  });
  assert.ok(points);
  const ignore = new Set(["a", "b"]);
  const obstacles = [source, wall, target].map(cardObstacle);
  assert.equal(
    polylineViolatesKeepOuts(points!, obstacles, ignore, CARD_ROUTE_CLEARANCE),
    false,
  );
  assert.equal(
    polylineViolatesKeepOuts(
      points!,
      obstacles,
      ignore,
      0,
    ),
    false,
  );
  assert.ok(Math.abs(points![0]!.x - (source.layout.x + source.layout.width)) < 0.6);
  assert.ok(Math.abs(points![points!.length - 1]!.x - target.layout.x) < 0.6);
});

test("B8 moving a card regenerates a route that still avoids neighbors", () => {
  const s = scene();
  const moved = applyCardPositionToGraph(s.graph, "sk_da", 520, 180);
  const next = regen(s, moved.cards);
  const route = next.routes.find((r) => r.connectionId === "skc2");
  assert.ok(route);
  const ignore = new Set(["sk_patho_core", "sk_da"]);
  assert.equal(
    polylineViolatesKeepOuts(
      route!.points,
      moved.cards.map(cardObstacle),
      ignore,
      CARD_ROUTE_CLEARANCE,
    ),
    false,
  );
  assert.equal(polylineContinuity(route!.points).continuous, true);
});

test("C9-10 source stub and target approach minima", () => {
  const source = card("a", 0, 40);
  const target = card("b", 260, 40);
  const points = selectBestOrthogonalRoute({
    source: cardObstacle(source),
    target: cardObstacle(target),
    sourceEdge: "right",
    targetEdge: "left",
    obstacles: [source, target].map(cardObstacle),
  });
  assert.ok(points);
  assert.ok(firstSegmentLength(points!) >= MIN_ENDPOINT_STUB - 0.2);
  assert.ok(lastSegmentLength(points!) >= MIN_ARROW_APPROACH - 0.2);
});

test("C11 / E16-19 bridge forbidden near endpoint, bend, short segment", () => {
  const line = [
    { x: 0, y: 40 },
    { x: 40, y: 40 },
    { x: 40, y: 120 },
    { x: 160, y: 120 },
  ];
  assert.equal(
    isSafeBridgePlacement({ x: 8, y: 40 }, line),
    false,
    "near source endpoint",
  );
  assert.equal(
    isSafeBridgePlacement({ x: 40, y: 48 }, line),
    false,
    "near bend",
  );
  assert.equal(
    isSafeBridgePlacement({ x: 20, y: 40 }, [{ x: 0, y: 40 }, { x: 30, y: 40 }]),
    false,
    "short segment",
  );
  const long = [
    { x: 0, y: 50 },
    { x: 200, y: 50 },
  ];
  assert.equal(isSafeBridgePlacement({ x: 100, y: 50 }, long), true);
  assert.equal(hopRadiusForSegment(minBridgeSegmentLength(), BRIDGE_RADIUS_PX), null);
  assert.equal(hopRadiusForSegment(80, BRIDGE_RADIUS_PX), BRIDGE_RADIUS_PX);
  assert.ok(BRIDGE_SAFE_MARGIN >= 8);
});

test("D12-14 branch clearance, no zero-length child, fan avoids cards", () => {
  const source = { x: 0, y: 0, width: 80, height: 40 };
  const child = { x: 20, y: 50, width: 80, height: 40 };
  const pushed = clearBranchPoint(
    { x: 40, y: 52 },
    [source, child],
    { x: 0, y: 1 },
    MIN_BRANCH_CLEARANCE,
  );
  assert.ok(
    Math.min(
      Math.abs(pushed.y - (source.y + source.height)),
      Math.abs(pushed.y - child.y),
    ) >= MIN_BRANCH_CLEARANCE - 0.5 ||
      Math.abs(pushed.x - 40) > 8,
  );

  const s = scene();
  const near = applyCardPositionToGraph(s.graph, "sk_hallucination", 40, 400);
  const next = regen(s, near.cards);
  const route = next.routes.find((r) => r.connectionId === "skc9")!;
  const c = polylineContinuity(route.points);
  assert.equal(c.noZeroLength, true);
  assert.equal(c.orthogonal, true);
  assert.ok(firstSegmentLength(route.points) > 1);
  assert.equal(
    polylineViolatesKeepOuts(
      route.points,
      near.cards.map(cardObstacle),
      new Set(["sk_positive", "sk_hallucination"]),
      CARD_ROUTE_CLEARANCE,
    ),
    false,
  );
  const membership = topologyMembershipSnapshot(next);
  assert.deepEqual(membership.groupIds, topologyMembershipSnapshot(s.topology).groupIds);
});

test("E15 crossing stays segment-interior after negative-fan regen", () => {
  const s = scene();
  const moved = applyCardPositionToGraph(s.graph, "sk_avolition", 240, 620);
  const next = regen(s, moved.cards);
  const plan = planOrthogonalRoutes(moved.cards, moved.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    topology: next,
  });
  assert.ok(plan.bridges.length >= 1);
  for (const br of plan.bridges) {
    const jumper = plan.routes.find((r) => r.connectionId === br.jumperConnectionId);
    assert.ok(jumper);
    const pts = jumper!.points;
    let interior = false;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const h = Math.abs(a.y - b.y) <= 1.1;
      if (h) {
        const lo = Math.min(a.x, b.x);
        const hi = Math.max(a.x, b.x);
        if (br.x > lo + 0.35 && br.x < hi - 0.35 && Math.abs(br.y - a.y) <= 2) {
          interior = true;
        }
      } else {
        const lo = Math.min(a.y, b.y);
        const hi = Math.max(a.y, b.y);
        if (br.y > lo + 0.35 && br.y < hi - 0.35 && Math.abs(br.x - a.x) <= 2) {
          interior = true;
        }
      }
    }
    assert.equal(interior, true, `${br.jumperConnectionId} vertex crossing`);
  }
});

test("E17-18 endpoint / junction neighborhood is not a safe bridge", () => {
  const pts = [
    { x: 0, y: 0 },
    { x: 0, y: 80 },
    { x: 160, y: 80 },
  ];
  assert.equal(
    isSafeBridgePlacement({ x: 0, y: 10 }, pts, {
      junctions: [{ x: 0, y: 80 }],
    }),
    false,
  );
  assert.equal(
    isSafeBridgePlacement({ x: 80, y: 80 }, pts, {
      junctions: [{ x: 82, y: 80 }],
    }),
    false,
  );
});

test("E20 reroute prefers a longer path over piercing a card", () => {
  const source = card("a", 0, 80);
  const target = card("b", 300, 80);
  const wall = card("wall", 120, 40, 80, 120);
  const through = [
    { x: 80, y: 100 },
    { x: 300, y: 100 },
  ];
  assert.equal(
    polylineViolatesKeepOuts(
      through,
      [wall].map(cardObstacle),
      new Set(["a", "b"]),
    ),
    true,
  );
  const best = selectBestOrthogonalRoute({
    source: cardObstacle(source),
    target: cardObstacle(target),
    sourceEdge: "right",
    targetEdge: "left",
    obstacles: [source, wall, target].map(cardObstacle),
  })!;
  assert.equal(
    polylineViolatesKeepOuts(
      best,
      [source, wall, target].map(cardObstacle),
      new Set(["a", "b"]),
    ),
    false,
  );
});

test("F21-23 individual Knowledge / standard fan / negative fan stay continuous", () => {
  const s = scene();
  const cases = [
    ["sk_disease", 50, 40, "skc1"],
    ["sk_patho_core", 340, 70, "skc2"],
    ["sk_negative", 430, 280, "skc12"],
  ] as const;
  for (const [id, x, y, connId] of cases) {
    const moved = applyCardPositionToGraph(s.graph, id, x, y);
    const next = regen(s, moved.cards);
    const route = next.routes.find((r) => r.connectionId === connId);
    assert.ok(route, connId);
    const c = polylineContinuity(route!.points);
    assert.equal(c.continuous, true, connId);
    assert.equal(c.orthogonal, true, connId);
    assert.deepEqual(
      topologyMembershipSnapshot(next).routes.find((r) => r.connectionId === connId),
      topologyMembershipSnapshot(s.topology).routes.find((r) => r.connectionId === connId),
    );
  }
});

test("F24 group drag applies one final delta to cards and topology", () => {
  const s = scene();
  const dx = 22;
  const dy = -6;
  const g2 = applyKnowledgeGroupDelta(s.graph, dx, dy);
  const t2 = translateKnowledgeTopology(
    s.topology,
    s.graph.connections,
    s.graph.cards,
    dx,
    dy,
  );
  const bp0 = s.topology.branchPoints.find((b) => b.id === "bp_positive")!;
  const bp1 = t2.branchPoints.find((b) => b.id === "bp_positive")!;
  assert.equal(bp1.x, bp0.x + dx);
  assert.equal(bp1.y, bp0.y + dy);
  const card0 = s.graph.cards.find((c) => c.id === "sk_positive")!;
  const card1 = g2.cards.find((c) => c.id === "sk_positive")!;
  assert.equal(card1.layout.x, card0.layout.x + dx);
  assert.equal(card1.layout.y, card0.layout.y + dy);
});

test("keep-out inflation matches CARD_ROUTE_CLEARANCE", () => {
  const box = keepOutRect({ x: 10, y: 20, width: 40, height: 30 });
  assert.equal(box.x, 10 - CARD_ROUTE_CLEARANCE);
  assert.equal(box.width, 40 + CARD_ROUTE_CLEARANCE * 2);
  assert.ok(MIN_ENDPOINT_STUB >= 18 && MIN_ENDPOINT_STUB <= 24);
  assert.ok(MIN_ARROW_APPROACH >= 20);
  assert.ok(BRANCH_EXIT_SPACING >= 16);
});

test("validator accepts legal 1:1 and auto-route; rejects pierce", () => {
  const source = card("a", 0, 80);
  const target = card("b", 280, 80);
  const wall = card("wall", 110, 50, 80, 100);
  const legal = selectBestOrthogonalRoute({
    source: cardObstacle(source),
    target: cardObstacle(target),
    sourceEdge: "right",
    targetEdge: "left",
    obstacles: [source, wall, target].map(cardObstacle),
  });
  assert.ok(legal);
  const sourcePin = { x: 80, y: 100 };
  const targetPin = { x: 280, y: 100 };
  assert.equal(
    validateOrthogonalRoute({
      points: legal!,
      sourcePin,
      targetPin,
      obstacles: [source, wall, target].map(cardObstacle),
      sourceCardId: "a",
      targetCardId: "b",
      clearance: 0,
    }).ok,
    true,
  );
  const through = [
    { x: 80, y: 100 },
    { x: 280, y: 100 },
  ];
  const rejected = validateOrthogonalRoute({
    points: through,
    sourcePin,
    targetPin,
    obstacles: [source, wall, target].map(cardObstacle),
    sourceCardId: "a",
    targetCardId: "b",
    clearance: 0,
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.reasons.includes("obstacle-violation"));
});

test("source/target cards are solid except the endpoint corridor; unrelated cards stay solid", () => {
  const source = card("a", 0, 80);
  const target = card("b", 200, 80);
  const through = [
    { x: 80, y: 100 },
    { x: 200, y: 100 },
  ];
  const onlyEnds = validateOrthogonalRoute({
    points: through,
    sourcePin: through[0]!,
    targetPin: through[1]!,
    obstacles: [source, target].map(cardObstacle),
    sourceCardId: "a",
    targetCardId: "b",
    clearance: 0,
  });
  assert.equal(onlyEnds.ok, true);
  const withWall = validateOrthogonalRoute({
    points: through,
    sourcePin: through[0]!,
    targetPin: through[1]!,
    obstacles: [source, target, card("wall", 110, 50, 80, 100)].map(cardObstacle),
    sourceCardId: "a",
    targetCardId: "b",
    clearance: 0,
  });
  assert.equal(withWall.ok, false);
});

test("authored fan that pierces is not accepted as a normal route", () => {
  const cards = [
    card("src", 0, 80),
    card("dst", 280, 80),
    card("wall", 110, 50, 80, 100),
  ];
  const piercing = [
    { x: 80, y: 100 },
    { x: 280, y: 100 },
  ];
  const plan = planOrthogonalRoutes(
    cards,
    [
      {
        id: "fan1",
        sourceCardId: "src",
        targetCardId: "dst",
        relationType: "current",
        origin: "student_diagram",
        createdAt: "2026-09-11T00:00:00.000Z",
        updatedAt: "2026-09-11T00:00:00.000Z",
      },
    ],
    {
      topology: {
        schema: ROUTE_TOPOLOGY_SCHEMA,
        routeGroups: [
          {
            id: "g1",
            sourceCardId: "src",
            trunkId: "t1",
            connectionIds: ["fan1"],
          },
        ],
        trunks: [
          {
            id: "t1",
            branchPointId: "bp1",
            connectionIds: ["fan1"],
            points: piercing,
          },
        ],
        branchPoints: [{ id: "bp1", x: 180, y: 100, connectionIds: ["fan1"] }],
        routes: [
          {
            connectionId: "fan1",
            sourceEdge: "right",
            targetEdge: "left",
            points: piercing,
          },
        ],
      },
    },
  );
  const accepted = plan.routes.find((r) => r.connectionId === "fan1");
  if (accepted) {
    assert.equal(
      polylineViolatesKeepOuts(
        accepted.points,
        cards.map(cardObstacle),
        new Set(["src", "dst"]),
        0,
      ),
      false,
    );
  } else {
    const invalid = plan.invalidRoutes.find((r) => r.connectionId === "fan1");
    assert.ok(invalid);
    assert.ok(invalid!.reasons.includes("obstacle-violation") || invalid!.reasons.includes("no-legal-route"));
  }
  assert.equal(
    plan.bridges.some((b) => b.jumperConnectionId === "fan1" && accepted == null),
    false,
  );
});

test("invalid routes are excluded from bridge classification", () => {
  const cards = [
    card("h1", 0, 80),
    card("h2", 260, 80),
    card("v1", 110, 0),
    card("v2", 110, 180),
    card("wall", 40, 70, 40, 60),
  ];
  const plan = planOrthogonalRoutes(cards, [
    {
      id: "aa_h",
      sourceCardId: "h1",
      targetCardId: "h2",
      relationType: "current",
      origin: "student_diagram",
      createdAt: "2026-09-11T00:00:00.000Z",
      updatedAt: "2026-09-11T00:00:00.000Z",
    },
    {
      id: "zz_v",
      sourceCardId: "v1",
      targetCardId: "v2",
      relationType: "current",
      origin: "student_diagram",
      createdAt: "2026-09-11T00:00:00.000Z",
      updatedAt: "2026-09-11T00:00:00.000Z",
    },
  ]);
  const classifiedIds = new Set([
    ...plan.bridges.map((b) => b.jumperConnectionId),
    ...plan.bridges.map((b) => b.underConnectionId),
  ]);
  for (const id of classifiedIds) {
    assert.ok(plan.routes.some((r) => r.connectionId === id));
    assert.equal(plan.invalidRoutes.some((r) => r.connectionId === id), false);
  }
});

test("live Knowledge drop endpoints match current card pins", () => {
  const s = scene();
  const moved = applyCardPositionToGraph(s.graph, "sk_disease", 50, 40);
  const next = regen(s, moved.cards);
  const plan = planOrthogonalRoutes(moved.cards, moved.connections, {
    canvas: { x: 0, y: 0, width: A3_WIDTH_PX, height: A3_HEIGHT_PX },
    topology: next,
  });
  const route = plan.routes.find((r) => r.connectionId === "skc1");
  assert.ok(route);
  const src = moved.cards.find((c) => c.id === "sk_disease")!;
  const tgt = moved.cards.find((c) => c.id === "sk_patho_core")!;
  assert.equal(route!.points[0]!.x, src.layout.x + src.layout.width);
  assert.equal(route!.points[0]!.y, src.layout.y + src.layout.height / 2);
  assert.equal(route!.points[route!.points.length - 1]!.x, tgt.layout.x);
  assert.equal(
    route!.points[route!.points.length - 1]!.y,
    tgt.layout.y + tgt.layout.height / 2,
  );
});

test("recapture after group translate does not snap back to fixture rail", () => {
  const s = scene();
  const dx = 40;
  const g2 = applyKnowledgeGroupDelta(s.graph, dx, 0);
  const t2 = translateKnowledgeTopology(
    s.topology,
    s.graph.connections,
    s.graph.cards,
    dx,
    0,
  );
  const params2 = captureTopologyGeometryParams(
    t2,
    g2.cards,
    g2.connections,
  );
  const next = regenerateExplicitTopologyGeometry({
    topology: t2,
    cards: g2.cards,
    connections: g2.connections,
    geometryParams: params2,
  });
  const trunk = next.trunks.find((t) => t.id === "tr_negative")!;
  const railX = Math.min(...trunk.points.map((p) => p.x));
  assert.ok(railX > 40, `rail should stay translated, got ${railX}`);
});

console.log(`\n${passed} passed`);
