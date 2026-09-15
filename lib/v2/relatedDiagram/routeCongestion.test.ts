/**
 * Complexity / congestion hardening tests.
 * Run: npx tsx lib/v2/relatedDiagram/routeCongestion.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  applySceneFragmentToGraph,
  captureSceneFragment,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import {
  polylineHitsExpandedLegend,
  selfCardPenetrationSegments,
  sourceExitCorridor,
  targetEntryCorridor,
} from "./geometryGuard";
import {
  applyIncrementalCardMove,
  bridgesDeepEqual,
  collectAffectedConnectionIds,
  pointsDeepEqual,
  seedStableRouteState,
} from "./incrementalRoutes";
import {
  crossingCost,
  exceedsReasonableDetour,
  MIN_PARALLEL_ROUTE_GAP,
  PREFERRED_MAX_CROSSINGS,
  ROUTE_SOFT_CLEARANCE,
  MAX_REASONABLE_DETOUR_RATIO,
  parallelGap,
  parallelPenalty,
  scoreCongestedRoute,
  secondaryEdgePair,
  sameGroupIds,
  simplifyTinyDoglegs,
  visibilityEdgeCongestionCost,
  type CongestionContext,
} from "./routeCongestion";
import { CARD_MIN_GAP, collidingCards, resolveCardDropCollision } from "./cardCollision";
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
  height = 48,
): RelatedDiagramCard {
  return {
    id,
    cardType: "information",
    text: id,
    state: null,
    origin: "patient_information",
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function emptyCtx(routes: CongestionContext["routes"], extra?: Partial<CongestionContext>): CongestionContext {
  return {
    routes,
    exemptIds: extra?.exemptIds ?? new Set(),
    bridges: extra?.bridges ?? [],
    junctions: extra?.junctions ?? [],
  };
}

test("Card hard obstacle and Legend hard obstacle stay in the guard", () => {
  const hardening = readFileSync(new URL("./routeHardening.ts", import.meta.url), "utf8");
  const guard = readFileSync(new URL("./geometryGuard.ts", import.meta.url), "utf8");
  assert.ok(hardening.includes("self-card-penetration"));
  assert.ok(hardening.includes("legend-violation"));
  assert.ok(guard.includes("LEGEND_ROUTE_CLEARANCE"));
  assert.equal(ROUTE_SOFT_CLEARANCE, 12);
});

test("unrelated exact overlap is penalized; shared trunk exemption is not", () => {
  const a = [
    { x: 0, y: 40 },
    { x: 200, y: 40 },
  ];
  const other = [{ connectionId: "o", points: a, groupId: "g2" }];
  const hit = parallelPenalty(a[0]!, a[1]!, emptyCtx(other));
  assert.ok(hit >= 400);
  const exempt = parallelPenalty(
    a[0]!,
    a[1]!,
    emptyCtx(other, { exemptIds: new Set(["o"]) }),
  );
  assert.equal(exempt, 0);
  assert.equal(sameGroupIds([{ id: "g1", connectionIds: ["a", "b"] }], "a").has("b"), true);
});

test("explicit shared trunk membership is exempt from soft overlap", () => {
  const trunk = [
    { x: 10, y: 80 },
    { x: 120, y: 80 },
  ];
  const ctx = emptyCtx(
    [{ connectionId: "child-b", points: trunk, groupId: "fan" }],
    { exemptIds: sameGroupIds([{ id: "fan", connectionIds: ["child-a", "child-b"] }], "child-a") },
  );
  assert.equal(parallelPenalty(trunk[0]!, trunk[1]!, ctx), 0);
});

test("0 crossing candidate scores better than a 1-crossing shortcut", () => {
  const wall = [
    { connectionId: "u", points: [{ x: 40, y: 0 }, { x: 40, y: 80 }] },
  ];
  const zero = [
    { x: 0, y: 100 },
    { x: 80, y: 100 },
  ];
  const one = [
    { x: 0, y: 40 },
    { x: 80, y: 40 },
  ];
  const ctx = emptyCtx(wall);
  const s0 = scoreCongestedRoute(zero, ctx);
  const s1 = scoreCongestedRoute(one, ctx);
  assert.equal(s0.crossings, 0);
  assert.equal(s1.crossings, 1);
  assert.ok(s0.score < s1.score);
});

test("1 crossing costs less than a huge extra length, 2+ is much worse", () => {
  assert.equal(crossingCost(0), 0);
  assert.equal(crossingCost(1), 320);
  assert.equal(crossingCost(2), 800);
  assert.ok(crossingCost(3) >= 1500);
  assert.ok(crossingCost(2) > crossingCost(1) * 2 - 1);
  assert.equal(PREFERRED_MAX_CROSSINGS, 1);
});

test("infeasible / endpoint / bend / junction / cluster crossings add cost", () => {
  const short = [
    { x: 0, y: 10 },
    { x: 24, y: 10 },
  ];
  const vertical = [{ connectionId: "v", points: [{ x: 12, y: 0 }, { x: 12, y: 20 }] }];
  const endpoint = visibilityEdgeCongestionCost(short[0]!, short[1]!, emptyCtx(vertical), {
    start: short[0]!,
    goal: short[1]!,
  });
  assert.ok(endpoint > 320);
  const long = [
    { x: 0, y: 40 },
    { x: 200, y: 40 },
  ];
  const nearJ = visibilityEdgeCongestionCost(
    long[0]!,
    long[1]!,
    emptyCtx([{ connectionId: "v", points: [{ x: 100, y: 0 }, { x: 100, y: 80 }] }], {
      junctions: [{ x: 100, y: 40 }],
    }),
  );
  const nearB = visibilityEdgeCongestionCost(
    long[0]!,
    long[1]!,
    emptyCtx([{ connectionId: "v", points: [{ x: 100, y: 0 }, { x: 100, y: 80 }] }], {
      bridges: [{ x: 100, y: 40 }],
    }),
  );
  assert.ok(nearJ > 320);
  assert.ok(nearB > 320);
  const bendish = visibilityEdgeCongestionCost(
    { x: 0, y: 40 },
    { x: 30, y: 40 },
    emptyCtx([{ connectionId: "v", points: [{ x: 8, y: 0 }, { x: 8, y: 80 }] }]),
  );
  assert.ok(bendish > 320);
});

test("parallel gap prefers at least MIN_PARALLEL_ROUTE_GAP", () => {
  assert.equal(MIN_PARALLEL_ROUTE_GAP, 14);
  const gap = parallelGap(
    { x: 0, y: 40 },
    { x: 100, y: 40 },
    { x: 20, y: 48 },
    { x: 80, y: 48 },
  );
  assert.equal(gap, 8);
  const pen = parallelPenalty(
    { x: 0, y: 40 },
    { x: 100, y: 40 },
    emptyCtx([{ connectionId: "o", points: [{ x: 20, y: 48 }, { x: 80, y: 48 }] }]),
  );
  assert.ok(pen > 0);
});

test("long detour guard trips above ratio 2.0", () => {
  assert.equal(MAX_REASONABLE_DETOUR_RATIO, 2);
  assert.equal(exceedsReasonableDetour(201, 100), true);
  assert.equal(exceedsReasonableDetour(199, 100), false);
});

test("secondary edge pair is the other axis", () => {
  assert.deepEqual(secondaryEdgePair({ sourceEdge: "right", targetEdge: "left" }), {
    sourceEdge: "bottom",
    targetEdge: "top",
  });
});

test("tiny dogleg simplification keeps pins", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 40, y: 0 },
    { x: 80, y: 0 },
    { x: 80, y: 6 },
    { x: 140, y: 6 },
    { x: 200, y: 6 },
    { x: 200, y: 40 },
  ];
  const next = simplifyTinyDoglegs(points);
  assert.deepEqual(next[0], points[0]);
  assert.deepEqual(next[next.length - 1], points[points.length - 1]);
  assert.ok(next.length <= points.length);
});

test("incremental move avoids stacking on an unrelated horizontal", () => {
  const a = card("a", 40, 176);
  const b = card("b", 520, 176);
  const m = card("m", 40, 400);
  const d = card("d", 520, 400);
  const graph = {
    schemaVersion: "1" as const,
    cards: [a, b, m, d],
    connections: [
      {
        id: "ab",
        sourceCardId: "a",
        targetCardId: "b",
        relationType: "current" as const,
        origin: "student_diagram" as const,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      },
      {
        id: "md",
        sourceCardId: "m",
        targetCardId: "d",
        relationType: "current" as const,
        origin: "student_diagram" as const,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      },
    ],
    sources: [],
    nursingProblems: [],
    integrations: [],
  };
  const seeded = seedStableRouteState(graph.cards, graph.connections);
  const next = applyCardPositionToGraph(graph, "d", 520, 248);
  const moved = applyIncrementalCardMove({
    previous: seeded,
    cards: next.cards,
    connections: next.connections,
    movedCardId: "d",
  });
  assert.deepEqual(moved.state.byId.ab!.points, seeded.byId.ab!.points);
  const ab = seeded.byId.ab!.points;
  const md = moved.state.byId.md!.points;
  let stacked = false;
  for (let i = 1; i < md.length; i++) {
    for (let j = 1; j < ab.length; j++) {
      const gap = parallelGap(md[i - 1]!, md[i]!, ab[j - 1]!, ab[j]!);
      if (gap != null && gap < 1) stacked = true;
    }
  }
  assert.equal(stacked, false);
  const src = next.cards.find((c) => c.id === "m")!;
  const tgt = next.cards.find((c) => c.id === "d")!;
  const route = moved.state.byId.md!;
  assert.equal(
    selfCardPenetrationSegments(
      route.points,
      src.layout,
      tgt.layout,
      sourceExitCorridor(src.id, route.sourcePin, route.sourceEdge),
      targetEntryCorridor(tgt.id, route.targetPin, route.targetEdge),
    ).length,
    0,
  );
  assert.equal(polylineHitsExpandedLegend(route.points), false);
});

test("fan child and unrelated routes stay stable", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "sk_hallucination",
    hall.layout.x,
    hall.layout.y - 20,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "sk_hallucination",
  });
  assert.deepEqual(moved.state.byId.skc10!.points, state.byId.skc10!.points);
  assert.deepEqual(moved.state.byId.skc11!.points, state.byId.skc11!.points);
  assert.deepEqual(moved.state.byId.demo_c_cur!.points, state.byId.demo_c_cur!.points);
  const beforeUnrelated = state.bridges.filter(
    (b) => b.jumperConnectionId !== "skc9" && b.underConnectionId !== "skc9",
  );
  const afterUnrelated = moved.state.bridges.filter(
    (b) => b.jumperConnectionId !== "skc9" && b.underConnectionId !== "skc9",
  );
  assert.equal(bridgesDeepEqual(beforeUnrelated, afterUnrelated), true);
});

test("Undo / Redo restore the pre-hardening fragment exactly", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const info = scene.graph.cards.find((c) => c.id === "demo_info")!;
  const next = applyCardPositionToGraph(
    scene.graph,
    "demo_info",
    info.layout.x + 28,
    info.layout.y - 16,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "demo_info",
  });
  const before = captureSceneFragment({
    cards: scene.graph.cards,
    cardIds: ["demo_info"],
    routeState: state,
    topology: scene.routeTopology,
  });
  const after = captureSceneFragment({
    cards: next.cards,
    cardIds: ["demo_info"],
    routeState: moved.state,
    topology: moved.topology ?? scene.routeTopology,
  });
  const history = pushDiagramHistory(emptyDiagramHistory(), {
    type: "moveCard",
    cardIds: ["demo_info"],
    before,
    after,
  });
  const undone = undoDiagramHistory(history);
  assert.ok(
    pointsDeepEqual(
      undone.fragment!.routeState.byId.demo_c_cur!.points,
      state.byId.demo_c_cur!.points,
    ),
  );
  const restored = applySceneFragmentToGraph(next, undone.fragment!);
  assert.equal(restored.cards.find((c) => c.id === "demo_info")!.layout.x, info.layout.x);
  const redone = redoDiagramHistory(undone.history);
  assert.ok(
    pointsDeepEqual(
      redone.fragment!.routeState.byId.demo_c_cur!.points,
      moved.state.byId.demo_c_cur!.points,
    ),
  );
});

test("unrelated deepEqual and collision still hold after a Knowledge move", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const state = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const hall = scene.graph.cards.find((c) => c.id === "sk_hallucination")!;
  const delusion = scene.graph.cards.find((c) => c.id === "sk_delusion")!;
  const resolved = resolveCardDropCollision({
    movingCard: hall,
    desiredPosition: { x: delusion.layout.x, y: delusion.layout.y },
    otherCards: scene.graph.cards.filter((c) => c.id !== hall.id),
    lastLegal: { x: hall.layout.x, y: hall.layout.y },
  });
  const next = applyCardPositionToGraph(
    scene.graph,
    "sk_hallucination",
    resolved.position.x,
    resolved.position.y,
  );
  const moved = applyIncrementalCardMove({
    previous: state,
    cards: next.cards,
    connections: next.connections,
    topology: scene.routeTopology,
    movedCardId: "sk_hallucination",
  });
  const affected = new Set(
    collectAffectedConnectionIds({
      movedCardId: "sk_hallucination",
      cards: next.cards,
      connections: next.connections,
      topology: scene.routeTopology,
      previous: state,
    }),
  );
  for (const id of Object.keys(state.byId)) {
    if (affected.has(id)) continue;
    assert.deepEqual(moved.state.byId[id]!.points, state.byId[id]!.points, id);
  }
  assert.equal(
    collidingCards(
      next.cards.find((c) => c.id === hall.id)!.layout,
      next.cards.filter((c) => c.id !== hall.id).map((c) => ({ id: c.id, ...c.layout })),
      CARD_MIN_GAP,
    ).length,
    0,
  );
});

test("debug overlay can show route-cost independently", () => {
  const overlay = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramRouteDebugOverlay.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const ws = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(overlay.includes("route-cost"));
  assert.ok(ws.includes("rdRouteCost"));
});

console.log(`\n${passed} passed`);
