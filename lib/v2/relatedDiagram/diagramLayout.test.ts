/**
 * Conservative Related Diagram layout L0/L1.
 * Run: npx tsx lib/v2/relatedDiagram/diagramLayout.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import { CARD_MIN_GAP, collidingCards, cardLayoutRect } from "./cardCollision";
import { layoutRelatedDiagram } from "./diagramLayout";
import { knowledgeCardsOf, knowledgeGroupBounds } from "./knowledgeGroupLayout";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardState,
  RelatedDiagramCardType,
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
    cardType?: RelatedDiagramCardType;
    state?: RelatedDiagramCardState | null;
    text?: string;
    zIndex?: number;
    isLocked?: boolean;
  },
): RelatedDiagramCard {
  const cardType = options?.cardType ?? "information";
  return {
    id,
    cardType,
    text: options?.text ?? id,
    state:
      options?.state !== undefined
        ? options.state
        : cardType === "understanding" || cardType === "nursing_problem"
          ? "current"
          : null,
    origin:
      cardType === "knowledge"
        ? "knowledge_library"
        : cardType === "nursing_problem"
          ? "direct_insight"
          : "patient_information",
    layout: {
      x,
      y,
      width: options?.width ?? 80,
      height: options?.height ?? 40,
      zIndex: options?.zIndex ?? 1,
    },
    isLocked: options?.isLocked ?? cardType === "knowledge",
    createdAt: "2026-09-20T00:00:00.000Z",
    updatedAt: "2026-09-20T00:00:00.000Z",
  };
}

function cloneCards(cards: RelatedDiagramCard[]): RelatedDiagramCard[] {
  return cards.map((item) => ({
    ...item,
    layout: { ...item.layout },
  }));
}

function applyPositions(
  cards: RelatedDiagramCard[],
  result: ReturnType<typeof layoutRelatedDiagram>,
): RelatedDiagramCard[] {
  const byId = new Map(result.positions.map((pos) => [pos.cardId, pos]));
  return cards.map((item) => {
    const next = byId.get(item.id);
    if (!next) return item;
    return {
      ...item,
      layout: { ...item.layout, x: next.x, y: next.y },
    };
  });
}

function posById(result: ReturnType<typeof layoutRelatedDiagram>) {
  return new Map(result.positions.map((pos) => [pos.cardId, pos]));
}

function gapOk(a: RelatedDiagramCard, b: RelatedDiagramCard): boolean {
  return collidingCards(cardLayoutRect(a), [cardLayoutRect(b)], CARD_MIN_GAP).length === 0;
}

function inA3(item: RelatedDiagramCard): boolean {
  return (
    item.layout.x >= 0 &&
    item.layout.y >= 0 &&
    item.layout.x + item.layout.width <= A3_WIDTH_PX &&
    item.layout.y + item.layout.height <= A3_HEIGHT_PX
  );
}

function overlapCount(cards: RelatedDiagramCard[]): number {
  let count = 0;
  for (let i = 0; i < cards.length; i += 1) {
    const rest = cards.slice(i + 1).map(cardLayoutRect);
    count += collidingCards(cardLayoutRect(cards[i]!), rest, CARD_MIN_GAP).length;
  }
  return count;
}

function outOfBoundsCount(cards: RelatedDiagramCard[]): number {
  return cards.filter((item) => !inA3(item)).length;
}

function legendHitCount(cards: RelatedDiagramCard[]): number {
  return cards.filter((item) => rectIntersectsA3Legend(item.layout)).length;
}

test("A. empty is unchanged", () => {
  const result = layoutRelatedDiagram({ cards: [] });
  assert.deepEqual(result.positions, []);
  assert.deepEqual(result.changedCardIds, []);
  assert.equal(result.fullyArranged, true);
  assert.equal(result.reason, "already_arranged");
});

test("B. one valid card is unchanged", () => {
  const cards = [card("solo", 40, 40)];
  const result = layoutRelatedDiagram({ cards });
  assert.deepEqual(result.changedCardIds, []);
  assert.deepEqual(posById(result).get("solo"), { cardId: "solo", x: 40, y: 40 });
  assert.equal(result.fullyArranged, true);
});

test("C. two non-overlapping cards stay put", () => {
  const cards = [card("a", 40, 40), card("b", 400, 40)];
  const result = layoutRelatedDiagram({ cards });
  assert.deepEqual(result.changedCardIds, []);
  assert.equal(result.fullyArranged, true);
});

test("D. two overlapping cards separate and only one moves", () => {
  const cards = [card("a", 40, 40), card("b", 50, 40)];
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  assert.equal(result.changedCardIds.length, 1);
  assert.equal(gapOk(next[0]!, next[1]!), true);
  assert.equal(result.fullyArranged, true);
  const moved = result.changedCardIds[0]!;
  const stayed = moved === "a" ? "b" : "a";
  const original = cards.find((item) => item.id === stayed)!;
  const after = next.find((item) => item.id === stayed)!;
  assert.equal(after.layout.x, original.layout.x);
  assert.equal(after.layout.y, original.layout.y);
});

test("E. card outside left/top returns inside A3", () => {
  const cards = [card("out", -40, -20)];
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  assert.deepEqual(result.changedCardIds, ["out"]);
  assert.equal(inA3(next[0]!), true);
  assert.equal(result.fullyArranged, true);
});

test("F. card outside right/bottom returns inside A3", () => {
  const cards = [card("out", A3_WIDTH_PX + 20, A3_HEIGHT_PX + 10)];
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  assert.equal(inA3(next[0]!), true);
  assert.equal(rectIntersectsA3Legend(next[0]!.layout), false);
  assert.equal(result.fullyArranged, true);
});

test("G. legend collision moves off the reserved rect", () => {
  const legend = getA3LegendBounds();
  const cards = [card("on-legend", legend.x + 8, legend.y + 8)];
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  assert.equal(rectIntersectsA3Legend(next[0]!.layout), false);
  assert.equal(inA3(next[0]!), true);
  assert.equal(result.fullyArranged, true);
});

test("H. valid cards stay while one bad card moves", () => {
  const cards = [card("ok-a", 40, 40), card("ok-b", 400, 200), card("bad", -30, 40)];
  const result = layoutRelatedDiagram({ cards });
  assert.deepEqual(result.changedCardIds, ["bad"]);
  const next = applyPositions(cards, result);
  assert.equal(next[0]!.layout.x, 40);
  assert.equal(next[1]!.layout.x, 400);
  assert.equal(inA3(next[2]!), true);
});

test("I. three-card collision resolves deterministically", () => {
  const cards = [card("c", 100, 100), card("a", 100, 100), card("b", 108, 104)];
  const first = layoutRelatedDiagram({ cards });
  const second = layoutRelatedDiagram({ cards: [cards[2]!, cards[0]!, cards[1]!] });
  assert.deepEqual(first.positions, second.positions);
  const next = applyPositions(cards, first);
  assert.equal(overlapCount(next), 0);
  assert.equal(first.fullyArranged, true);
});

test("J. valid Knowledge group does not move", () => {
  const cards = [
    card("k1", 80, 80, { cardType: "knowledge", width: 146, height: 62 }),
    card("k2", 260, 80, { cardType: "knowledge", width: 146, height: 62 }),
    card("info", 80, 400),
  ];
  const result = layoutRelatedDiagram({ cards });
  assert.deepEqual(result.changedCardIds, []);
  assert.equal(result.fullyArranged, true);
});

test("K. Knowledge group moves with a rigid delta", () => {
  const cards = [
    card("k1", -40, 80, { cardType: "knowledge", width: 146, height: 62 }),
    card("k2", 140, 200, { cardType: "knowledge", width: 146, height: 62 }),
  ];
  const beforeDx = cards[1]!.layout.x - cards[0]!.layout.x;
  const beforeDy = cards[1]!.layout.y - cards[0]!.layout.y;
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  assert.deepEqual(result.changedCardIds, ["k1", "k2"]);
  assert.equal(next[1]!.layout.x - next[0]!.layout.x, beforeDx);
  assert.equal(next[1]!.layout.y - next[0]!.layout.y, beforeDy);
  assert.equal(knowledgeCardsOf(next).every(inA3), true);
});

test("L. Knowledge + normal collision keeps group relatives", () => {
  const cards = [
    card("k1", 100, 100, { cardType: "knowledge", width: 146, height: 62 }),
    card("k2", 280, 100, { cardType: "knowledge", width: 146, height: 62 }),
    card("info", 110, 110),
  ];
  const before = knowledgeGroupBounds(cards)!;
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  const after = knowledgeGroupBounds(next)!;
  assert.equal(after.x, before.x);
  assert.equal(after.y, before.y);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.equal(result.changedCardIds.includes("info"), true);
  assert.equal(result.changedCardIds.includes("k1"), false);
  assert.equal(gapOk(next[0]!, next[2]!), true);
  assert.equal(gapOk(next[1]!, next[2]!), true);
});

test("M. Nursing Problem uses geometry only", () => {
  const cards = [
    card("np", 40, 40, {
      cardType: "nursing_problem",
      state: "current",
      text: "睡眠障害",
      zIndex: 7,
      width: 200,
      height: 78,
    }),
    card("info", 50, 50),
  ];
  const frozen = cloneCards(cards);
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  const np = next.find((item) => item.id === "np")!;
  assert.equal(np.cardType, "nursing_problem");
  assert.equal(np.state, "current");
  assert.equal(np.text, "睡眠障害");
  assert.equal(np.layout.width, 200);
  assert.equal(np.layout.height, 78);
  assert.equal(np.layout.zIndex, 7);
  assert.deepEqual(cards, frozen);
  assert.equal(gapOk(next[0]!, next[1]!), true);
});

test("N. current / potential with the same geometry match", () => {
  const current = [
    card("u1", 40, 40, { cardType: "understanding", state: "current" }),
    card("u2", 50, 40, { cardType: "understanding", state: "current" }),
  ];
  const potential = [
    card("u1", 40, 40, { cardType: "understanding", state: "potential" }),
    card("u2", 50, 40, { cardType: "understanding", state: "potential" }),
  ];
  const a = layoutRelatedDiagram({ cards: current });
  const b = layoutRelatedDiagram({ cards: potential });
  assert.deepEqual(a.positions, b.positions);
  assert.deepEqual(a.changedCardIds, b.changedCardIds);
});

test("O. reversed input array yields the same id→position map", () => {
  const cards = [card("z", 40, 40), card("m", 48, 40), card("a", 400, 300)];
  const forward = layoutRelatedDiagram({ cards });
  const reversed = layoutRelatedDiagram({ cards: [...cards].reverse() });
  assert.deepEqual(forward.positions, reversed.positions);
});

test("P. repeated calls are deterministic", () => {
  const cards = [card("a", 80, 80), card("b", 90, 88), card("c", -10, 200)];
  const first = layoutRelatedDiagram({ cards });
  for (let i = 0; i < 4; i += 1) {
    assert.deepEqual(layoutRelatedDiagram({ cards }), first);
  }
});

test("Q. second pass is idempotent", () => {
  const cards = [card("a", 80, 80), card("b", 90, 80), card("c", A3_WIDTH_PX + 4, 20)];
  const first = layoutRelatedDiagram({ cards });
  const second = layoutRelatedDiagram({ cards: applyPositions(cards, first) });
  assert.deepEqual(second.changedCardIds, []);
  assert.deepEqual(second.positions, first.positions);
});

test("R. exact A3 edges do not move", () => {
  const cards = [
    card("origin", 0, 0),
    card("right", A3_WIDTH_PX - 80, 40),
    card("bottom", 40, A3_HEIGHT_PX - 40),
  ];
  const result = layoutRelatedDiagram({ cards });
  assert.deepEqual(result.changedCardIds, []);
  assert.equal(result.fullyArranged, true);
});

test("S. impossible dense returns fullyArranged=false", () => {
  const cards = Array.from({ length: 10 }, (_, i) =>
    card(`d${String(i).padStart(2, "0")}`, 20, 20, { width: 700, height: 500 }),
  );
  const result = layoutRelatedDiagram({ cards });
  assert.equal(result.fullyArranged, false);
  assert.equal(result.reason, "impossible_to_fit");
});

test("T. impossible dense does not create bounds violations", () => {
  const cards = Array.from({ length: 10 }, (_, i) =>
    card(`d${String(i).padStart(2, "0")}`, 20, 20, { width: 700, height: 500 }),
  );
  const before = outOfBoundsCount(cards);
  const next = applyPositions(cards, layoutRelatedDiagram({ cards }));
  assert.equal(before, 0);
  assert.equal(outOfBoundsCount(next), 0);
  assert.equal(next.every(inA3), true);
});

test("U. impossible dense does not worsen quality", () => {
  const cards = Array.from({ length: 10 }, (_, i) =>
    card(`d${String(i).padStart(2, "0")}`, 20, 20, { width: 700, height: 500 }),
  );
  const next = applyPositions(cards, layoutRelatedDiagram({ cards }));
  assert.ok(outOfBoundsCount(next) <= outOfBoundsCount(cards));
  assert.ok(legendHitCount(next) <= legendHitCount(cards));
  assert.ok(overlapCount(next) <= overlapCount(cards));
});

test("V. width / height are unchanged", () => {
  const cards = [card("a", 40, 40, { width: 180, height: 72 }), card("b", 50, 48)];
  const result = layoutRelatedDiagram({ cards });
  const next = applyPositions(cards, result);
  assert.equal(next[0]!.layout.width, 180);
  assert.equal(next[0]!.layout.height, 72);
  assert.equal(next[1]!.layout.width, 80);
  assert.equal(next[1]!.layout.height, 40);
});

test("W. zIndex is unchanged", () => {
  const cards = [card("a", 40, 40, { zIndex: 9 }), card("b", 44, 40, { zIndex: 3 })];
  const next = applyPositions(cards, layoutRelatedDiagram({ cards }));
  assert.equal(next[0]!.layout.zIndex, 9);
  assert.equal(next[1]!.layout.zIndex, 3);
});

test("X. original input is not mutated", () => {
  const cards = [card("a", -12, 20, { zIndex: 4, text: "keep" }), card("b", 400, 80)];
  const frozen = cloneCards(cards);
  layoutRelatedDiagram({ cards });
  assert.deepEqual(cards, frozen);
});

console.log(`\n${passed} tests passed`);
