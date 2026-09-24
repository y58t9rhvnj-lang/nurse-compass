/**
 * Card drag → tap misfire (TAP-A…H).
 * Run: npx tsx lib/v2/relatedDiagram/cardTapGesture.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CARD_DRAG_THRESHOLD_PX,
  applyPointerDownOnCard,
  applyPointerMove,
  applyPointerUp,
  applySecondTouch,
  createIdleState,
} from "./cardInteractionState";
import {
  armCardTapSuppression,
  cardPointerReleaseKindFromState,
  consumeSyntheticClickAfterDrag,
  idleTapSuppression,
  isCardDragMovement,
  pointerScreenDistance,
  shouldArmClickSuppression,
  shouldRevealCardActionsAfterRelease,
  suppressionAfterPointerDown,
} from "./cardTapGesture";

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

test("TAP-A: pointerdown → jitter under threshold → pointerup is tap", () => {
  const start = { clientX: 100, clientY: 100 };
  const jitter = {
    clientX: 100 + CARD_DRAG_THRESHOLD_PX - 1,
    clientY: 100,
  };
  assert.equal(pointerScreenDistance(start, jitter), CARD_DRAG_THRESHOLD_PX - 1);
  assert.equal(isCardDragMovement(start, jitter), false);

  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: jitter.clientX,
    clientY: jitter.clientY,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_PRESSING");
  const kind = cardPointerReleaseKindFromState(s, 1);
  assert.equal(kind, "tap");
  assert.equal(shouldRevealCardActionsAfterRelease(kind), true);
  assert.equal(shouldArmClickSuppression(kind), false);
  const up = applyPointerUp(s, { pointerId: 1 });
  assert.equal(up.drop, null);
  assert.equal(up.state.phase, "CARD_SELECTED");
  assert.equal(up.state.selectedCardId, "demo_info");
});

test("TAP-B: threshold-crossing move then pointerup/click does not open tap UI", () => {
  const start = { clientX: 100, clientY: 100 };
  const moved = {
    clientX: 100 + CARD_DRAG_THRESHOLD_PX,
    clientY: 100,
  };
  assert.equal(isCardDragMovement(start, moved), true);

  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: moved.clientX,
    clientY: moved.clientY,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  const kind = cardPointerReleaseKindFromState(s, 1);
  assert.equal(kind, "drag");
  assert.equal(shouldRevealCardActionsAfterRelease(kind), false);
  assert.equal(shouldArmClickSuppression(kind), true);

  const armed = armCardTapSuppression(1);
  const click = consumeSyntheticClickAfterDrag(armed);
  assert.equal(click.consume, true);
  assert.equal(click.next.armed, false);
});

test("TAP-C: after drag, the next independent pointerdown/up/click is a tap", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 100 + 20,
    clientY: 100,
    scale: 1,
  });
  const dragUp = applyPointerUp(s, { pointerId: 1 });
  assert.equal(cardPointerReleaseKindFromState(s, 1), "drag");
  assert.equal(dragUp.state.phase, "CARD_SELECTED");

  let suppression = armCardTapSuppression(1, "touch");
  suppression = suppressionAfterPointerDown(suppression, {
    pointerId: 2,
    pointerType: "touch",
  });
  assert.equal(suppression.armed, false);
  const leftoverClick = consumeSyntheticClickAfterDrag(suppression);
  assert.equal(leftoverClick.consume, false);

  const next = applyPointerDownOnCard(dragUp.state, {
    ...movableDown,
    pointerId: 2,
    clientX: 140,
    clientY: 110,
    originX: dragUp.state.currentX,
    originY: dragUp.state.currentY,
  });
  assert.equal(cardPointerReleaseKindFromState(next, 2), "tap");
  assert.equal(shouldRevealCardActionsAfterRelease("tap"), true);
  const tapUp = applyPointerUp(next, { pointerId: 2 });
  assert.equal(tapUp.drop, null);
  assert.equal(tapUp.state.selectedCardId, "demo_info");
});

test("TAP-D: clamp-same card x/y is still a drag gesture", () => {
  let s = applyPointerDownOnCard(createIdleState(), {
    ...movableDown,
    originX: 0,
    originY: 80,
  });
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 100 - 20,
    clientY: 100,
    scale: 1,
    canvasWidth: 1122,
    canvasHeight: 794,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  assert.equal(s.currentX, s.originX);
  assert.equal(s.currentY, s.originY);
  const kind = cardPointerReleaseKindFromState(s, 1);
  assert.equal(kind, "drag");
  assert.equal(shouldRevealCardActionsAfterRelease(kind), false);
});

test("TAP-E: a different pointerId does not inherit suppression", () => {
  const armed = armCardTapSuppression(1);
  const foreignClick = consumeSyntheticClickAfterDrag(armed, 2);
  assert.equal(foreignClick.consume, false);
  assert.equal(foreignClick.next.armed, false);

  const stillArmed = armCardTapSuppression(1, "touch");
  const nextDown = suppressionAfterPointerDown(stillArmed, {
    pointerId: 99,
    pointerType: "touch",
  });
  assert.equal(nextDown.armed, false);
  assert.equal(consumeSyntheticClickAfterDrag(nextDown).consume, false);

  const afterTouchDrag = armCardTapSuppression(1, "touch");
  const compatMouse = suppressionAfterPointerDown(afterTouchDrag, {
    pointerId: 1,
    pointerType: "mouse",
  });
  assert.equal(compatMouse.armed, true);
  assert.equal(consumeSyntheticClickAfterDrag(compatMouse).consume, true);
});

test("TAP-F: multi-touch / pinch end is not a card tap", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 130,
    clientY: 100,
    scale: 1,
  });
  const handoff = applySecondTouch(s);
  assert.equal(handoff.state.phase, "VIEWPORT_GESTURE");
  assert.equal(cardPointerReleaseKindFromState(handoff.state, 1), "ignored");
  assert.equal(shouldRevealCardActionsAfterRelease("ignored"), false);

  const pressing = applyPointerDownOnCard(createIdleState(), movableDown);
  assert.equal(
    cardPointerReleaseKindFromState(pressing, 1, 2),
    "ignored",
  );
});

test("TAP-G: ordinary drag still commits move for history", () => {
  let s = applyPointerDownOnCard(createIdleState(), movableDown);
  s = applyPointerMove(s, {
    pointerId: 1,
    clientX: 160,
    clientY: 110,
    scale: 1,
  });
  assert.equal(s.phase, "CARD_DRAGGING");
  const up = applyPointerUp(s, { pointerId: 1 });
  assert.deepEqual(up.drop, {
    kind: "card",
    cardId: "demo_info",
    x: 260,
    y: 90,
  });
  assert.equal(up.state.phase, "CARD_SELECTED");
  assert.notEqual(up.drop?.kind === "card" ? up.drop.x : 0, movableDown.originX);
});

test("TAP-H: connection-create slop and short-circuit stay intact", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  const upFn = ws.slice(
    ws.indexOf("const handleConnectingCardPointerUp"),
    ws.indexOf("const handleOpenSource"),
  );
  assert.ok(upFn.includes("dx * dx + dy * dy > 256"));
  assert.ok(upFn.includes("handleConnectTargetTap"));
  const connectIdx = upFn.indexOf("handleConnectTargetTap");
  const revealIdx = upFn.indexOf("shouldRevealCardActionsAfterRelease");
  assert.ok(connectIdx > 0 && revealIdx > connectIdx);
  assert.ok(upFn.includes("shouldArmClickSuppression"));
});

test("helper reuses CARD_DRAG_THRESHOLD_PX = 6 and does not debounce by timeout", () => {
  assert.equal(CARD_DRAG_THRESHOLD_PX, 6);
  const helper = src("./cardTapGesture.ts");
  assert.ok(helper.includes("CARD_DRAG_THRESHOLD_PX"));
  assert.equal(/\bsetTimeout\b/.test(helper), false);
  assert.equal(/const\s+CARD_DRAG_THRESHOLD_PX\s*=/.test(helper), false);
  const idle = idleTapSuppression();
  assert.equal(idle.armed, false);
  assert.equal(consumeSyntheticClickAfterDrag(idle).consume, false);
});

console.log(`${passed} passed`);
