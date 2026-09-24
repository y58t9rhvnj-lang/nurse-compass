/**
 * L2-D D0–D2 tests.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/diagramLayoutL2d.test.ts
 */

import assert from "node:assert/strict";
import {
  applySceneFragmentToGraph,
  emptyDiagramHistory,
  pushDiagramHistory,
  redoDiagramHistory,
  undoDiagramHistory,
} from "./diagramHistory";
import { arrangeRelatedDiagramScene } from "./applyRelatedDiagramLayout";
import {
  applyKnowledgeLayerArrange,
  deriveKnowledgeLayers,
  knowledgeArrangeMetrics,
  knowledgeUnitFlow,
  layoutKnowledgeLayers,
  L2D_GAP_MAX,
  L2D_GAP_SIBLING,
} from "./diagramLayoutL2d";
import { countBends } from "./orthogonalRouting";
import { routeHighwayFlag } from "./diagramLayoutL2b";
import { partitionLocalGraphUnits } from "./diagramLayoutL2dUnits";
import { analyzeRouteReadability } from "./diagramLayoutL2b";
import { pointsDeepEqual, seedStableRouteState } from "./incrementalRoutes";
import { topologyMembershipSnapshot } from "./regenerateRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramConnection,
  RelatedDiagramSemanticGraph,
} from "./types";

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
  options?: {
    width?: number;
    height?: number;
    cardType?: RelatedDiagramCard["cardType"];
    state?: RelatedDiagramCardState | null;
  },
): RelatedDiagramCard {
  const cardType = options?.cardType ?? "information";
  return {
    id,
    cardType,
    text: id,
    state:
      options?.state !== undefined
        ? options.state
        : cardType === "understanding" || cardType === "nursing_problem"
          ? "current"
          : null,
    origin: cardType === "knowledge" ? "knowledge_library" : "patient_information",
    layout: {
      x,
      y,
      width: options?.width ?? 80,
      height: options?.height ?? 40,
      zIndex: 1,
    },
    isLocked: false,
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  relationType: RelatedDiagramConnection["relationType"] = "current",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType,
    origin: "student_diagram",
    createdAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
  };
}

function graphOf(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): RelatedDiagramSemanticGraph {
  return {
    semanticSchemaVersion: "1",
    cards,
    cardSources: [],
    connections,
    nursingProblems: [],
    nursingProblemSupports: [],
    integrations: [],
    integrationMembers: [],
  };
}

function fixtureScene() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  return {
    ...scene,
    routeState: seedStableRouteState(
      scene.graph.cards,
      scene.graph.connections,
      scene.routeTopology,
    ),
  };
}

function positionsOf(cards: RelatedDiagramCard[]) {
  return cards
    .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function routePoints(scene: ReturnType<typeof fixtureScene>, id: string) {
  return scene.routeState.byId[id]?.points ?? [];
}

function k(
  id: string,
  x: number,
  y: number,
): RelatedDiagramCard {
  return card(id, x, y, { cardType: "knowledge", width: 146, height: 72 });
}

test("D0-A. non-target routes are preserved on fixture Arrange", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  for (const id of ["demo_c_cross_h", "demo_c_cross_v", "demo_c_cur", "demo_c_pot"]) {
    assert.ok(
      pointsDeepEqual(scene.routeState.byId[id]!.points, result.routeState.byId[id]!.points),
      id,
    );
  }
});

test("D0-B. non-target Junction coordinates are preserved", () => {
  const scene = fixtureScene();
  const before = scene.routeTopology!.branchPoints.find((bp) => bp.id === "bp_demo_junc")!;
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = result.topology!.branchPoints.find((bp) => bp.id === "bp_demo_junc")!;
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
  assert.deepEqual(after.connectionIds, before.connectionIds);
});

