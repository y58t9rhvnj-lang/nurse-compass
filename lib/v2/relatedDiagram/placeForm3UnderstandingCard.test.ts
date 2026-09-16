/**
 * Slice 2B-1 placement: A3 boundary, collision, legend avoidance.
 * Run: npx tsx lib/v2/relatedDiagram/placeForm3UnderstandingCard.test.ts
 */

import assert from "node:assert/strict";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import { CARD_MIN_GAP } from "./cardCollision";
import {
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
} from "./form3ToUnderstandingCard";
import { placeForm3UnderstandingCard } from "./placeForm3UnderstandingCard";
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
  width = UNDERSTANDING_CARD_WIDTH,
  height = UNDERSTANDING_CARD_HEIGHT,
): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "form3_assessment",
    layout: { x, y, width, height, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

test("default placement stays inside the A3 boundary", () => {
  const placed = placeForm3UnderstandingCard({ otherCards: [] });
  assert.ok(placed.x >= 0);
  assert.ok(placed.y >= 0);
  assert.ok(placed.x + UNDERSTANDING_CARD_WIDTH <= A3_WIDTH_PX);
  assert.ok(placed.y + UNDERSTANDING_CARD_HEIGHT <= A3_HEIGHT_PX);
  assert.equal(
    rectIntersectsA3Legend({
      x: placed.x,
      y: placed.y,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    }),
    false,
  );
});

test("placement avoids an occupied viewport-center card", () => {
  const blocker = card(
    "blocker",
    A3_WIDTH_PX / 2 - UNDERSTANDING_CARD_WIDTH / 2,
    A3_HEIGHT_PX / 2 - UNDERSTANDING_CARD_HEIGHT / 2,
  );
  const placed = placeForm3UnderstandingCard({
    desiredCenter: { x: A3_WIDTH_PX / 2, y: A3_HEIGHT_PX / 2 },
    otherCards: [blocker],
  });
  const dx = Math.abs(placed.x - blocker.layout.x);
  const dy = Math.abs(placed.y - blocker.layout.y);
  const separated =
    dx >= UNDERSTANDING_CARD_WIDTH + CARD_MIN_GAP ||
    dy >= UNDERSTANDING_CARD_HEIGHT + CARD_MIN_GAP;
  assert.equal(separated, true);
  assert.equal(placed.collided, true);
});

test("placement nudges off the reserved legend", () => {
  const legend = getA3LegendBounds();
  const placed = placeForm3UnderstandingCard({
    desiredCenter: {
      x: legend.x + legend.width / 2,
      y: legend.y + legend.height / 2,
    },
    otherCards: [],
  });
  assert.equal(
    rectIntersectsA3Legend({
      x: placed.x,
      y: placed.y,
      width: UNDERSTANDING_CARD_WIDTH,
      height: UNDERSTANDING_CARD_HEIGHT,
    }),
    false,
  );
});

console.log(`\n${passed} passed`);
