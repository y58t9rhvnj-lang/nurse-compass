/**
 * Manual Route Editing V1 — gesture ownership MRE-U…AC.
 * Run: node_modules/.bin/jiti lib/v2/relatedDiagram/diagramGestureOwnership.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyEscape,
  applyPointerDownOnCard,
  applyPointerMove,
  applyPointerUp,
  applySecondTouch,
  CARD_DRAG_THRESHOLD_PX,
  createIdleState,
} from "./cardInteractionState";
import {
  applyConnectionRoutePointerDown,
  applyConnectionRoutePointerMove,
  applyConnectionRoutePointerUp,
  applyConnectionRouteSecondPointer,
  CONNECTION_ROUTE_DRAG_THRESHOLD_PX,
} from "./connectionRouteGesture";
import {
  applyViewportOwnedPointerDown,
  applyViewportOwnedPointerMove,
  applyViewportOwnedPointerUp,
  createIdleViewportOwnership,
  viewportShouldApplyTransform,
  type ViewportOwnershipState,
} from "./diagramGestureOwnership";
import {
  commitManualRouteEdit,
  dragOrthogonalSegment,
} from "./manualRouteEdit";
import { emptyRouteTopology } from "./routeTopology";
import { pointsDeepEqual, type StableRouteState } from "./incrementalRoutes";
import type { RelatedDiagramConnection } from "./types";

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

const JOG = [
  { x: 240, y: 236 },
  { x: 360, y: 236 },
  { x: 360, y: 140 },
  { x: 520, y: 140 },
  { x: 520, y: 236 },
];

const connection: RelatedDiagramConnection = {
  id: "cn_ab",
  sourceCardId: "a",
  targetCardId: "b",
  relationType: "current",
  origin: "student_diagram",
  createdAt: "2026-09-22T00:00:00.000Z",
  updatedAt: "2026-09-22T00:00:00.000Z",
};

function routeStateOf(points = JOG): StableRouteState {
  return {
    byId: {
      cn_ab: {
        connectionId: "cn_ab",
        sourceCardId: "a",
        targetCardId: "b",
        sourceEdge: "right",
        targetEdge: "left",
        sourcePin: { ...points[0]! },
        targetPin: { ...points[points.length - 1]! },
        points: points.map((point) => ({ ...point })),
      },
    },
    lastValidPoints: { cn_ab: points.map((point) => ({ ...point })) },
    invalidReasons: {},
    bridges: [],
    qualityTrace: {},
  };
}

function startViewport() {
  return createIdleViewportOwnership({ scale: 1, x: 40, y: 80 });
}

function transformOf(state: ViewportOwnershipState) {
  return { ...state.transform };
}

test("MRE-U connection上1 pointer tap → select, viewport exact", () => {
  let viewport = startViewport();
  const origin = transformOf(viewport);
  const down = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 300,
    clientY: 236,
    pointerType: "touch",
    target: "connection",
  });
  viewport = down.state;
  assert.equal(down.handoffToViewport, false);
  assert.equal(down.capture, false);
  let gesture = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: null,
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  const moved = applyViewportOwnedPointerMove(viewport, {
    pointerId: 1,
    clientX: 301,
    clientY: 236,
  });
  viewport = moved.state;
  assert.equal(moved.applied, false);
  const up = applyConnectionRoutePointerUp(gesture, 1, 1);
  viewport = applyViewportOwnedPointerUp(viewport, 1);
  assert.equal(up.commit?.kind, "tap");
  assert.deepEqual(viewport.transform, origin);
});

test("MRE-V connection上1 pointer small move → select, viewport exact", () => {
  let viewport = startViewport();
  const origin = transformOf(viewport);
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 300,
    clientY: 236,
    pointerType: "touch",
    target: "connection",
  }).state;
  let gesture = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: "cn_ab",
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  gesture = applyConnectionRoutePointerMove(gesture, {
    pointerId: 1,
    clientX: 300 + CONNECTION_ROUTE_DRAG_THRESHOLD_PX - 1,
    clientY: 236,
    pointerCount: 1,
  });
  const moved = applyViewportOwnedPointerMove(viewport, {
    pointerId: 1,
    clientX: 300 + CONNECTION_ROUTE_DRAG_THRESHOLD_PX - 1,
    clientY: 236,
  });
  assert.equal(moved.applied, false);
  assert.equal(gesture.phase, "pressing");
  const up = applyConnectionRoutePointerUp(gesture, 1, 1);
  assert.equal(up.commit?.kind, "tap");
  assert.deepEqual(moved.state.transform, origin);
});

test("MRE-W selected segment 1 pointer drag → route only, viewport exact", () => {
  let viewport = startViewport();
  const origin = transformOf(viewport);
  const before = routeStateOf();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 300,
    clientY: 236,
    pointerType: "touch",
    target: "connection",
  }).state;
  let gesture = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: "cn_ab",
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  gesture = applyConnectionRoutePointerMove(gesture, {
    pointerId: 1,
    clientX: 300,
    clientY: 236 + CONNECTION_ROUTE_DRAG_THRESHOLD_PX + 20,
    pointerCount: 1,
  });
  const moved = applyViewportOwnedPointerMove(viewport, {
    pointerId: 1,
    clientX: 300,
    clientY: 256,
  });
  assert.equal(gesture.phase, "dragging");
  assert.equal(moved.applied, false);
  const up = applyConnectionRoutePointerUp(gesture, 1, 1);
  assert.equal(up.commit?.kind, "drag");
  const committed = commitManualRouteEdit({
    connection,
    routeState: before,
    topology: emptyRouteTopology(),
    points: dragOrthogonalSegment({
      points: JOG,
      segmentIndex: up.commit!.kind === "drag" ? up.commit.segmentIndex : 0,
      deltaX: up.commit!.kind === "drag" ? up.commit.deltaX : 0,
      deltaY: up.commit!.kind === "drag" ? up.commit.deltaY : 0,
    }),
  });
  assert.equal(
    pointsDeepEqual(committed.routeState.byId.cn_ab!.points, JOG),
    false,
  );
  assert.deepEqual(moved.state.transform, origin);
});

test("MRE-X connection gesture中に2本目 → cancel + viewportへ", () => {
  let viewport = startViewport();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 300,
    clientY: 236,
    pointerType: "touch",
    target: "connection",
  }).state;
  let gesture = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: null,
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  const second = applyViewportOwnedPointerDown(viewport, {
    pointerId: 2,
    clientX: 380,
    clientY: 300,
    pointerType: "touch",
    target: "blank",
  });
  viewport = second.state;
  gesture = applyConnectionRouteSecondPointer(gesture);
  assert.equal(second.handoffToViewport, true);
  assert.equal(viewportShouldApplyTransform(2), true);
  assert.equal(gesture.phase, "cancelled");
  const up = applyConnectionRoutePointerUp(gesture, 1, 1);
  assert.equal(up.commit, null);
  const pinched = applyViewportOwnedPointerMove(viewport, {
    pointerId: 2,
    clientX: 460,
    clientY: 300,
  });
  assert.equal(pinched.applied, true);
  assert.notEqual(pinched.state.transform.scale, 1);
});

test("MRE-Y route drag中に2本目 → cancel, partialを確定しない", () => {
  const before = routeStateOf();
  let preview = before;
  let topology = emptyRouteTopology();
  let viewport = startViewport();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 300,
    clientY: 236,
    pointerType: "touch",
    target: "connection",
  }).state;
  let gesture = applyConnectionRoutePointerDown({
    pointerId: 1,
    pointerCount: 1,
    isPrimary: true,
    connectionId: "cn_ab",
    selectedConnectionId: "cn_ab",
    clientX: 300,
    clientY: 236,
    logicalPoint: { x: 300, y: 236 },
    points: JOG,
    connection,
    cardDragging: false,
  });
  gesture = applyConnectionRoutePointerMove(gesture, {
    pointerId: 1,
    clientX: 300,
    clientY: 280,
    pointerCount: 1,
  });
  const live = commitManualRouteEdit({
    connection,
    routeState: before,
    topology,
    points: dragOrthogonalSegment({
      points: JOG,
      segmentIndex: 0,
      deltaX: 0,
      deltaY: 44,
    }),
  });
  preview = live.routeState;
  assert.equal(pointsDeepEqual(preview.byId.cn_ab!.points, JOG), false);
  const second = applyViewportOwnedPointerDown(viewport, {
    pointerId: 2,
    clientX: 400,
    clientY: 320,
    pointerType: "touch",
    target: "blank",
  });
  gesture = applyConnectionRouteSecondPointer(gesture);
  preview = before;
  topology = emptyRouteTopology();
  const up = applyConnectionRoutePointerUp(gesture, 1, 1);
  assert.equal(up.commit, null);
  assert.equal(second.handoffToViewport, true);
  assert.ok(pointsDeepEqual(preview.byId.cn_ab!.points, JOG));
  assert.equal(topology.routes.length, 0);
});

test("MRE-Z card 1 pointer drag → card only, viewport exact", () => {
  let viewport = startViewport();
  const origin = transformOf(viewport);
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    pointerType: "touch",
    target: "card",
  }).state;
  let card = applyPointerDownOnCard(createIdleState(), {
    cardId: "a",
    movable: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    originX: 80,
    originY: 200,
    cardWidth: 160,
    cardHeight: 72,
  });
  card = applyPointerMove(card, {
    pointerId: 1,
    clientX: 100 + CARD_DRAG_THRESHOLD_PX + 10,
    clientY: 100,
    scale: 1,
  });
  const moved = applyViewportOwnedPointerMove(viewport, {
    pointerId: 1,
    clientX: 120,
    clientY: 100,
  });
  assert.equal(card.phase, "CARD_DRAGGING");
  assert.equal(moved.applied, false);
  assert.deepEqual(moved.state.transform, origin);
  const up = applyPointerUp(card, { pointerId: 1 });
  assert.ok(up.drop);
});

test("MRE-AA card gesture中に2本目 → card cancel + viewportへ", () => {
  let viewport = startViewport();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    pointerType: "touch",
    target: "card",
  }).state;
  let card = applyPointerDownOnCard(createIdleState(), {
    cardId: "a",
    movable: true,
    pointerId: 1,
    pointerType: "touch",
    clientX: 100,
    clientY: 100,
    originX: 80,
    originY: 200,
    cardWidth: 160,
    cardHeight: 72,
  });
  const handoff = applySecondTouch(card);
  const second = applyViewportOwnedPointerDown(viewport, {
    pointerId: 2,
    clientX: 180,
    clientY: 160,
    pointerType: "touch",
    target: "blank",
  });
  assert.equal(handoff.state.phase, "VIEWPORT_GESTURE");
  assert.equal(second.handoffToViewport, true);
  const pinched = applyViewportOwnedPointerMove(second.state, {
    pointerId: 2,
    clientX: 240,
    clientY: 160,
  });
  assert.equal(pinched.applied, true);
});

test("MRE-AB 2 pointer pinch → scale変化, geometry変更なし", () => {
  const before = routeStateOf();
  let viewport = startViewport();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    pointerType: "touch",
    target: "blank",
  }).state;
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 2,
    clientX: 280,
    clientY: 200,
    pointerType: "touch",
    target: "blank",
  }).state;
  const next = applyViewportOwnedPointerMove(viewport, {
    pointerId: 2,
    clientX: 360,
    clientY: 200,
  });
  assert.equal(next.applied, true);
  assert.ok(next.state.transform.scale > 1);
  assert.ok(pointsDeepEqual(before.byId.cn_ab!.points, JOG));
});

test("MRE-AC 2 pointer pan → viewportのみ", () => {
  let viewport = startViewport();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    pointerType: "touch",
    target: "blank",
  }).state;
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 2,
    clientX: 280,
    clientY: 200,
    pointerType: "touch",
    target: "blank",
  }).state;
  const startScale = viewport.transform.scale;
  const next = applyViewportOwnedPointerMove(viewport, {
    pointerId: 1,
    clientX: 260,
    clientY: 260,
  });
  const next2 = applyViewportOwnedPointerMove(next.state, {
    pointerId: 2,
    clientX: 340,
    clientY: 260,
  });
  assert.equal(next2.applied, true);
  assert.ok(Math.abs(next2.state.transform.scale - startScale) < 0.02);
  assert.notEqual(next2.state.transform.x, 40);
  assert.notEqual(next2.state.transform.y, 80);
});

test("1 pointer move is never a zoom", () => {
  assert.equal(viewportShouldApplyTransform(1), false);
  assert.equal(viewportShouldApplyTransform(0), false);
  assert.equal(viewportShouldApplyTransform(2), true);
  let viewport = startViewport();
  viewport = applyViewportOwnedPointerDown(viewport, {
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    pointerType: "touch",
    target: "connection",
  }).state;
  const moved = applyViewportOwnedPointerMove(viewport, {
    pointerId: 1,
    clientX: 280,
    clientY: 280,
  });
  assert.equal(moved.applied, false);
  assert.equal(moved.state.transform.scale, 1);
});

test("source scan: viewport uses ownership, connection isolates", () => {
  const viewport = src("../../../components/v2/relatedDiagram/useA3Viewport.ts");
  const hook = src(
    "../../../components/v2/relatedDiagram/useConnectionRouteInteraction.ts",
  );
  const layer = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
  );
  assert.ok(viewport.includes("applyViewportOwnedPointerDown"));
  assert.ok(viewport.includes("classifyDiagramPointerTarget"));
  assert.equal(viewport.includes("beginTwoFinger("), false);
  assert.ok(hook.includes("isolateDiagramOwnedPointer"));
  assert.ok(hook.includes("releasePointerCapture"));
  assert.ok(layer.includes('touchAction: "none"'));
  void applyEscape;
});

console.log(`${passed} passed`);