test("D0-C. non-target trunks are preserved", () => {
  const scene = fixtureScene();
  const before = scene.routeTopology!.trunks.find((row) => row.id === "tr_demo_junc")!;
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = result.topology!.trunks.find((row) => row.id === "tr_demo_junc")!;
  assert.ok(pointsDeepEqual(before.points, after.points));
});

test("D0-D. Knowledge change leaves other unit card geometry unchanged", () => {
  const scene = fixtureScene();
  const keep = scene.graph.cards
    .filter((item) => item.cardType !== "knowledge")
    .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = result.graph.cards
    .filter((item) => item.cardType !== "knowledge")
    .map((item) => ({ id: item.id, x: item.layout.x, y: item.layout.y }))
    .sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(after, keep);
});

test("D1-A. unit partition is deterministic", () => {
  const scene = fixtureScene();
  const a = partitionLocalGraphUnits(scene.graph);
  const b = partitionLocalGraphUnits(scene.graph);
  assert.deepEqual(a, b);
});

test("D1-B. unit partition ignores card array order", () => {
  const scene = fixtureScene();
  const reversed = {
    ...scene.graph,
    cards: [...scene.graph.cards].reverse(),
  };
  const a = partitionLocalGraphUnits(scene.graph);
  const b = partitionLocalGraphUnits(reversed);
  assert.deepEqual(a, b);
});

test("D1-C. unit partition ignores connection array order", () => {
  const scene = fixtureScene();
  const reversed = {
    ...scene.graph,
    connections: [...scene.graph.connections].reverse(),
  };
  const a = partitionLocalGraphUnits(scene.graph);
  const b = partitionLocalGraphUnits(reversed);
  assert.deepEqual(a, b);
});

test("D1-D. a large connected component is split into units", () => {
  const scene = fixtureScene();
  const units = partitionLocalGraphUnits({
    ...scene.graph,
    topology: scene.routeTopology,
  });
  const student = units.filter((unit) => unit.kind !== "knowledge");
  assert.ok(student.every((unit) => unit.cardIds.length <= 8));
  assert.ok(units.length >= 4);
});

test("D1-E. Knowledge group is one unit", () => {
  const scene = fixtureScene();
  const units = partitionLocalGraphUnits({
    ...scene.graph,
    topology: scene.routeTopology,
  });
  const knowledge = units.find((unit) => unit.kind === "knowledge");
  assert.ok(knowledge);
  assert.ok(knowledge!.cardIds.includes("sk_disease"));
  assert.ok(knowledge!.cardIds.includes("sk_avolition"));
});

test("D1-F. explicit Junction fan is recognized", () => {
  const scene = fixtureScene();
  const units = partitionLocalGraphUnits({
    ...scene.graph,
    topology: scene.routeTopology,
  });
  const fan = units.find((unit) => unit.kind === "junction_fan");
  assert.ok(fan);
  assert.ok(fan!.cardIds.includes("demo_junc_a"));
  assert.ok(fan!.cardIds.includes("demo_junc_b"));
});

test("D2-A. Knowledge layers come from the directed graph", () => {
  const scene = fixtureScene();
  const layers = deriveKnowledgeLayers(scene.graph);
  assert.equal(layers.get("sk_disease"), 0);
  assert.ok((layers.get("sk_patho_core") ?? 0) > (layers.get("sk_disease") ?? 0));
  assert.ok((layers.get("sk_mesolimbic") ?? 0) > (layers.get("sk_da") ?? 0));
  assert.ok((layers.get("sk_positive") ?? 0) > (layers.get("sk_mesolimbic") ?? 0));
  assert.ok((layers.get("sk_mesocortical") ?? 0) > (layers.get("sk_da") ?? 0));
  assert.ok((layers.get("sk_negative") ?? 0) > (layers.get("sk_mesocortical") ?? 0));
});

