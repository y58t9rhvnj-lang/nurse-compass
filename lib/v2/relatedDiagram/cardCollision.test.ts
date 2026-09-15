/**
 * Card drop collision tests (Slice 2A).
 * Run: npx tsx lib/v2/relatedDiagram/cardCollision.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import {
  CARD_MIN_GAP,
  collidingCards,
  otherCardsUnchanged,
  rectsOverlap,
  resolveCardDropCollision,
  resolveGroupDropCollision,
} from "./cardCollision";
import { applyCardPositionToGraph } from "./cardInteractionState";
import {
  buildSchizophreniaKnowledgeGraph,
  buildSlice1StyleDemoGraph,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import { applyKnowledgeGroupDelta, knowledgeGroupBounds } from "./knowledgeGroupLayout";
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
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function gapBetween(a: RelatedDiagramCard, b: RelatedDiagramCard): number {
  const dx = Math.max(
    0,
    Math.max(a.layout.x - (b.layout.x + b.layout.width), b.layout.x - (a.layout.x + a.layout.width)),
  );
  const dy = Math.max(
    0,
    Math.max(a.layout.y - (b.layout.y + b.layout.height), b.layout.y - (a.layout.y + a.layout.height)),
  );
  if (dx === 0 && dy === 0) return 0;
  if (dx === 0) return dy;
  if (dy === 0) return dx;
  return Math.hypot(dx, dy);
}

test("CARD_MIN_GAP is 12 logical px", () => {
  assert.equal(CARD_MIN_GAP, 12);
});

test("drop onto another card has overlap 0 and keeps gap 12", () => {
  const a = card("a", 40, 40);
  const b = card("b", 200, 40);
  const result = resolveCardDropCollision({
    movingCard: a,
    desiredPosition: { x: 210, y: 40 },
    otherCards: [b],
    lastLegal: { x: 40, y: 40 },
  });
  const moved = { ...a, layout: { ...a.layout, x: result.position.x, y: result.position.y } };
  assert.equal(rectsOverlap(moved.layout, b.layout), false);
  assert.ok(gapBetween(moved, b) >= CARD_MIN_GAP);
  assert.equal(result.collided, true);
});

test("left candidate is chosen when it is the shortest escape", () => {
  const blocker = card("b", 200, 100, 80, 80);
  const moving = card("a", 40, 100, 80, 80);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 190, y: 100 },
    otherCards: [blocker],
    lastLegal: { x: 40, y: 100 },
  });
  assert.ok(result.position.x < 190);
  assert.equal(result.position.y, 100);
  assert.equal(result.position.x, 200 - CARD_MIN_GAP - 80);
});

test("right candidate is chosen when it is the shortest escape", () => {
  const blocker = card("b", 200, 100, 80, 80);
  const moving = card("a", 400, 100, 80, 80);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 210, y: 100 },
    otherCards: [blocker],
    lastLegal: { x: 400, y: 100 },
  });
  assert.ok(result.position.x > 210);
  assert.equal(result.position.y, 100);
  assert.equal(result.position.x, 200 + 80 + CARD_MIN_GAP);
});

test("up candidate is chosen when it is the shortest escape", () => {
  const blocker = card("b", 200, 200, 80, 80);
  const moving = card("a", 200, 40, 80, 80);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 200, y: 190 },
    otherCards: [blocker],
    lastLegal: { x: 200, y: 40 },
  });
  assert.equal(result.position.x, 200);
  assert.equal(result.position.y, 200 - CARD_MIN_GAP - 80);
});

test("down candidate is chosen when it is the shortest escape", () => {
  const blocker = card("b", 200, 200, 80, 80);
  const moving = card("a", 200, 360, 80, 80);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 200, y: 210 },
    otherCards: [blocker],
    lastLegal: { x: 200, y: 360 },
  });
  assert.equal(result.position.x, 200);
  assert.equal(result.position.y, 200 + 80 + CARD_MIN_GAP);
});

test("drop between multiple cards uses a nearest legal position", () => {
  const left = card("l", 40, 100, 80, 80);
  const right = card("r", 220, 100, 80, 80);
  const moving = card("m", 40, 300, 80, 80);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 130, y: 100 },
    otherCards: [left, right],
    lastLegal: { x: 40, y: 300 },
  });
  const placed = { ...moving, layout: { ...moving.layout, ...result.position } };
  assert.equal(rectsOverlap(placed.layout, left.layout), false);
  assert.equal(rectsOverlap(placed.layout, right.layout), false);
  assert.ok(gapBetween(placed, left) >= CARD_MIN_GAP);
  assert.ok(gapBetween(placed, right) >= CARD_MIN_GAP);
});

test("other cards never move", () => {
  const a = card("a", 40, 40);
  const b = card("b", 200, 40);
  const before = [a, b];
  const result = resolveCardDropCollision({
    movingCard: a,
    desiredPosition: { x: 200, y: 40 },
    otherCards: [b],
    lastLegal: { x: 40, y: 40 },
  });
  const after = [
    { ...a, layout: { ...a.layout, x: result.position.x, y: result.position.y } },
    b,
  ];
  assert.equal(otherCardsUnchanged(before, after, new Set(["a"])), true);
  assert.equal(b.layout.x, 200);
  assert.equal(b.layout.y, 40);
});

test("A3 edge nearby still resolves without leaving the canvas", () => {
  const blocker = card("b", 0, 0, 120, 80);
  const moving = card("m", 400, 0, 120, 80);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 10, y: 10 },
    otherCards: [blocker],
    lastLegal: { x: 400, y: 0 },
  });
  assert.ok(result.position.x >= 0);
  assert.ok(result.position.y >= 0);
  assert.ok(result.position.x + 120 <= A3_WIDTH_PX);
  assert.ok(result.position.y + 80 <= A3_HEIGHT_PX);
});

test("Legend nudge still leaves no card overlap", () => {
  const legend = getA3LegendBounds();
  const blocker = card(
    "b",
    legend.x - 200,
    legend.y,
    180,
    72,
  );
  const moving = card("m", 40, 40, 180, 72);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: legend.x + 8, y: legend.y + 8 },
    otherCards: [blocker],
    lastLegal: { x: 40, y: 40 },
  });
  const placed = { ...moving.layout, ...result.position };
  assert.equal(rectIntersectsA3Legend(placed), false);
  assert.equal(rectsOverlap(placed, blocker.layout), false);
});

test("no legal slot returns last legal position", () => {
  const wall = card("wall", 0, 0, 150, 80);
  const moving = card("m", 0, 0, 140, 70);
  const result = resolveCardDropCollision({
    movingCard: moving,
    desiredPosition: { x: 4, y: 4 },
    otherCards: [wall],
    lastLegal: { x: 400, y: 400 },
    canvasWidth: 160,
    canvasHeight: 90,
  });
  assert.equal(result.resolution, "last_legal");
  assert.equal(result.position.x, 400);
  assert.equal(result.position.y, 400);
});

test("Knowledge individual collision uses the same gap", () => {
  const knowledge = buildSchizophreniaKnowledgeGraph();
  const hall = knowledge.cards.find((c) => c.id === "sk_hallucination")!;
  const delusion = knowledge.cards.find((c) => c.id === "sk_delusion")!;
  const result = resolveCardDropCollision({
    movingCard: hall,
    desiredPosition: { x: delusion.layout.x, y: delusion.layout.y },
    otherCards: knowledge.cards.filter((c) => c.id !== hall.id),
    lastLegal: { x: hall.layout.x, y: hall.layout.y },
  });
  const placed = { ...hall.layout, ...result.position };
  assert.equal(rectsOverlap(placed, delusion.layout), false);
  assert.ok(
    collidingCards(
      placed,
      knowledge.cards.filter((c) => c.id !== hall.id).map((c) => ({
        id: c.id,
        ...c.layout,
      })),
    ).length === 0,
  );
});

test("patient vs Knowledge collision moves only the patient card", () => {
  const knowledge = buildSchizophreniaKnowledgeGraph();
  const demo = buildSlice1StyleDemoGraph();
  const info = demo.cards.find((c) => c.id === "demo_info")!;
  const target = knowledge.cards.find((c) => c.id === "sk_patho_core")!;
  const others = [...knowledge.cards, ...demo.cards.filter((c) => c.id !== info.id)];
  const result = resolveCardDropCollision({
    movingCard: info,
    desiredPosition: { x: target.layout.x, y: target.layout.y },
    otherCards: others,
    lastLegal: { x: info.layout.x, y: info.layout.y },
  });
  assert.ok(
    knowledge.cards.every(
      (c) => c.layout.x === (knowledge.cards.find((k) => k.id === c.id)?.layout.x ?? -1),
    ),
  );
  const placed = { ...info.layout, ...result.position };
  assert.equal(rectsOverlap(placed, target.layout), false);
});

test("Knowledge group vs patient card translates the group only", () => {
  const knowledge = buildSchizophreniaKnowledgeGraph();
  const demo = buildSlice1StyleDemoGraph();
  const merged = {
    ...knowledge,
    cards: [...knowledge.cards, ...demo.cards],
  };
  const bbox = knowledgeGroupBounds(merged.cards)!;
  const info = demo.cards.find((c) => c.id === "demo_info")!;
  const result = resolveGroupDropCollision({
    groupBounds: bbox,
    desiredDelta: {
      dx: info.layout.x - bbox.x,
      dy: info.layout.y - bbox.y,
    },
    externalCards: demo.cards,
  });
  const next = applyKnowledgeGroupDelta(merged, result.dx, result.dy);
  const nextBbox = knowledgeGroupBounds(next.cards)!;
  assert.equal(rectsOverlap(nextBbox, info.layout), false);
  assert.equal(next.cards.find((c) => c.id === "demo_info")!.layout.x, info.layout.x);
  const relBefore = knowledge.cards.map((c) => ({
    id: c.id,
    x: c.layout.x - bbox.x,
    y: c.layout.y - bbox.y,
  }));
  const relAfter = next.cards
    .filter((c) => c.cardType === "knowledge")
    .map((c) => ({
      id: c.id,
      x: c.layout.x - nextBbox.x,
      y: c.layout.y - nextBbox.y,
    }));
  assert.deepEqual(relAfter, relBefore);
});

test("group internals do not rearrange relative to each other", () => {
  const knowledge = buildSchizophreniaKnowledgeGraph();
  const bbox = knowledgeGroupBounds(knowledge.cards)!;
  const result = resolveGroupDropCollision({
    groupBounds: bbox,
    desiredDelta: { dx: 24, dy: 16 },
    externalCards: [],
  });
  const next = applyKnowledgeGroupDelta(knowledge, result.dx, result.dy);
  for (let i = 0; i < knowledge.cards.length; i++) {
    const before = knowledge.cards[i]!;
    const after = next.cards[i]!;
    assert.equal(after.layout.x - before.layout.x, result.dx);
    assert.equal(after.layout.y - before.layout.y, result.dy);
  }
});

test("applyCardPositionToGraph still only moves the chosen card", () => {
  const knowledge = buildSchizophreniaKnowledgeGraph();
  const hall = knowledge.cards.find((c) => c.id === "sk_hallucination")!;
  const next = applyCardPositionToGraph(knowledge, hall.id, hall.layout.x + 20, hall.layout.y);
  assert.equal(
    otherCardsUnchanged(knowledge.cards, next.cards, new Set([hall.id])),
    true,
  );
});

console.log(`\n${passed} passed`);
