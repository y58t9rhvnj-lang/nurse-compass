/**
 * Orthogonal routing + crossing bridge tests.
 * Run: npx tsx lib/v2/relatedDiagram/orthogonalRouting.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
} from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import { resolveConnectionStrokeVisual } from "./visualStyle";
import {
  buildOrthogonalHopArcs,
  buildOrthogonalPathD,
  buildOrthogonalSpineD,
  chooseCardEdges,
  classifyRouteInteractions,
  collectRouteJunctions,
  countBends,
  detectCrossings,
  edgeMidpoint,
  isColinearOverlap,
  isOrthogonalPolyline,
  BRIDGE_HEIGHT_PX,
  BRIDGE_MIN_VISIBLE_RADIUS_PX,
  BRIDGE_RADIUS_PX,
  BRIDGE_WIDTH_PX,
  dedupeBridgesForVisual,
  hopRadiusForSegment,
  analyzeRouteMeetings,
  planOrthogonalRoutes,
  polylineHitsObstacles,
  properSegmentCrossing,
  type RoutedConnection,
} from "./orthogonalRouting";
import {
  ROUTE_TOPOLOGY_SCHEMA,
  type RelatedDiagramRouteTopology,
} from "./routeTopology";

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

function conn(
  id: string,
  source: string,
  target: string,
  relationType: RelatedDiagramConnection["relationType"] = "current",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId: source,
    targetCardId: target,
    relationType,
    origin: "student_diagram",
    createdAt: "2026-09-11T00:00:00.000Z",
    updatedAt: "2026-09-11T00:00:00.000Z",
  };
}

function routeOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  id: string,
) {
  const plan = planOrthogonalRoutes(cards, connections);
  const route = plan.routes.find((r) => r.connectionId === id);
  assert.ok(route, `missing route ${id}`);
  return { plan, route: route! };
}

test("1. horizontal connection", () => {
  const cards = [card("a", 0, 40), card("b", 200, 40)];
  const { route } = routeOf(cards, [conn("c1", "a", "b")], "c1");
  assert.equal(route.sourceEdge, "right");
  assert.equal(route.targetEdge, "left");
  assert.ok(route.points.every((p) => Math.abs(p.y - route.points[0]!.y) < 8 || isOrthogonalPolyline(route.points)));
  assert.ok(isOrthogonalPolyline(route.points));
  assert.equal(countBends(route.points), 0);
});

test("2. vertical connection", () => {
  const cards = [card("a", 40, 0), card("b", 40, 180)];
  const { route } = routeOf(cards, [conn("c1", "a", "b")], "c1");
  assert.equal(route.sourceEdge, "bottom");
  assert.equal(route.targetEdge, "top");
  assert.ok(isOrthogonalPolyline(route.points));
  assert.equal(countBends(route.points), 0);
});

test("3. diagonal-position cards → orthogonal path", () => {
  const cards = [card("a", 0, 0), card("b", 220, 160)];
  const { route } = routeOf(cards, [conn("c1", "a", "b")], "c1");
  assert.ok(isOrthogonalPolyline(route.points));
  assert.ok(countBends(route.points) >= 1);
});

test("4. path has no diagonal segments", () => {
  const cards = [
    card("a", 10, 10),
    card("b", 240, 180),
    card("c", 80, 260),
  ];
  const plan = planOrthogonalRoutes(cards, [
    conn("c1", "a", "b"),
    conn("c2", "b", "c"),
  ]);
  for (const r of plan.routes) {
    assert.ok(isOrthogonalPolyline(r.points), r.connectionId);
  }
});

test("5. Card edge attachment (not center-to-center)", () => {
  const a = card("a", 0, 40);
  const b = card("b", 200, 40);
  const { route } = routeOf([a, b], [conn("c1", "a", "b")], "c1");
  const start = route.points[0]!;
  const end = route.points[route.points.length - 1]!;
  const srcEdge = edgeMidpoint(a.layout, route.sourceEdge);
  const tgtEdge = edgeMidpoint(b.layout, route.targetEdge);
  assert.ok(Math.abs(start.x - srcEdge.x) < 0.6);
  assert.ok(Math.abs(start.y - srcEdge.y) < 0.6);
  assert.ok(Math.abs(end.x - tgtEdge.x) < 0.6);
  assert.ok(Math.abs(end.y - tgtEdge.y) < 0.6);
  const ac = { x: a.layout.x + 40, y: a.layout.y + 20 };
  assert.ok(Math.abs(start.x - ac.x) > 10 || Math.abs(start.y - ac.y) > 10);
});

test("6. route does not pass through unrelated card interior", () => {
  const cards = [
    card("a", 0, 80),
    card("b", 280, 80),
    card("wall", 110, 50, 80, 100),
  ];
  const { route } = routeOf(cards, [conn("c1", "a", "b")], "c1");
  assert.equal(
    polylineHitsObstacles(
      route.points,
      cards.map((c) => ({ id: c.id, ...c.layout })),
      new Set(["a", "b"]),
      8,
    ),
    false,
  );
});

test("7. 90° bend on diagonal pair", () => {
  const cards = [card("a", 0, 0), card("b", 200, 140)];
  const { route } = routeOf(cards, [conn("c1", "a", "b")], "c1");
  assert.ok(countBends(route.points) >= 1);
  assert.ok(isOrthogonalPolyline(route.points));
});

test("8. wrap-around route when L-path is blocked", () => {
  const cards = [
    card("a", 0, 80),
    card("b", 280, 80),
    card("wall", 110, 50, 80, 100),
  ];
  const { route } = routeOf(cards, [conn("c1", "a", "b")], "c1");
  const ys = route.points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  assert.ok(
    minY < 50 || maxY > 150,
    "expected detour above or below the wall",
  );
  assert.ok(countBends(route.points) >= 2);
});

test("9. connection crossing detection", () => {
  const hit = properSegmentCrossing(
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 40, y: 0 },
    { x: 40, y: 90 },
  );
  assert.ok(hit);
  assert.equal(hit!.x, 40);
  assert.equal(hit!.y, 50);
  const t = properSegmentCrossing(
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 0, y: 0 },
    { x: 0, y: 90 },
  );
  assert.equal(t, null);
});

test("10. crossing → bridge", () => {
  const cards = [
    card("h1", 0, 80),
    card("h2", 260, 80),
    card("v1", 110, 0),
    card("v2", 110, 180),
  ];
  const plan = planOrthogonalRoutes(cards, [
    conn("aa_h", "h1", "h2"),
    conn("zz_v", "v1", "v2"),
  ]);
  assert.ok(plan.bridges.length >= 1);
  assert.ok(plan.bridges.every((b) => b.jumperConnectionId && b.underConnectionId));
  const d = buildOrthogonalPathD(
    plan.routes.find((r) => r.connectionId === plan.bridges[0]!.jumperConnectionId)!
      .points,
    plan.bridges.filter(
      (b) => b.jumperConnectionId === plan.bridges[0]!.jumperConnectionId,
    ),
  );
  assert.ok(d.includes("A "), "jumper path should contain an arc");
});

test("11. crossing is not a junction (no node/dot)", () => {
  const layer = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(layer.includes("circle"), false);
  assert.equal(layer.includes("junction"), false);
  assert.equal(layer.includes("data-rd-junction"), false);
  assert.equal(layer.includes("data-rd-bridge-knockout"), false);
  assert.equal(layer.includes("buildBridgeKnockouts"), false);
  assert.ok(layer.includes("data-rd-bridge-arc"));
  assert.ok(layer.includes("buildOrthogonalHopArcs"));
  assert.ok(layer.includes("buildOrthogonalSpineD"));
  assert.equal(layer.includes("#0A5FCC"), false);
  assert.equal(layer.includes("doubleLine"), false);
  assert.equal(layer.includes("rd-arrow-double"), false);
  assert.equal(layer.includes("data-rd-integration-mark"), false);
});

test("12. deterministic bridge assignment", () => {
  const cards = [
    card("h1", 0, 80),
    card("h2", 260, 80),
    card("v1", 110, 0),
    card("v2", 110, 180),
  ];
  const conns = [conn("aa_h", "h1", "h2"), conn("zz_v", "v1", "v2")];
  const a = detectCrossings(planOrthogonalRoutes(cards, conns).routes);
  const b = detectCrossings(planOrthogonalRoutes(cards, [...conns].reverse()).routes);
  assert.deepEqual(
    a.map((x) => `${x.jumperConnectionId}>${x.underConnectionId}`).sort(),
    b.map((x) => `${x.jumperConnectionId}>${x.underConnectionId}`).sort(),
  );
  assert.ok(a.length >= 1);
  assert.ok(a.every((x) => x.jumperConnectionId > x.underConnectionId));
});

test("13-17. routing keeps source/target; styles stay semantic", () => {
  const cards = [card("a", 0, 0), card("b", 200, 140)];
  for (const rel of [
    "current",
    "potential",
    "treatment",
    "nursing_problem_basis",
    "nursing_problem_integration",
  ] as const) {
    const { route } = routeOf(cards, [conn("c1", "a", "b", rel)], "c1");
    assert.equal(route.sourceCardId, "a");
    assert.equal(route.targetCardId, "b");
    const visual = resolveConnectionStrokeVisual(rel);
    if (rel === "potential") assert.ok(visual.dasharray);
    if (rel === "treatment") assert.ok(visual.strokeWidthPx >= 3);
    if (rel === "nursing_problem_basis" || rel === "nursing_problem_integration") {
      assert.equal(visual.dasharray, null);
      assert.equal(visual.marker, "arrow");
      assert.equal(visual.strokeWidthPx, 1.5);
    }
    if (rel === "current") assert.equal(visual.dasharray, null);
  }
});

function manualRoute(
  id: string,
  source: string,
  target: string,
  points: { x: number; y: number }[],
): RoutedConnection {
  return {
    connectionId: id,
    sourceCardId: source,
    targetCardId: target,
    sourceEdge: "right",
    targetEdge: "left",
    points,
  };
}

function crossingPairCards() {
  return [
    card("h1", 0, 80),
    card("h2", 260, 80),
    card("v1", 110, 0),
    card("v2", 110, 180),
  ];
}

test("B1. horizontal × vertical → bridge", () => {
  const hit = properSegmentCrossing(
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 40, y: 0 },
    { x: 40, y: 90 },
  );
  assert.ok(hit);
  const plan = planOrthogonalRoutes(crossingPairCards(), [
    conn("aa_h", "h1", "h2"),
    conn("zz_v", "v1", "v2"),
  ]);
  assert.ok(plan.bridges.length >= 1);
  assert.ok(plan.bridges.some((b) => b.jumperAxis === "v" || b.jumperAxis === "h"));
});

test("B2. vertical × horizontal → bridge (order reversed)", () => {
  const hit = properSegmentCrossing(
    { x: 40, y: 0 },
    { x: 40, y: 90 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
  );
  assert.ok(hit);
  const plan = planOrthogonalRoutes(crossingPairCards(), [
    conn("zz_h", "h1", "h2"),
    conn("aa_v", "v1", "v2"),
  ]);
  assert.ok(plan.bridges.length >= 1);
});

test("B3. one connection with multiple crossings → all bridges", () => {
  const cards = [
    card("h1", 0, 80),
    card("h2", 480, 80),
    card("v1a", 160, 0),
    card("v1b", 160, 200),
    card("v2a", 320, 0),
    card("v2b", 320, 200),
  ];
  const plan = planOrthogonalRoutes(cards, [
    conn("aa_v1", "v1a", "v1b"),
    conn("aa_v2", "v2a", "v2b"),
    conn("zz_h", "h1", "h2"),
  ]);
  const onH = plan.bridges.filter((b) => b.jumperConnectionId === "zz_h");
  assert.equal(onH.length, 2);
  const xs = onH.map((b) => b.x).sort((a, b) => a - b);
  assert.ok(xs[1]! - xs[0]! > 80);
  const d = buildOrthogonalPathD(
    plan.routes.find((r) => r.connectionId === "zz_h")!.points,
    onH,
  );
  const arcs = d.match(/A /g) ?? [];
  assert.equal(arcs.length, 2);
});

test("B4. connection order reversed stays deterministic", () => {
  const cards = crossingPairCards();
  const forward = [conn("aa_h", "h1", "h2"), conn("zz_v", "v1", "v2")];
  const a = detectCrossings(planOrthogonalRoutes(cards, forward).routes, cards);
  const b = detectCrossings(
    planOrthogonalRoutes(cards, [...forward].reverse()).routes,
    cards,
  );
  assert.deepEqual(
    a.map((x) => `${x.jumperConnectionId}@${x.x.toFixed(1)},${x.y.toFixed(1)}`).sort(),
    b.map((x) => `${x.jumperConnectionId}@${x.x.toFixed(1)},${x.y.toFixed(1)}`).sort(),
  );
  assert.ok(a.every((x) => x.jumperConnectionId > x.underConnectionId));
});

test("B5. card-edge attachment is not a bridge", () => {
  const cards = [
    card("left", 0, 80),
    card("hub", 200, 80),
    card("down", 200, 200),
  ];
  const plan = planOrthogonalRoutes(cards, [
    conn("c_h", "left", "hub"),
    conn("c_v", "down", "hub"),
  ]);
  assert.equal(plan.bridges.length, 0);
});

test("B6. segment endpoint touch is not a bridge", () => {
  assert.equal(
    properSegmentCrossing(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 0 },
      { x: 100, y: 90 },
    ),
    null,
  );
});

test("B7. same-line overlap is not a bridge", () => {
  assert.equal(
    isColinearOverlap(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 40, y: 50 },
      { x: 140, y: 50 },
    ),
    true,
  );
  assert.equal(
    properSegmentCrossing(
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 40, y: 50 },
      { x: 140, y: 50 },
    ),
    null,
  );
});

test("B8. dashed × solid still bridges", () => {
  const plan = planOrthogonalRoutes(crossingPairCards(), [
    conn("aa_h", "h1", "h2", "potential"),
    conn("zz_v", "v1", "v2", "current"),
  ]);
  assert.ok(plan.bridges.length >= 1);
  const visual = resolveConnectionStrokeVisual("potential");
  assert.ok(visual.dasharray);
});

test("B9. thick × solid still bridges", () => {
  const plan = planOrthogonalRoutes(crossingPairCards(), [
    conn("aa_h", "h1", "h2", "treatment"),
    conn("zz_v", "v1", "v2", "current"),
  ]);
  assert.ok(plan.bridges.length >= 1);
  assert.ok(resolveConnectionStrokeVisual("treatment").strokeWidthPx >= 3);
});

test("B10. NP basis uses the common classifier and still bridges", () => {
  const plan = planOrthogonalRoutes(crossingPairCards(), [
    conn("aa_v", "v1", "v2", "current"),
    conn("zz_h", "h1", "h2", "nursing_problem_basis"),
  ]);
  assert.ok(plan.bridges.length >= 1);
  const jumperId = plan.bridges[0]!.jumperConnectionId;
  const jumper = plan.routes.find((r) => r.connectionId === jumperId)!;
  const own = plan.bridges.filter((b) => b.jumperConnectionId === jumperId);
  assert.ok(buildOrthogonalPathD(jumper.points, own).includes("A "));
  const visual = resolveConnectionStrokeVisual("nursing_problem_basis");
  assert.equal(visual.dasharray, null);
  assert.equal(visual.marker, "arrow");
});

test("B11. routed segments stay orthogonal", () => {
  const cards = [
    card("a", 10, 10),
    card("b", 240, 180),
    card("c", 80, 260),
    card("d", 400, 40),
  ];
  const plan = planOrthogonalRoutes(cards, [
    conn("c1", "a", "b"),
    conn("c2", "b", "c"),
    conn("c3", "a", "d"),
  ]);
  for (const r of plan.routes) {
    assert.ok(isOrthogonalPolyline(r.points), r.connectionId);
  }
});

test("B-visual. hop is a true semicircle, not a fold or knockout", () => {
  assert.ok(BRIDGE_WIDTH_PX >= 18 && BRIDGE_WIDTH_PX <= 24);
  assert.ok(BRIDGE_HEIGHT_PX >= 8 && BRIDGE_HEIGHT_PX <= 12);
  assert.equal(BRIDGE_WIDTH_PX, BRIDGE_RADIUS_PX * 2);
  assert.equal(BRIDGE_HEIGHT_PX, BRIDGE_RADIUS_PX);
  assert.ok(BRIDGE_MIN_VISIBLE_RADIUS_PX >= 8);
  const longHop = hopRadiusForSegment(200, BRIDGE_RADIUS_PX);
  assert.equal(longHop, BRIDGE_RADIUS_PX);
  const cards = crossingPairCards();
  const plan = planOrthogonalRoutes(cards, [
    conn("aa_h", "h1", "h2"),
    conn("zz_v", "v1", "v2"),
  ]);
  assert.ok(plan.bridges.length >= 1);
  const d = buildOrthogonalPathD(
    plan.routes.find((r) => r.connectionId === plan.bridges[0]!.jumperConnectionId)!
      .points,
    plan.bridges.filter(
      (b) => b.jumperConnectionId === plan.bridges[0]!.jumperConnectionId,
    ),
  );
  assert.ok(/A 10 10 0 0 [01] /.test(d));
});

test("B-visual. spine gaps the hop; overlay is a true semicircle", () => {
  const points = [
    { x: 0, y: 50 },
    { x: 120, y: 50 },
  ];
  const bridges = [
    {
      jumperConnectionId: "j",
      underConnectionId: "u",
      x: 60,
      y: 50,
      jumperAxis: "h" as const,
    },
  ];
  const spine = buildOrthogonalSpineD(points, bridges);
  assert.equal(spine.includes("A "), false);
  assert.ok(spine.includes("L 50 50"));
  assert.ok(spine.includes("M 70 50"));
  const arcs = buildOrthogonalHopArcs(points, bridges);
  assert.equal(arcs.length, 1);
  assert.match(arcs[0]!.d, /A 10 10 0 0 1 /);
  assert.equal(arcs[0]!.axis, "h");
});

test("B-visual. horizontal hop uses upward SVG semicircle (not a downward dent)", () => {
  const d = buildOrthogonalPathD(
    [
      { x: 0, y: 50 },
      { x: 120, y: 50 },
    ],
    [
      {
        jumperConnectionId: "j",
        underConnectionId: "u",
        x: 60,
        y: 50,
        jumperAxis: "h",
      },
    ],
  );
  assert.ok(d.includes("A "));
  assert.match(d, /A 10 10 0 0 1 /);
  assert.equal(d.includes("L 70 40"), false);
});

test("B-visual. hop near card edge / stub is skipped", () => {
  const d = buildOrthogonalPathD(
    [
      { x: 0, y: 50 },
      { x: 40, y: 50 },
    ],
    [
      {
        jumperConnectionId: "j",
        underConnectionId: "u",
        x: 8,
        y: 50,
        jumperAxis: "h",
      },
    ],
  );
  assert.equal(d.includes("A "), false);
});

test("B-visual. coincident hops collapse to one visual bridge", () => {
  const collapsed = dedupeBridgesForVisual([
    {
      jumperConnectionId: "aa",
      underConnectionId: "u",
      x: 10.2,
      y: 20.4,
      jumperAxis: "h",
    },
    {
      jumperConnectionId: "zz",
      underConnectionId: "u",
      x: 10.4,
      y: 20.1,
      jumperAxis: "h",
    },
  ]);
  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0]!.jumperConnectionId, "zz");
});

test("near-bend interior crossing is still a bridge", () => {
  const hit = properSegmentCrossing(
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 96, y: 10 },
    { x: 96, y: 90 },
  );
  assert.ok(hit);
  assert.equal(hit!.x, 96);
});

test("chooseCardEdges is deterministic", () => {
  const a = card("a", 0, 0);
  const b = card("b", 200, 140);
  assert.deepEqual(chooseCardEdges(a, b), chooseCardEdges(a, b));
});

test("empty graph schema still valid", () => {
  assert.equal(RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION, "1");
});

test("C1. unrelated H×V internal crossing → bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("aa_h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("zz_v", "v1", "v2", [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 1);
  assert.equal(classified.bridges[0]!.jumperConnectionId, "zz_v");
  assert.equal(classified.bridges[0]!.underConnectionId, "aa_h");
});

test("C2. unrelated V×H internal crossing → bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("aa_v", "v1", "v2", [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
    ]),
    manualRoute("zz_h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 1);
  assert.equal(classified.bridges[0]!.jumperConnectionId, "zz_h");
});

function explicitFanTopology(
  connectionIds: string[],
  branch: { x: number; y: number },
): RelatedDiagramRouteTopology {
  return {
    schema: ROUTE_TOPOLOGY_SCHEMA,
    trunks: [
      {
        id: "tr_fan",
        points: [
          { x: 0, y: branch.y },
          { x: branch.x, y: branch.y },
        ],
        connectionIds,
        branchPointId: "bp_fan",
      },
    ],
    branchPoints: [
      {
        id: "bp_fan",
        x: branch.x,
        y: branch.y,
        connectionIds,
      },
    ],
    routeGroups: [
      {
        id: "rg_fan",
        sourceCardId: "A",
        trunkId: "tr_fan",
        connectionIds,
      },
    ],
    routes: [],
  };
}

test("C3. T-join / overlapping trunk is not a proper H×V → no bridge", () => {
  const routes = [
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 10 },
      { x: 180, y: 10 },
    ]),
  ];
  const classified = classifyRouteInteractions(routes);
  assert.equal(classified.bridges.length, 0);
  assert.equal(classified.junctions.length, 0);
});

test("C4. explicit branch topology → junctions, no bridge", () => {
  const routes = [
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 10 },
      { x: 180, y: 10 },
    ]),
  ];
  const topology = explicitFanTopology(["a_c", "a_b"], { x: 100, y: 50 });
  const classified = classifyRouteInteractions(routes, [], topology);
  assert.equal(classified.bridges.length, 0);
  assert.ok(classified.junctions.some((j) => j.kind === "sharedTrunk"));
  assert.ok(
    classified.junctions.some(
      (j) => j.kind === "branchPoint" || j.kind === "junctionPoint",
    ),
  );
});

test("C5. T-junction → no bridge", () => {
  assert.equal(
    properSegmentCrossing(
      { x: 0, y: 50 },
      { x: 200, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 10 },
    ),
    null,
  );
  const classified = classifyRouteInteractions([
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 10 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("C6. explicit A→B/C/D fan → no bridge", () => {
  const routes = [
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 10 },
      { x: 160, y: 10 },
    ]),
    manualRoute("a_d", "A", "D", [
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 90 },
      { x: 160, y: 90 },
    ]),
  ];
  const topology = explicitFanTopology(["a_c", "a_b", "a_d"], { x: 80, y: 50 });
  const classified = classifyRouteInteractions(routes, [], topology);
  assert.equal(classified.bridges.length, 0);
  assert.ok(
    collectRouteJunctions(routes, topology).some(
      (j) => j.kind === "junctionPoint" || j.kind === "sharedTrunk",
    ),
  );
});

test("C7. same source after split accidental crossing → bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 80 },
      { x: 220, y: 80 },
    ]),
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 200, y: 40 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 1);
  assert.equal(classified.bridges[0]!.x, 120);
  assert.equal(classified.bridges[0]!.y, 40);
});

test("C8. endpoint touch → no bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]),
    manualRoute("v", "v1", "v2", [
      { x: 100, y: 0 },
      { x: 100, y: 90 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("C9. Card edge connection → no bridge", () => {
  const cards = [
    card("left", 0, 80),
    card("hub", 200, 80),
    card("down", 200, 200),
  ];
  const plan = planOrthogonalRoutes(cards, [
    conn("c_h", "left", "hub"),
    conn("c_v", "down", "hub"),
  ]);
  assert.equal(plan.bridges.length, 0);
});

test("C10. same Connection bend → no bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("only", "A", "B", [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 80 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("C11. collinear overlap → no bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("h1", "a", "b", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
    ]),
    manualRoute("h2", "c", "d", [
      { x: 40, y: 50 },
      { x: 140, y: 50 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("C12. multiple independent crossings → one bridge each", () => {
  const classified = classifyRouteInteractions([
    manualRoute("zz_h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 300, y: 50 },
    ]),
    manualRoute("aa_v1", "v1a", "v1b", [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
    ]),
    manualRoute("aa_v2", "v2a", "v2b", [
      { x: 200, y: 0 },
      { x: 200, y: 100 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 2);
  assert.ok(classified.bridges.every((b) => b.jumperConnectionId === "zz_h"));
  const d = buildOrthogonalPathD(
    [
      { x: 0, y: 50 },
      { x: 300, y: 50 },
    ],
    classified.bridges.filter((b) => b.jumperConnectionId === "zz_h"),
  );
  assert.equal((d.match(/A /g) ?? []).length, 2);
});

test("C13. deterministic jumper for same graph", () => {
  const routes = [
    manualRoute("aa_h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("zz_v", "v1", "v2", [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
    ]),
  ];
  const a = detectCrossings(routes);
  const b = detectCrossings([...routes].reverse());
  assert.deepEqual(
    a.map((x) => `${x.jumperConnectionId}>${x.underConnectionId}`),
    b.map((x) => `${x.jumperConnectionId}>${x.underConnectionId}`),
  );
  assert.ok(a.every((x) => x.jumperConnectionId > x.underConnectionId));
});

test("C14. independent crossing count matches hop count", () => {
  const classified = classifyRouteInteractions([
    manualRoute("aa_h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("zz_v", "v1", "v2", [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
    ]),
  ]);
  const visual = dedupeBridgesForVisual(classified.bridges);
  assert.equal(visual.length, classified.bridges.length);
  const jumper = classified.bridges[0]!.jumperConnectionId;
  const pts =
    jumper === "zz_v"
      ? [
          { x: 80, y: 0 },
          { x: 80, y: 100 },
        ]
      : [
          { x: 0, y: 50 },
          { x: 200, y: 50 },
        ];
  const d = buildOrthogonalPathD(
    pts,
    visual.filter((b) => b.jumperConnectionId === jumper),
  );
  assert.equal((d.match(/A /g) ?? []).length, visual.length);
});

test("D1. vertex T-join is not a proper H×V crossing → no bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("ab", "A", "B", [
      { x: 0, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 100 },
    ]),
    manualRoute("cd", "C", "D", [
      { x: 20, y: 20 },
      { x: 200, y: 20 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("D2. unrelated H×V near a bend → bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("ab", "A", "B", [
      { x: 0, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 100 },
    ]),
    manualRoute("cd", "C", "D", [
      { x: 20, y: 60 },
      { x: 200, y: 60 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 1);
  assert.equal(classified.bridges[0]!.x, 80);
  assert.equal(classified.bridges[0]!.y, 60);
});

test("D3. intentional shared branch → no bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 10 },
    ]),
    manualRoute("a_d", "A", "D", [
      { x: 0, y: 50 },
      { x: 80, y: 50 },
      { x: 80, y: 90 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("D4. same source shared branch → no bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 10 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 0);
});

test("D5. same source after routes split → bridge", () => {
  const classified = classifyRouteInteractions([
    manualRoute("a_b", "A", "B", [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 80 },
      { x: 220, y: 80 },
    ]),
    manualRoute("a_c", "A", "C", [
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 200, y: 40 },
    ]),
  ]);
  assert.equal(classified.bridges.length, 1);
});

test("D7. analyze counts: independent === bridges", () => {
  const routes = [
    manualRoute("aa_h", "h1", "h2", [
      { x: 0, y: 50 },
      { x: 200, y: 50 },
    ]),
    manualRoute("zz_v", "v1", "v2", [
      { x: 80, y: 0 },
      { x: 80, y: 100 },
    ]),
    manualRoute("ab", "A", "B", [
      { x: 0, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 100 },
    ]),
    manualRoute("cd", "C", "D", [
      { x: 20, y: 20 },
      { x: 200, y: 20 },
    ]),
  ];
  const analyzed = analyzeRouteMeetings(routes);
  assert.equal(analyzed.independentCrossingCount, analyzed.bridgeCount);
  assert.equal(analyzed.bridges.length, analyzed.bridgeCount);
});

console.log(`\n${passed} passed`);