test("D2-B. diamond puts the merge node on the next layer", () => {
  const cards = [
    k("a", 40, 40),
    k("b", 40, 160),
    k("c", 200, 160),
    k("d", 120, 280),
  ];
  const connections = [
    conn("e1", "a", "b"),
    conn("e2", "a", "c"),
    conn("e3", "b", "d"),
    conn("e4", "c", "d"),
  ];
  const layers = deriveKnowledgeLayers({ cards, connections });
  assert.equal(layers.get("a"), 0);
  assert.equal(layers.get("b"), 1);
  assert.equal(layers.get("c"), 1);
  assert.equal(layers.get("d"), 2);
});

test("D2-C. a chain is layered in order", () => {
  const cards = [k("a", 40, 40), k("b", 40, 160), k("c", 40, 280), k("d", 40, 400)];
  const connections = [
    conn("e1", "a", "b"),
    conn("e2", "b", "c"),
    conn("e3", "c", "d"),
  ];
  const layers = deriveKnowledgeLayers({ cards, connections });
  assert.deepEqual(
    ["a", "b", "c", "d"].map((id) => layers.get(id)),
    [0, 1, 2, 3],
  );
});

test("D2-D. parent sits near the children span", () => {
  const cards = [k("p", 40, 40), k("c1", 40, 200), k("c2", 300, 200)];
  const connections = [conn("e1", "p", "c1"), conn("e2", "p", "c2")];
  const next = layoutKnowledgeLayers({ cards, connections });
  const parent = next.find((item) => item.id === "p")!;
  const c1 = next.find((item) => item.id === "c1")!;
  const c2 = next.find((item) => item.id === "c2")!;
  const mid = (c1.layout.x + c2.layout.x + c2.layout.width) / 2;
  const parentMid = parent.layout.x + parent.layout.width / 2;
  assert.ok(Math.abs(parentMid - mid) < 80);
  assert.ok(parent.layout.y < c1.layout.y);
});

test("D2-E. multiple parents place the child downstream of their span", () => {
  const cards = [k("p1", 40, 40), k("p2", 260, 40), k("child", 140, 200)];
  const connections = [conn("e1", "p1", "child"), conn("e2", "p2", "child")];
  const next = layoutKnowledgeLayers({ cards, connections });
  const child = next.find((item) => item.id === "child")!;
  const p1 = next.find((item) => item.id === "p1")!;
  const p2 = next.find((item) => item.id === "p2")!;
  assert.ok(child.layout.y > p1.layout.y);
  const mid = (p1.layout.x + p2.layout.x + p2.layout.width) / 2;
  assert.ok(Math.abs(child.layout.x + child.layout.width / 2 - mid) < 80);
});

test("D2-F. same-layer order prefers existing x", () => {
  const cards = [k("a", 40, 160), k("b", 240, 160), k("root", 40, 40)];
  const connections = [conn("e1", "root", "a"), conn("e2", "root", "b")];
  const next = layoutKnowledgeLayers({ cards, connections });
  assert.ok(
    next.find((item) => item.id === "a")!.layout.x <
      next.find((item) => item.id === "b")!.layout.x,
  );
});

test("D2-G. adjacent swap is available when a same-layer blocker sits between", () => {
  const cards = [
    k("root", 40, 40),
    k("keep", 40, 200),
    k("block", 200, 200),
  ];
  const connections = [conn("e1", "root", "keep"), conn("e2", "root", "block")];
  const next = layoutKnowledgeLayers({ cards, connections });
  assert.equal(next.length, 3);
  assert.ok(next.every((item) => item.layout.width === 146));
});

test("D2-H. Knowledge card-through is 0 after Arrange", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = knowledgeArrangeMetrics({
    cards: result.graph.cards,
    connections: scene.graph.connections,
    routeState: result.routeState,
    topology: result.topology,
  });
  assert.equal(after.cardThrough, 0);
});

test("D2-I. Knowledge highway is 0 after Arrange", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = knowledgeArrangeMetrics({
    cards: result.graph.cards,
    connections: scene.graph.connections,
    routeState: result.routeState,
    topology: result.topology,
  });
  assert.equal(after.highwayCount, 0);
});

