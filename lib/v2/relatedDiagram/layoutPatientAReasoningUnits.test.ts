/**
 * Patient A Reasoning Unit initial layout (RU-A…V).
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/layoutPatientAReasoningUnits.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { rectIntersectsA3Legend } from "./a3Legend";
import {
  arrangeRelatedDiagramScene,
} from "./applyRelatedDiagramLayout";
import { evaluateArrangeScene } from "./arrangePreservation";
import {
  PATIENT_A_DEV_EVIDENCE_RELATION,
  buildPatientAForm3Skeleton,
  patientADevInformationCardId,
} from "./buildPatientAForm3Skeleton";
import {
  CARD_MIN_GAP,
  collidingCards,
  cardLayoutRect,
} from "./cardCollision";
import { analyzeRouteReadability } from "./diagramLayoutL2b";
import {
  derivePatientAReasoningUnits,
  sharedDegreeDistribution,
} from "./derivePatientAReasoningUnits";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  clonePatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import { seedStableRouteState } from "./incrementalRoutes";
import {
  applyPatientAReasoningUnitLayout,
} from "./layoutPatientAReasoningUnits";
import { polylineManhattan } from "./routeCongestion";
import { STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING } from "./studentForm3RelatedDiagramBoundary";
import type { RelatedDiagramCard } from "./types";
import type { RelatedDiagramConnection } from "./types";
import type { StableRouteState } from "./incrementalRoutes";

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

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function shuffle<T>(rows: T[]): T[] {
  const copy = rows.slice();
  copy.reverse();
  if (copy.length > 2) {
    const [first, ...rest] = copy;
    copy.splice(0, copy.length, ...rest, first!);
  }
  return copy;
}

function stripCardSemantics(card: RelatedDiagramCard) {
  const { x: _x, y: _y, ...layoutRest } = card.layout;
  return {
    id: card.id,
    cardType: card.cardType,
    text: card.text,
    state: card.state,
    origin: card.origin,
    isLocked: card.isLocked,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    layout: layoutRest,
  };
}

function stripConnection(conn: RelatedDiagramConnection) {
  return {
    id: conn.id,
    sourceCardId: conn.sourceCardId,
    targetCardId: conn.targetCardId,
    relationType: conn.relationType,
    origin: conn.origin,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}

function componentStats(
  cards: { id: string }[],
  connections: { sourceCardId: string; targetCardId: string }[],
) {
  const nodes = new Map(cards.map((c) => [c.id, [] as string[]]));
  for (const conn of connections) {
    nodes.get(conn.sourceCardId)?.push(conn.targetCardId);
    nodes.get(conn.targetCardId)?.push(conn.sourceCardId);
  }
  const seen = new Set<string>();
  let isolated = 0;
  let components = 0;
  let max = 0;
  for (const id of nodes.keys()) {
    if (seen.has(id)) continue;
    components += 1;
    const stack = [id];
    seen.add(id);
    let size = 0;
    while (stack.length) {
      const cur = stack.pop()!;
      size += 1;
      for (const n of nodes.get(cur) ?? []) {
        if (!seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    if (size === 1) isolated += 1;
    if (size > max) max = size;
  }
  return { components, isolated, max };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function routeLength(
  routeState: StableRouteState,
  connectionId: string,
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
): number {
  const stored = routeState.byId[connectionId];
  if (stored?.points && stored.points.length >= 2) {
    return polylineManhattan(stored.points);
  }
  const conn = connections.find((row) => row.id === connectionId);
  if (!conn) return 0;
  const source = cards.find((card) => card.id === conn.sourceCardId);
  const target = cards.find((card) => card.id === conn.targetCardId);
  if (!source || !target) return 0;
  return (
    Math.abs(
      source.layout.x +
        source.layout.width / 2 -
        (target.layout.x + target.layout.width / 2),
    ) +
    Math.abs(
      source.layout.y +
        source.layout.height / 2 -
        (target.layout.y + target.layout.height / 2),
    )
  );
}

function evidenceRouteStats(
  derivation: ReturnType<typeof derivePatientAReasoningUnits>,
  graph: { cards: RelatedDiagramCard[]; connections: RelatedDiagramConnection[] },
  routeState: StableRouteState,
) {
  const exclusive = new Set(derivation.exclusiveInformationIds);
  const shared = new Set(
    derivation.sharedInformations.map((row) => row.informationId),
  );
  const exclusiveLens: number[] = [];
  const sharedLens: number[] = [];
  for (const conn of graph.connections) {
    const rawId = conn.sourceCardId.startsWith("f3i_")
      ? conn.sourceCardId.slice("f3i_".length)
      : "";
    const len = routeLength(
      routeState,
      conn.id,
      graph.cards,
      graph.connections,
    );
    if (exclusive.has(rawId)) exclusiveLens.push(len);
    else if (shared.has(rawId)) sharedLens.push(len);
  }
  return {
    exclusiveMean: Math.round(mean(exclusiveLens)),
    sharedMean: Math.round(mean(sharedLens)),
    sharedMax: sharedLens.length ? Math.round(Math.max(...sharedLens)) : 0,
    exclusiveCount: exclusiveLens.length,
    sharedCount: sharedLens.length,
  };
}

function sceneMetrics(
  cards: RelatedDiagramCard[],
  connections: RelatedDiagramConnection[],
  routeState: StableRouteState,
  topology?: Parameters<typeof evaluateArrangeScene>[0]["topology"],
) {
  const quality = evaluateArrangeScene({
    cards,
    connections,
    routeState,
    topology,
  });
  const read = analyzeRouteReadability({
    cards,
    connections,
    routeState,
    topology,
  });
  const components = componentStats(cards, connections);
  return {
    overlap: quality.overlapCount,
    bounds: quality.boundsHits,
    legend: quality.legendHits,
    cardThrough: quality.cardThrough,
    highway: quality.highwayCount,
    outerRail: quality.outerRailCount,
    totalLength: quality.totalLength,
    totalBends: read.totalBends,
    maxBends: quality.maxBendCount,
    components: components.components,
    isolated: components.isolated,
    maxComponent: components.max,
  };
}

function movedCardCount(
  before: RelatedDiagramCard[],
  after: RelatedDiagramCard[],
): number {
  return before.filter((card) => {
    const next = after.find((row) => row.id === card.id);
    return (
      next != null &&
      (next.layout.x !== card.layout.x || next.layout.y !== card.layout.y)
    );
  }).length;
}

const scatter = buildPatientAForm3Skeleton();
const derivation = derivePatientAReasoningUnits();
const laid = applyPatientAReasoningUnitLayout(scatter);
const scatterRoutes = seedStableRouteState(
  scatter.graph.cards,
  scatter.graph.connections,
);
const ruRoutes = seedStableRouteState(
  laid.graph.cards,
  laid.graph.connections,
);

test("RU-A 10 Units", () => {
  assert.equal(derivation.units.length, 10);
  assert.equal(laid.derivation.units.length, 10);
});

test("RU-B exclusive 9", () => {
  assert.equal(derivation.exclusiveInformationIds.length, 9);
});

test("RU-C shared 9", () => {
  assert.equal(derivation.sharedInformations.length, 9);
});

test("RU-D isolated 8", () => {
  assert.equal(derivation.isolatedInformationIds.length, 8);
});

test("RU-E shared degree distribution = 2:3 / 3:4 / 4:2", () => {
  assert.deepEqual(sharedDegreeDistribution(derivation), {
    d2: 3,
    d3: 4,
    d4: 2,
  });
});

test("RU-F Information duplicate 0", () => {
  const infoIds = laid.graph.cards
    .filter((card) => card.cardType === "information")
    .map((card) => card.id);
  assert.equal(new Set(infoIds).size, infoIds.length);
  assert.equal(infoIds.length, 26);
});

test("RU-G all 36 card IDs preserved", () => {
  const a = scatter.graph.cards.map((card) => card.id).sort();
  const b = laid.graph.cards.map((card) => card.id).sort();
  assert.deepEqual(b, a);
  assert.equal(b.length, 36);
});

test("RU-H all 35 evidence relations preserved", () => {
  const a = scatter.graph.connections.map((conn) => conn.id).sort();
  const b = laid.graph.connections.map((conn) => conn.id).sort();
  assert.deepEqual(b, a);
  assert.equal(b.length, 35);
  assert.deepEqual(
    laid.graph.connections.map(stripConnection).sort((x, y) =>
      x.id < y.id ? -1 : 1,
    ),
    scatter.graph.connections.map(stripConnection).sort((x, y) =>
      x.id < y.id ? -1 : 1,
    ),
  );
});

test("RU-I Unit 1/5/7 exclusive=0でも配置可能", () => {
  const emptyExclusive = derivation.units.filter(
    (unit) => unit.exclusiveInformationIds.length === 0,
  );
  assert.ok(emptyExclusive.length >= 3);
  for (const unit of emptyExclusive) {
    const card = laid.graph.cards.find(
      (row) => row.id === unit.understandingCardId,
    );
    assert.ok(card);
    assert.ok(card!.layout.x >= 0);
    assert.ok(card!.layout.y >= 0);
    assert.ok(card!.layout.x + card!.layout.width <= A3_WIDTH_PX);
    assert.ok(card!.layout.y + card!.layout.height <= A3_HEIGHT_PX);
  }
});

test("RU-J Unit 8 shared=0でも配置可能", () => {
  const independent = derivation.units.filter(
    (unit) => unit.sharedInformationIds.length === 0,
  );
  assert.ok(independent.length >= 1);
  for (const unit of independent) {
    const card = laid.graph.cards.find(
      (row) => row.id === unit.understandingCardId,
    );
    assert.ok(card);
    assert.ok(card!.layout.x + card!.layout.width <= A3_WIDTH_PX);
    assert.ok(card!.layout.y + card!.layout.height <= A3_HEIGHT_PX);
    for (const informationId of unit.exclusiveInformationIds) {
      const info = laid.graph.cards.find(
        (row) => row.id === patientADevInformationCardId(informationId),
      );
      assert.ok(info);
    }
  }
});

test("RU-K isolated 8 preserved", () => {
  for (const informationId of derivation.isolatedInformationIds) {
    const card = laid.graph.cards.find(
      (row) => row.id === patientADevInformationCardId(informationId),
    );
    assert.ok(card);
    assert.equal(card!.cardType, "information");
  }
});

test("RU-L bounds 0", () => {
  for (const card of laid.graph.cards) {
    assert.ok(card.layout.x >= 0);
    assert.ok(card.layout.y >= 0);
    assert.ok(card.layout.x + card.layout.width <= A3_WIDTH_PX);
    assert.ok(card.layout.y + card.layout.height <= A3_HEIGHT_PX);
  }
});

test("RU-M legend collision 0", () => {
  for (const card of laid.graph.cards) {
    assert.equal(rectIntersectsA3Legend(card.layout), false);
  }
});

test("RU-N card overlap 0", () => {
  for (const card of laid.graph.cards) {
    const others = laid.graph.cards.filter((row) => row.id !== card.id);
    assert.equal(
      collidingCards(cardLayoutRect(card), others.map(cardLayoutRect), CARD_MIN_GAP)
        .length,
      0,
    );
  }
});

test("RU-O deterministic", () => {
  const a = applyPatientAReasoningUnitLayout(buildPatientAForm3Skeleton());
  const b = applyPatientAReasoningUnitLayout(buildPatientAForm3Skeleton());
  assert.deepEqual(
    a.graph.cards.map((card) => [card.id, card.layout.x, card.layout.y]),
    b.graph.cards.map((card) => [card.id, card.layout.x, card.layout.y]),
  );
  assert.deepEqual(a.derivation, b.derivation);
});

test("RU-P array-order independent", () => {
  const shuffled = clonePatientAForm3SkeletonSnapshot();
  shuffled.informationCards = shuffle(shuffled.informationCards);
  shuffled.assessmentCards = shuffle(shuffled.assessmentCards);
  const a = applyPatientAReasoningUnitLayout(buildPatientAForm3Skeleton());
  const b = applyPatientAReasoningUnitLayout(
    buildPatientAForm3Skeleton(shuffled),
    shuffled,
  );
  const posA = Object.fromEntries(
    a.graph.cards.map((card) => [card.id, { x: card.layout.x, y: card.layout.y }]),
  );
  const posB = Object.fromEntries(
    b.graph.cards.map((card) => [card.id, { x: card.layout.x, y: card.layout.y }]),
  );
  assert.deepEqual(posB, posA);
});

test("RU-Q source snapshot mutation 0", () => {
  const before = clonePatientAForm3SkeletonSnapshot();
  derivePatientAReasoningUnits(PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT);
  applyPatientAReasoningUnitLayout(
    scatter,
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  );
  assert.deepEqual(
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.informationCards[0]!.patternKeys,
    before.informationCards[0]!.patternKeys,
  );
  assert.deepEqual(
    PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT.assessmentCards[0]!
      .evidenceInformationIds,
    before.assessmentCards[0]!.evidenceInformationIds,
  );
});

test("RU-R semantic card fields unchanged", () => {
  const a = scatter.graph.cards
    .map(stripCardSemantics)
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  const b = laid.graph.cards
    .map(stripCardSemantics)
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  assert.deepEqual(b, a);
});

test("RU-S connection semantic fields unchanged", () => {
  assert.deepEqual(
    laid.graph.connections.map(stripConnection).sort((a, b) =>
      a.id < b.id ? -1 : 1,
    ),
    scatter.graph.connections.map(stripConnection).sort((a, b) =>
      a.id < b.id ? -1 : 1,
    ),
  );
});

test("RU-T Knowledge 0 / NP 0", () => {
  assert.equal(
    laid.graph.cards.some((card) => card.cardType === "knowledge"),
    false,
  );
  assert.equal(
    laid.graph.cards.some((card) => card.cardType === "nursing_problem"),
    false,
  );
  assert.equal(laid.graph.nursingProblems.length, 0);
});

test("RU-U production DB read/write 0 at runtime", () => {
  const files = [
    src("./derivePatientAReasoningUnits.ts"),
    src("./layoutPatientAReasoningUnits.ts"),
    src("../../../components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace.tsx"),
    src("../../../app/dev/related-diagram-patient-a/page.tsx"),
  ];
  for (const text of files) {
    assert.equal(text.includes("insertForm3"), false);
    assert.equal(text.includes("updateForm3WithVersion"), false);
    assert.equal(text.includes("saveForm3Action"), false);
    assert.equal(text.includes("saveForm3V2Action"), false);
    assert.equal(text.includes("insertRelatedDiagram"), false);
    assert.equal(text.includes("updateRelatedDiagram"), false);
    assert.equal(text.includes('.from("related_diagram_records")'), false);
    assert.equal(text.includes('.from("form3_records")'), false);
  }
});

test("RU-V STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING=false", () => {
  assert.equal(STUDENT_RELATED_DIAGRAM_UNSAVED_EDITING, false);
  const layout = src("./layoutPatientAReasoningUnits.ts");
  const derive = src("./derivePatientAReasoningUnits.ts");
  assert.equal(layout.includes("patternKey is never used as layout ownership"), true);
  assert.equal(derive.includes("patternKey is never treated as layout ownership"), true);
  assert.equal(/Gordon|pattern lane/.test(layout), false);
});

test("pockets derive from membership overlap, not labels", () => {
  const layout = src("./layoutPatientAReasoningUnits.ts");
  const derive = src("./derivePatientAReasoningUnits.ts");
  assert.equal(derive.includes("SHARED_POCKET_MIN_UNIT_OVERLAP"), true);
  assert.equal(/身体|関係|medication|SST/.test(layout), false);
  assert.equal(laid.derivation.pockets.length >= 2, true);
  assert.equal(laid.derivation.pockets.length <= 5, true);
});

test("types.ts has no reasoningUnitId", () => {
  const types = src("./types.ts");
  assert.equal(types.includes("reasoningUnitId"), false);
});

const arrangedScatter = arrangeRelatedDiagramScene({
  graph: scatter.graph,
  routeState: scatterRoutes,
});
const arrangedRu = arrangeRelatedDiagramScene({
  graph: laid.graph,
  routeState: ruRoutes,
});
const scatterAfterGraph =
  arrangedScatter.kind === "applied" ? arrangedScatter.graph : scatter.graph;
const scatterAfterRoutes =
  arrangedScatter.kind === "applied" ? arrangedScatter.routeState : scatterRoutes;
const scatterAfterTopo =
  arrangedScatter.kind === "applied" ? arrangedScatter.topology : undefined;
const ruAfterGraph =
  arrangedRu.kind === "applied" ? arrangedRu.graph : laid.graph;
const ruAfterRoutes =
  arrangedRu.kind === "applied" ? arrangedRu.routeState : ruRoutes;
const ruAfterTopo =
  arrangedRu.kind === "applied" ? arrangedRu.topology : undefined;

const metricsA = sceneMetrics(
  scatter.graph.cards,
  scatter.graph.connections,
  scatterRoutes,
);
const metricsB = sceneMetrics(
  scatterAfterGraph.cards,
  scatterAfterGraph.connections,
  scatterAfterRoutes,
  scatterAfterTopo,
);
const metricsC = sceneMetrics(
  laid.graph.cards,
  laid.graph.connections,
  ruRoutes,
);
const metricsD = sceneMetrics(
  ruAfterGraph.cards,
  ruAfterGraph.connections,
  ruAfterRoutes,
  ruAfterTopo,
);
const routesA = evidenceRouteStats(derivation, scatter.graph, scatterRoutes);
const routesB = evidenceRouteStats(
  derivation,
  scatterAfterGraph,
  scatterAfterRoutes,
);
const routesC = evidenceRouteStats(derivation, laid.graph, ruRoutes);
const routesD = evidenceRouteStats(derivation, ruAfterGraph, ruAfterRoutes);

test("A/B/C/D metrics are observed without algorithm changes", () => {
  console.log(
    JSON.stringify(
      {
        pockets: laid.derivation.pockets.map((pocket) => ({
          id: pocket.id,
          size: pocket.informationIds.length,
        })),
        arrange: {
          scatter: arrangedScatter.kind,
          reasoningUnit: arrangedRu.kind,
        },
        A_scatter: { ...metricsA, ...routesA, moved: 0 },
        B_scatterArrange: {
          ...metricsB,
          ...routesB,
          moved: movedCardCount(scatter.graph.cards, scatterAfterGraph.cards),
        },
        C_reasoningUnit: { ...metricsC, ...routesC, moved: 0 },
        D_reasoningUnitArrange: {
          ...metricsD,
          ...routesD,
          moved: movedCardCount(laid.graph.cards, ruAfterGraph.cards),
        },
      },
      null,
      2,
    ),
  );
  assert.equal(metricsC.overlap, 0);
  assert.equal(metricsC.bounds, 0);
  assert.equal(metricsC.legend, 0);
  assert.equal(laid.graph.connections.length, 35);
  assert.equal(
    laid.graph.cards.every((card) =>
      (scatter.graph.cardSources.find((source) => source.cardId === card.id)
        ?.relation ?? "").includes(PATIENT_A_DEV_EVIDENCE_RELATION),
    ),
    true,
  );
});

console.log(`${passed} passed`);
