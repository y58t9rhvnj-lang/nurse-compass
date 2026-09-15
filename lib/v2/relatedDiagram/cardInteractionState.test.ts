/**
 * Slice 2A interaction state machine + gesture arbitration tests.
 * Run: npx tsx lib/v2/relatedDiagram/cardInteractionState.test.ts
 */

import assert from "node:assert/strict";
import {
  CARD_DRAG_THRESHOLD_PX,
  applyEscape,
  applyPointerDownOnBlank,
  applyPointerDownOnCard,
  applyPointerDownOnGroupHandle,
  applyPointerMove,
  applyPointerUp,
  applySecondTouch,
  applyViewportGestureEnd,
  createIdleState,
  isCardLayoutMovable,
  isCardSemanticLocked,
  shouldBeginViewportMousePan,
} from "./cardInteractionState";

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

const movableDown = {
  cardId: "demo_info",
  movable: true,
  pointerId: 1,
  pointerType: "touch",
  clientX: 100,
  clientY: 100,
  originX: 200,
  originY: 80,
  cardWidth: 180,
  cardHeight: 72,
};

test("6px未満 = tap (stays CARD_SELECTED)", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 100 + CARD_DRAG_THRESHOLD_PX - 1,
    clientY: 100,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_SELECTED");
  const up = applyPointerUp(s, { pointerId: 1 });
  assert.equal(up.drop, null);
  assert.equal(up.state.selectedCardId, "demo_info");
});

test("6px超過 = drag", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 100 + CARD_DRAG_THRESHOLD_PX,
    clientY: 100,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  assert.equal(s.currentX, 200 + CARD_DRAG_THRESHOLD_PX);
});

test("locked Card drag不可", () => {
  assert.equal(
    isCardLayoutMovable({ isLocked: true, cardType: "information" }),
    false,
  );
  let s = applyPointerDownOnCard(createIdleState(), {
    ...movableDown,
    movable: false,
    cardId: "locked_info",
  });
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 140,
    clientY: 140,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_SELECTED");
  assert.equal(s.currentX, 200);
});

test("Knowledge layout movable / semantic locked", () => {
  assert.equal(
    isCardLayoutMovable({ isLocked: true, cardType: "knowledge" }),
    true,
  );
  assert.equal(
    isCardSemanticLocked({
      cardType: "knowledge",
      origin: "knowledge_library",
    }),
    true,
  );
});

test("1本指 Card drag updates only that card position", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 130,
    clientY: 110,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  assert.equal(s.currentX, 230);
  assert.equal(s.currentY, 90);
  assert.equal(s.selectedCardId, "demo_info");
});

test("blank 1本指 is no-op", () => {
  const s = applyPointerDownOnBlank(createIdleState());
  assert.equal(s.phase, "IDLE");
  assert.equal(s.selectedCardId, null);
});

test("2本指 viewport from idle does not move a card", () => {
  const next = applySecondTouch(createIdleState());
  assert.equal(next.state.phase, "VIEWPORT_GESTURE");
  assert.equal(next.commit, null);
  const moved = applyPointerMove(next.state, {
    pointerId: 1,
    clientX: 400,
    clientY: 400,
    scale: 1,
  });
  assert.equal(moved.currentX, 0);
  assert.equal(moved.phase, "VIEWPORT_GESTURE");
});

test("drag中2本目touchでCard停止 (no revert)", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 160,
    clientY: 100,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  assert.equal(s.currentX, 260);
  const handoff = applySecondTouch(s);
  assert.equal(handoff.state.phase, "VIEWPORT_GESTURE");
  assert.deepEqual(handoff.commit, {
    kind: "card",
    cardId: "demo_info",
    x: 260,
    y: 80,
  });
  const after = applyPointerMove(handoff.state, {
    pointerId: 1,
    clientX: 300,
    clientY: 200,
    scale: 1,
  });
  assert.equal(after.currentX, 260);
  assert.equal(after.currentY, 80);
  assert.notEqual(handoff.commit?.x, movableDown.originX);
});

test("handoff後はviewportのみ (card tracking stopped)", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 140,
    clientY: 100,
    scale: 1,
  });
  const handoff = applySecondTouch(s);
  const after = applyPointerMove(handoff.state, {
    pointerId: 1,
    clientX: 200,
    clientY: 180,
    scale: 0.52,
  });
  assert.equal(after.phase, "VIEWPORT_GESTURE");
  assert.equal(after.currentX, handoff.state.currentX);
  const ended = applyViewportGestureEnd(after);
  assert.equal(ended.phase, "CARD_SELECTED");
  assert.equal(ended.selectedCardId, "demo_info");
});

test("mouse Card drag does not begin canvas pan", () => {
  assert.equal(
    shouldBeginViewportMousePan({ pointerType: "mouse", targetIsCard: true }),
    false,
  );
  let s = applyPointerDownOnCard(createIdleState(), {
    ...movableDown,
    pointerType: "mouse",
  });
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 130,
    clientY: 100,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
});

test("blank mouse drag begins canvas pan", () => {
  assert.equal(
    shouldBeginViewportMousePan({ pointerType: "mouse", targetIsCard: false }),
    true,
  );
  assert.equal(
    shouldBeginViewportMousePan({ pointerType: "touch", targetIsCard: false }),
    false,
  );
});

test("Escape deselects; drag commits current position", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 150,
    clientY: 100,
    scale: 1,
  });
  const esc = applyEscape(s);
  assert.equal(esc.state.phase, "IDLE");
  assert.equal(esc.drop?.kind, "card");
  if (esc.drop?.kind === "card") assert.equal(esc.drop.x, 250);
});

test("group handle drag applies one delta and handoff does not revert", () => {
  let s = applyPointerDownOnGroupHandle(createIdleState(), {
    pointerId: 2,
    pointerType: "touch",
    clientX: 40,
    clientY: 20,
    bboxX: 40,
    bboxY: 40,
    bboxWidth: 700,
    bboxHeight: 620,
  });
  assert.equal(s.phase, "GROUP_SELECTED");
  assert.equal(s.selectedGroup, true);
  s = applyPointerMove(s, {
    pointerId: 2,
    clientX: 70,
    clientY: 20,
    scale: 1,
  });
  assert.equal(s.phase, "GROUP_DRAGGING");
  assert.equal(s.currentX, 30);
  const handoff = applySecondTouch(s);
  assert.equal(handoff.state.phase, "VIEWPORT_GESTURE");
  assert.deepEqual(handoff.commit, { kind: "group", dx: 30, dy: 0 });
  const after = applyPointerMove(handoff.state, {
    pointerId: 2,
    clientX: 200,
    clientY: 80,
    scale: 1,
  });
  assert.equal(after.currentX, 30);
});

console.log(`\n${passed} passed`);