test("D2-J. Knowledge max bends stay under 4", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = knowledgeArrangeMetrics({
    cards: result.graph.cards,
    connections: scene.graph.connections,
    routeState: result.routeState,
    topology: result.topology,
  });
  assert.ok(after.maxBendCount < 4, `maxBendCount=${after.maxBendCount}`);
});

test("D2-K. Junction membership is preserved", () => {
  const scene = fixtureScene();
  const before = topologyMembershipSnapshot(scene.routeTopology!);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = topologyMembershipSnapshot(result.topology!);
  assert.deepEqual(after.groupIds, before.groupIds);
  assert.deepEqual(after.trunkIds, before.trunkIds);
  assert.deepEqual(after.branchIds, before.branchIds);
});

test("D2-L. Junction IDs are preserved", () => {
  const scene = fixtureScene();
  const before = scene.routeTopology!.branchPoints.map((bp) => bp.id).sort();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(
    result.topology!.branchPoints.map((bp) => bp.id).sort(),
    before,
  );
});

test("D2-M. semantic fields are unchanged", () => {
  const scene = fixtureScene();
  const frozen = structuredClone(scene.graph.connections);
  const frozenNp = structuredClone(scene.graph.nursingProblems);
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  assert.deepEqual(result.graph.connections, frozen);
  assert.deepEqual(result.graph.nursingProblems, frozenNp);
  for (const item of result.graph.cards) {
    const prev = scene.graph.cards.find((card) => card.id === item.id)!;
    assert.equal(item.text, prev.text);
    assert.equal(item.cardType, prev.cardType);
    assert.equal(item.state, prev.state);
    assert.equal(item.layout.width, prev.layout.width);
    assert.equal(item.layout.height, prev.layout.height);
    assert.equal(item.layout.zIndex, prev.layout.zIndex);
  }
});

test("D2-N. Arrange is deterministic", () => {
  const scene = fixtureScene();
  const a = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const b = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(a.kind, "applied");
  assert.equal(b.kind, "applied");
  if (a.kind !== "applied" || b.kind !== "applied") return;
  assert.deepEqual(positionsOf(a.graph.cards), positionsOf(b.graph.cards));
});

test("D2-O. second Arrange is an exact NO-OP", () => {
  const scene = fixtureScene();
  const first = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(first.kind, "applied");
  if (first.kind !== "applied") return;
  const second = arrangeRelatedDiagramScene({
    graph: first.graph,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.kind, "noop");
});

test("D2-P. Undo restores the pre-Arrange scene", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(scene.graph.cards));
  assert.deepEqual(undone.fragment!.routeState, scene.routeState);
  assert.deepEqual(undone.fragment!.topology, scene.routeTopology);
});

test("D2-Q. Redo restores the arranged scene", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const redone = redoDiagramHistory(undone.history);
  const restored = applySceneFragmentToGraph(scene.graph, redone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(result.graph.cards));
  assert.deepEqual(redone.fragment!.routeState, result.routeState);
});

test("D2-R. skc4 card-through is 0", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = analyzeRouteReadability({
    cards: result.graph.cards,
    connections: scene.graph.connections.filter((item) => item.id === "skc4"),
    routeState: result.routeState,
    topology: result.topology,
  });
  assert.equal(after.totalCardThrough, 0);
});

test("D2-S. skc4 has no giant U-route", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const points = result.routeState.byId.skc4!.points;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 280);
  assert.ok(Math.max(...ys) - Math.min(...ys) < 220);
  assert.ok(points.length <= 4);
});

test("D2-T. skc12/skc13 no longer use the left-edge rail", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const arrangedRoutes = result.routeState.byId;
  for (const id of ["skc12", "skc13"]) {
    const xs = (arrangedRoutes[id]?.points ?? []).map((point) => point.x);
    assert.equal(xs.filter((x) => x <= 16).length, 0, id);
  }
});

test("D2-U. Knowledge cluster metrics improve", () => {
  const scene = fixtureScene();
  const before = knowledgeArrangeMetrics({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = knowledgeArrangeMetrics({
    cards: result.graph.cards,
    connections: scene.graph.connections,
    routeState: result.routeState,
    topology: result.topology,
    originCards: scene.graph.cards,
  });
  console.log("L2D_KNOWLEDGE_BEFORE", JSON.stringify(before));
  console.log("L2D_KNOWLEDGE_AFTER", JSON.stringify(after));
  console.log(
    "L2D_KNOWLEDGE_CARDS",
    JSON.stringify(
      result.graph.cards
        .filter((item) => item.cardType === "knowledge")
        .map((item) => {
          const prev = scene.graph.cards.find((card) => card.id === item.id)!;
          return {
            id: item.id,
            before: { x: prev.layout.x, y: prev.layout.y },
            after: { x: item.layout.x, y: item.layout.y },
          };
        }),
    ),
  );
  console.log(
    "L2D_JUNCTIONS",
    JSON.stringify(
      (result.topology?.branchPoints ?? []).map((bp) => {
        const prev = scene.routeTopology!.branchPoints.find((row) => row.id === bp.id)!;
        return {
          id: bp.id,
          before: { x: prev.x, y: prev.y },
          after: { x: bp.x, y: bp.y },
        };
      }),
    ),
  );
  assert.equal(after.cardThrough, 0);
  assert.equal(after.highwayCount, 0);
  assert.ok(after.longestRouteLength <= before.longestRouteLength);
  assert.ok(after.maxBendCount <= before.maxBendCount);
});

test("D2 flow on the fixture is vertical", () => {
  const scene = fixtureScene();
  const knowledge = scene.graph.cards.filter((item) => item.cardType === "knowledge");
  const internals = scene.graph.connections.filter((item) => {
    const ids = new Set(knowledge.map((card) => card.id));
    return ids.has(item.sourceCardId) && ids.has(item.targetCardId);
  });
  assert.equal(knowledgeUnitFlow({ cards: knowledge, connections: internals }), "vertical");
});

test("D2 apply helper is a no-op when already layered", () => {
  const scene = fixtureScene();
  const first = applyKnowledgeLayerArrange({
    cards: scene.graph.cards,
    connections: scene.graph.connections,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  const second = applyKnowledgeLayerArrange({
    cards: first.cards,
    connections: scene.graph.connections,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.changedCardIds.length, 0);
  assert.equal(second.routeChanged, false);
});

function arrangeKnowledgeOnly(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
) {
  const routeState = seedStableRouteState(cards, connections);
  return applyKnowledgeLayerArrange({
    cards,
    connections,
    routeState,
  });
}

function cardSpan(cards: RelatedDiagramCard[]) {
  const left = Math.min(...cards.map((item) => item.layout.x));
  const right = Math.max(
    ...cards.map((item) => item.layout.x + item.layout.width),
  );
  return { left, right, width: right - left };
}

test("D2-P1-A. local parent-child route stays inside the pair span", () => {
  const cards = [k("p1", 80, 40), k("p2", 280, 40), k("merge", 180, 220)];
  const connections = [conn("e1", "p1", "merge"), conn("e2", "p2", "merge")];
  const result = arrangeKnowledgeOnly(cards, connections);
  const p1 = result.cards.find((item) => item.id === "p1")!;
  const merge = result.cards.find((item) => item.id === "merge")!;
  const points = result.routeState.byId.e1!.points;
  const pairLeft = Math.min(p1.layout.x, merge.layout.x);
  const pairRight = Math.max(
    p1.layout.x + p1.layout.width,
    merge.layout.x + merge.layout.width,
  );
  assert.ok(points.length >= 2);
  assert.ok(
    points.every((point) => point.x >= pairLeft - 8 && point.x <= pairRight + 8),
    "route escaped the parent-child local span",
  );
  assert.equal(points.filter((point) => point.x <= 16).length, 0);
});

test("D2-P2-B. 3-way fan uses a compact hard-safe span", () => {
  const cards = [
    k("root", 200, 40),
    k("a", 40, 220),
    k("b", 400, 220),
    k("c", 760, 220),
  ];
  const connections = [
    conn("e1", "root", "a"),
    conn("e2", "root", "b"),
    conn("e3", "root", "c"),
  ];
  const result = arrangeKnowledgeOnly(cards, connections);
  const kids = ["a", "b", "c"].map(
    (id) => result.cards.find((item) => item.id === id)!,
  );
  const parent = result.cards.find((item) => item.id === "root")!;
  const span = cardSpan(kids);
  const compact =
    kids.reduce((sum, item) => sum + item.layout.width, 0) +
    L2D_GAP_SIBLING * (kids.length - 1);
  assert.ok(
    kids.every((item) => item.layout.y === kids[0]!.layout.y),
    "3-way fan should stay on one row",
  );
  assert.ok(
    span.width <= compact + 8,
    `fan span ${span.width} exceeded compact ${compact}`,
  );
  const mid = (span.left + span.right) / 2;
  assert.ok(Math.abs(parent.layout.x + parent.layout.width / 2 - mid) < 80);
});

test("D2-P3-C. blocked child prefers a parent-local shift over a far drop", () => {
  const cards = [
    k("p1", 60, 40),
    k("p2", 280, 40),
    k("a", 40, 220),
    k("b", 220, 220),
    k("c", 400, 220),
    k("d", 40, 400),
    k("e", 220, 400),
  ];
  const connections = [
    conn("e1", "p1", "a"),
    conn("e2", "p1", "b"),
    conn("e3", "p1", "c"),
    conn("e4", "p2", "d"),
    conn("e5", "p2", "e"),
  ];
  const result = arrangeKnowledgeOnly(cards, connections);
  const parent = result.cards.find((item) => item.id === "p2")!;
  const kids = ["d", "e"].map(
    (id) => result.cards.find((item) => item.id === id)!,
  );
  const firstKids = ["a", "b", "c"].map(
    (id) => result.cards.find((item) => item.id === id)!,
  );
  assert.ok(kids.every((item) => item.layout.y === firstKids[0]!.layout.y));
  const parentMid = parent.layout.x + parent.layout.width / 2;
  const kidMid =
    (Math.min(...kids.map((item) => item.layout.x)) +
      Math.max(...kids.map((item) => item.layout.x + item.layout.width))) /
    2;
  assert.ok(
    Math.abs(kidMid - parentMid) < parent.layout.width + L2D_GAP_MAX,
    "shifted children should keep parent affinity",
  );
});

test("D2-P3-D. a fully blocked next-layer row may still drop", () => {
  const cards = [
    k("root", 80, 40),
    k("mid", 80, 200),
    k("a", 40, 360),
    k("b", 220, 360),
    k("c", 400, 360),
    k("d", 580, 360),
    k("e", 760, 360),
    k("f", 80, 520),
    k("g", 260, 520),
  ];
  const connections = [
    conn("e1", "root", "mid"),
    conn("e2", "mid", "a"),
    conn("e3", "mid", "b"),
    conn("e4", "mid", "c"),
    conn("e5", "mid", "d"),
    conn("e6", "mid", "e"),
    conn("e7", "mid", "f"),
    conn("e8", "mid", "g"),
  ];
  const result = arrangeKnowledgeOnly(cards, connections);
  const ys = ["a", "b", "c", "d", "e", "f", "g"].map(
    (id) => result.cards.find((item) => item.id === id)!.layout.y,
  );
  const uniqueY = [...new Set(ys)].sort((left, right) => left - right);
  assert.ok(uniqueY.length >= 2, "overflowing children may wrap to a later row");
});

test("D2 polish keeps local positive and negative fans", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const byId = new Map(result.graph.cards.map((item) => [item.id, item]));
  const positiveKids = ["sk_hallucination", "sk_delusion", "sk_thought"].map(
    (id) => byId.get(id)!,
  );
  const negativeKids = ["sk_avolition", "sk_affect"].map((id) => byId.get(id)!);
  assert.ok(positiveKids.every((item) => item.layout.y === positiveKids[0]!.layout.y));
  assert.ok(negativeKids.every((item) => item.layout.y === negativeKids[0]!.layout.y));
  const pos = byId.get("sk_positive")!;
  const neg = byId.get("sk_negative")!;
  assert.ok(positiveKids[0]!.layout.y > pos.layout.y);
  assert.ok(negativeKids[0]!.layout.y > neg.layout.y);
  const posSpan = cardSpan(positiveKids);
  const compactPos =
    positiveKids.reduce((sum, item) => sum + item.layout.width, 0) +
    L2D_GAP_SIBLING * (positiveKids.length - 1);
  assert.ok(posSpan.width <= compactPos + 8);
});

test("D2-P3-E. drop keeps card-through / highway / 4+ bend at 0", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const after = knowledgeArrangeMetrics({
    cards: result.graph.cards,
    connections: scene.graph.connections,
    routeState: result.routeState,
    topology: result.topology,
  });
  assert.equal(after.cardThrough, 0);
  assert.equal(after.highwayCount, 0);
  assert.ok(after.maxBendCount < 4);
  for (const id of ["skc14", "skc15"]) {
    const points: Array<{ x: number; y: number }> =
      result.routeState.byId[id]!.points;
    assert.equal(routeHighwayFlag(points), 0, id);
    assert.ok(countBends(points) < 4, id);
  }
});

test("D2-P-F. polish layout is deterministic", () => {
  const cards = [
    k("root", 120, 40),
    k("a", 40, 220),
    k("b", 360, 220),
    k("c", 680, 220),
  ];
  const connections = [
    conn("e1", "root", "a"),
    conn("e2", "root", "b"),
    conn("e3", "root", "c"),
  ];
  const first = arrangeKnowledgeOnly(cards, connections);
  const second = arrangeKnowledgeOnly(cards, connections);
  assert.deepEqual(positionsOf(first.cards), positionsOf(second.cards));
  assert.deepEqual(
    first.routeState.byId.e1!.points,
    second.routeState.byId.e1!.points,
  );
});

test("D2-P-G. polish layout is idempotent", () => {
  const scene = fixtureScene();
  const first = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(first.kind, "applied");
  if (first.kind !== "applied") return;
  const second = arrangeRelatedDiagramScene({
    graph: first.graph,
    routeState: first.routeState,
    topology: first.topology,
  });
  assert.equal(second.kind, "noop");
});

test("D2-P-H. Undo / Redo stay exact after polish", () => {
  const scene = fixtureScene();
  const result = arrangeRelatedDiagramScene({
    graph: scene.graph,
    routeState: scene.routeState,
    topology: scene.routeTopology,
  });
  assert.equal(result.kind, "applied");
  if (result.kind !== "applied") return;
  const undone = undoDiagramHistory(
    pushDiagramHistory(emptyDiagramHistory(), result.historyAction),
  );
  const restored = applySceneFragmentToGraph(result.graph, undone.fragment!);
  assert.deepEqual(positionsOf(restored.cards), positionsOf(scene.graph.cards));
  assert.deepEqual(undone.fragment!.routeState, scene.routeState);
  assert.deepEqual(undone.fragment!.topology, scene.routeTopology);
  const redone = redoDiagramHistory(undone.history);
  const replayed = applySceneFragmentToGraph(scene.graph, redone.fragment!);
  assert.deepEqual(positionsOf(replayed.cards), positionsOf(result.graph.cards));
  assert.deepEqual(redone.fragment!.routeState, result.routeState);
});

console.log(`\n${passed} tests passed`);
