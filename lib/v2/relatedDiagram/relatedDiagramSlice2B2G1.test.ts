/**
 * Slice 2B-2G-1 Connection Manage Phase 1 tests.
 * Selection / hit / halo / popover only. No mutation.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSlice2B2G1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyActionPopoverPointer } from "./actionPopoverGesture";
import { STUDENT_CONNECTION_RELATION_LABELS } from "./cardConnectionCreate";
import {
  applyConnectionTapPointerDown,
  applyConnectionTapPointerUp,
  applyConnectionTapSecondPointer,
  cardIdAtPoint,
  CONNECTION_HALO_EXTRA_PX,
  CONNECTION_HALO_STROKE,
  CONNECTION_HIT_RADIUS_PX,
  CONNECTION_HIT_STROKE_PX,
  connectionHaloStrokeWidth,
  connectionHasManageActions,
  connectionPermissions,
  isProtectedConnection,
  PROTECTED_CONNECTION_NOTICE,
  connectionTapAnchorRect,
  createIdleConnectionTap,
  exclusiveDiagramSelection,
  isStudentManageableConnection,
  listConnectionHitCoverage,
  pickSelectableConnectionAtPoint,
} from "./cardConnectionManage";
import { seedStableRouteState } from "./incrementalRoutes";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import {
  connectionDiagramSelection,
  connectionSelectionReady,
  emptyDiagramSelection,
  isConnectionSelected,
  selectedConnectionIdFromSelection,
} from "./diagramSelection";
import { emptyDiagramHistory } from "./diagramHistory";
import { resolveRelatedDiagramEditorMode } from "./editorUiState";
import { resolveConnectionStrokeVisual } from "./visualStyle";
import type {
  RelatedDiagramCard,
  RelatedDiagramConnection,
  RelatedDiagramConnectionOrigin,
  RelatedDiagramConnectionRelationType,
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

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

const ws = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
);
const layer = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
);
const surface = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramA3Surface.tsx",
);
const popover = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramActionPopover.tsx",
);
const actionBar = src(
  "../../../components/v2/relatedDiagram/RelatedDiagramConnectionActionBar.tsx",
);
const createLib = src("./cardConnectionCreate.ts");
const manageLib = src("./cardConnectionManage.ts");
const historyLib = src("./diagramHistory.ts");
const visualLib = src("./visualStyle.ts");
const routingLib = src("./orthogonalRouting.ts");
const incrementalLib = src("./incrementalRoutes.ts");

function card(id: string, x: number, y: number): RelatedDiagramCard {
  return {
    id,
    cardType: "understanding",
    text: id,
    state: "current",
    origin: "direct_insight",
    layout: { x, y, width: 160, height: 72, zIndex: 1 },
    isLocked: false,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

function conn(
  id: string,
  sourceCardId: string,
  targetCardId: string,
  relationType: RelatedDiagramConnectionRelationType,
  origin: RelatedDiagramConnectionOrigin = "student_diagram",
): RelatedDiagramConnection {
  return {
    id,
    sourceCardId,
    targetCardId,
    relationType,
    origin,
    createdAt: "2026-09-19T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
  };
}

const cards = [card("a", 40, 40), card("b", 400, 40), card("c", 40, 220)];
const studentCurrent = conn("cn_cur", "a", "b", "current");
const studentPotential = conn("cn_pot", "a", "c", "potential");
const studentTreatment = conn("cn_treat", "b", "c", "treatment");
const basis = conn("cn_basis", "a", "c", "nursing_problem_basis");
const integration = conn(
  "cn_integ",
  "a",
  "b",
  "nursing_problem_integration",
  "system_integration",
);
const knowledge = conn("cn_know", "a", "b", "current", "knowledge_library");
const systemCurrent = conn("cn_sys", "a", "b", "current", "system_integration");

const routes = [
  {
    connectionId: "cn_cur",
    points: [
      { x: 200, y: 76 },
      { x: 400, y: 76 },
    ],
  },
  {
    connectionId: "cn_pot",
    points: [
      { x: 120, y: 112 },
      { x: 120, y: 220 },
    ],
  },
  {
    connectionId: "cn_treat",
    points: [
      { x: 480, y: 112 },
      { x: 480, y: 220 },
      { x: 200, y: 220 },
    ],
  },
  {
    connectionId: "cn_cross_a",
    points: [
      { x: 100, y: 300 },
      { x: 300, y: 300 },
    ],
  },
  {
    connectionId: "cn_cross_b",
    points: [
      { x: 200, y: 200 },
      { x: 200, y: 400 },
    ],
  },
];

const connections = [
  studentCurrent,
  studentPotential,
  studentTreatment,
  basis,
  integration,
  knowledge,
  systemCurrent,
  conn("cn_cross_a", "a", "b", "current"),
  conn("cn_cross_b", "a", "c", "potential"),
];

test("A student current tap → selected", () => {
  const picked = pickSelectableConnectionAtPoint({
    point: { x: 280, y: 76 },
    cards,
    connections,
    routes,
  });
  assert.equal(picked?.connectionId, "cn_cur");
  const selection = exclusiveDiagramSelection({
    connectionId: picked?.connectionId,
  });
  assert.equal(selection.kind, "connection");
  assert.equal(isConnectionSelected(selection, "cn_cur"), true);
  assert.equal(connectionSelectionReady("cn_cur"), true);
});

test("B student potential tap → selected", () => {
  const picked = pickSelectableConnectionAtPoint({
    point: { x: 120, y: 160 },
    cards,
    connections,
    routes,
  });
  assert.equal(picked?.connectionId, "cn_pot");
});

test("C student treatment tap → selected", () => {
  const picked = pickSelectableConnectionAtPoint({
    point: { x: 480, y: 160 },
    cards,
    connections,
    routes,
  });
  assert.equal(picked?.connectionId, "cn_treat");
});

test("D Card selection exclusive", () => {
  const cardSel = exclusiveDiagramSelection({ cardId: "a", connectionId: null });
  const connSel = exclusiveDiagramSelection({
    cardId: "a",
    connectionId: "cn_cur",
  });
  assert.equal(cardSel.kind, "card");
  assert.equal(connSel.kind, "connection");
  assert.equal(selectedConnectionIdFromSelection(cardSel), null);
  assert.ok(ws.includes("if (!selectedCardId) return"));
  assert.ok(ws.includes("setSelectedConnectionId(null)"));
  assert.ok(ws.includes("selectCard(null)"));
});

test("E blank → none", () => {
  assert.deepEqual(exclusiveDiagramSelection({}), emptyDiagramSelection());
  assert.ok(ws.includes("clearConnectionSelection"));
  assert.ok(ws.includes("handleSurfacePointerDownWrapped"));
});

test("F other Connection switches selection", () => {
  const first = exclusiveDiagramSelection({ connectionId: "cn_cur" });
  const next = exclusiveDiagramSelection({ connectionId: "cn_pot" });
  assert.equal(isConnectionSelected(first, "cn_cur"), true);
  assert.equal(isConnectionSelected(next, "cn_pot"), true);
  assert.equal(isConnectionSelected(next, "cn_cur"), false);
});

test("G selection history 0", () => {
  assert.equal(emptyDiagramHistory().past.length, 0);
  assert.equal(ws.includes('type: "selectConnection"'), false);
  assert.equal(historyLib.includes("selectConnection"), false);
});

test("Student permissions", () => {
  const permissions = connectionPermissions(studentCurrent);
  assert.equal(isStudentManageableConnection(studentCurrent), true);
  assert.deepEqual(permissions, {
    selectable: true,
    relationEditable: true,
    reversible: true,
    deletable: true,
  });
});

test("Knowledge permissions", () => {
  assert.deepEqual(connectionPermissions(knowledge), {
    selectable: true,
    relationEditable: false,
    reversible: false,
    deletable: true,
  });
});

test("System integration permissions", () => {
  assert.deepEqual(connectionPermissions(integration), {
    selectable: true,
    relationEditable: false,
    reversible: false,
    deletable: false,
  });
  assert.deepEqual(connectionPermissions(systemCurrent), {
    selectable: true,
    relationEditable: false,
    reversible: false,
    deletable: false,
  });
});

test("nursing_problem_basis is selectable but not student-editable", () => {
  assert.equal(isStudentManageableConnection(basis), false);
  assert.deepEqual(connectionPermissions(basis), {
    selectable: true,
    relationEditable: false,
    reversible: false,
    deletable: false,
  });
  const picked = pickSelectableConnectionAtPoint({
    point: { x: 120, y: 160 },
    cards,
    connections: [basis],
    routes: [
      {
        connectionId: "cn_basis",
        points: [
          { x: 120, y: 112 },
          { x: 120, y: 220 },
        ],
      },
    ],
  });
  assert.equal(picked?.connectionId, "cn_basis");
});

test("L current thin line visual unchanged", () => {
  const visual = resolveConnectionStrokeVisual("current");
  assert.equal(visual.strokeWidthPx, 1.5);
  assert.equal(visual.dasharray, null);
  assert.equal(visual.stroke, "#1D1D1F");
});

test("M potential dashed visual unchanged", () => {
  const visual = resolveConnectionStrokeVisual("potential");
  assert.equal(visual.dasharray, "5 4");
  assert.equal(visual.strokeWidthPx, 1.25);
});

test("N treatment thick visual unchanged", () => {
  const visual = resolveConnectionStrokeVisual("treatment");
  assert.ok(visual.strokeWidthPx >= 3);
  assert.equal(visual.marker, "arrow-thick");
});

test("O transparent 24px hit target", () => {
  assert.equal(CONNECTION_HIT_STROKE_PX, 24);
  assert.equal(CONNECTION_HIT_RADIUS_PX, 12);
  assert.ok(layer.includes("CONNECTION_HIT_STROKE_PX"));
  assert.ok(layer.includes('stroke="transparent"'));
  assert.ok(layer.includes('pointerEvents="stroke"'));
  assert.ok(layer.includes("data-rd-connection-hit"));
});

test("P visible stroke width unchanged", () => {
  assert.ok(layer.includes("strokeWidth={stroke.strokeWidthPx}"));
  assert.equal(visualLib.includes("strokeWidthPx: 1.5"), true);
  assert.ok(layer.includes("className=\"pointer-events-none absolute inset-0\""));
});

test("Q Bridge neighborhood hit", () => {
  assert.ok(layer.includes("data-rd-bridge-hit"));
  assert.ok(layer.includes("hopArcPathD(entry.hop)"));
  assert.ok(layer.includes("data-rd-bridge-arc"));
});

test("R crossing nearest is deterministic", () => {
  const crossing = pickSelectableConnectionAtPoint({
    point: { x: 206, y: 300 },
    cards,
    connections,
    routes,
  });
  assert.equal(crossing?.connectionId, "cn_cross_a");
  const vertical = pickSelectableConnectionAtPoint({
    point: { x: 200, y: 360 },
    cards,
    connections,
    routes,
  });
  assert.equal(vertical?.connectionId, "cn_cross_b");
  const tie = pickSelectableConnectionAtPoint({
    point: { x: 200, y: 300 },
    cards,
    connections,
    routes,
  });
  assert.equal(tie?.connectionId, "cn_cross_a");
});

test("S Card overlap prefers Card", () => {
  assert.equal(cardIdAtPoint({ x: 50, y: 50 }, cards), "a");
  assert.equal(
    pickSelectableConnectionAtPoint({
      point: { x: 50, y: 50 },
      cards,
      connections,
      routes: [
        {
          connectionId: "cn_cur",
          points: [
            { x: 40, y: 50 },
            { x: 200, y: 50 },
          ],
        },
      ],
    }),
    null,
  );
  assert.ok(surface.includes("RelatedDiagramCardNode"));
  assert.ok(surface.includes("RelatedDiagramConnectionLayer"));
});

test("T first + second finger does not commit", () => {
  const down = applyConnectionTapPointerDown(createIdleConnectionTap(), {
    pointerId: 1,
    connectionId: "cn_cur",
    clientX: 10,
    clientY: 20,
    pointerCount: 1,
  });
  assert.equal(down.phase, "pressing");
  const cancelled = applyConnectionTapSecondPointer(down);
  assert.equal(cancelled.phase, "cancelled");
  const up = applyConnectionTapPointerUp(cancelled, 1);
  assert.equal(up.commit, null);
});

test("U pinch / 2-finger dismiss", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "connection",
      pointerCount: 2,
      targetIsPopover: true,
    }),
    "dismiss-gesture",
  );
  assert.ok(ws.includes("applyConnectionTapSecondPointer"));
});

test("V pointerup after cancel is not a tap", () => {
  const down = applyConnectionTapPointerDown(createIdleConnectionTap(), {
    pointerId: 7,
    connectionId: "cn_cur",
    clientX: 1,
    clientY: 1,
  });
  const cancelled = applyConnectionTapSecondPointer(down);
  const late = applyConnectionTapPointerUp(cancelled, 7);
  assert.equal(late.commit, null);
  assert.equal(late.state.phase, "idle");
});

test("W halo only when selected", () => {
  assert.ok(layer.includes("selectedConnectionId === conn.id"));
  assert.ok(layer.includes("data-rd-connection-halo"));
  assert.ok(layer.includes("selected ? ("));
});

test("X halo monochrome", () => {
  assert.equal(CONNECTION_HALO_STROKE, "#1D1D1F");
  assert.ok(layer.includes("CONNECTION_HALO_STROKE"));
  assert.equal(layer.includes("data-rd-connection-halo") && layer.includes("#0A5FCC"), false);
});

test("Y relation visible style unchanged by halo", () => {
  assert.equal(connectionHaloStrokeWidth(1.5), 1.5 + CONNECTION_HALO_EXTRA_PX);
  assert.ok(layer.includes("connectionHaloStrokeWidth(stroke.strokeWidthPx)"));
  assert.ok(layer.includes("strokeDasharray={stroke.dasharray ?? undefined}"));
});

test("Z halo / hit rd-no-print", () => {
  assert.ok(layer.includes('className="rd-no-print"'));
  assert.ok(layer.includes("data-rd-connection-halo"));
  assert.ok(layer.includes("data-rd-connection-hit"));
});

test("AA connection kind", () => {
  assert.ok(popover.includes('"connection"'));
  assert.ok(ws.includes('kind="connection"'));
  assert.equal(
    classifyActionPopoverPointer({
      kind: "connection",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "dismiss-outside",
  );
});

test("AB tap point anchor", () => {
  const rect = connectionTapAnchorRect(120, 80);
  assert.equal(rect.x + rect.width / 2, 120);
  assert.equal(rect.y + rect.height / 2, 80);
  assert.ok(ws.includes("connectionTapAnchorRect"));
});

test("AC current → 顕在 selected", () => {
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.current, "顕在");
  assert.ok(actionBar.includes("STUDENT_CONNECTION_RELATION_LABELS"));
  assert.ok(actionBar.includes("data-rd-connection-relation-choice={value}"));
  assert.ok(actionBar.includes("aria-pressed={selected}"));
});

test("AD potential → 潜在 selected", () => {
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.potential, "潜在");
  assert.ok(actionBar.includes("selected = value === relation"));
});

test("AE treatment → 治療 selected", () => {
  assert.equal(STUDENT_CONNECTION_RELATION_LABELS.treatment, "治療");
});

test("AF reverse shown", () => {
  assert.ok(actionBar.includes("向きを反転"));
  assert.ok(actionBar.includes('data-rd-connection-action="reverse"'));
});

test("AG delete shown subdued red", () => {
  assert.ok(actionBar.includes("削除"));
  assert.ok(actionBar.includes('data-rd-connection-action="delete"'));
  assert.ok(actionBar.includes("text-[#C41E3A]"));
});

test("AH outside dismiss", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "connection",
      pointerCount: 1,
      targetIsPopover: true,
    }),
    "ignore",
  );
  assert.ok(ws.includes("onDismiss={clearConnectionSelection}"));
});

test("AI gesture dismiss", () => {
  assert.equal(
    classifyActionPopoverPointer({
      kind: "card",
      pointerCount: 1,
      targetIsPopover: false,
    }),
    "ignore",
  );
});

test("AJ popover does not change A3 transform", () => {
  assert.ok(ws.includes("kind=\"connection\""));
  assert.ok(ws.includes("RelatedDiagramActionPopover"));
  assert.equal(ws.includes("setTransform("), false);
  assert.ok(popover.includes("fixed"));
});

test("AK relation mutation wired for student only", () => {
  const open = ws.slice(
    ws.indexOf("<RelatedDiagramConnectionActionBar"),
    ws.indexOf("</RelatedDiagramConnectionActionBar>"),
  );
  assert.ok(open.includes("relation={selectedConnection.relationType}"));
  assert.ok(open.includes("onChangeRelation"));
  assert.ok(open.includes("relationEditable"));
  assert.ok(ws.includes("handleStudentConnectionRelationChange"));
  assert.equal(ws.includes("handleEditConnection"), false);
  assert.equal(ws.includes("upsertConnection("), false);
});

test("AL connection delete wired without 2E-1 names", () => {
  const open = ws.slice(
    ws.indexOf("<RelatedDiagramConnectionActionBar"),
    ws.indexOf("</RelatedDiagramConnectionActionBar>"),
  );
  assert.ok(open.includes("onDelete"));
  assert.ok(open.includes("deletable"));
  assert.ok(ws.includes("handleManagedConnectionDelete"));
  assert.equal(ws.includes("handleDeleteConnection"), false);
});

test("AM reverse is gated by reversible", () => {
  const open = ws.slice(
    ws.indexOf("<RelatedDiagramConnectionActionBar"),
    ws.indexOf("</RelatedDiagramConnectionActionBar>"),
  );
  assert.ok(open.includes("onReverse"));
  assert.ok(open.includes("connectionPermissions(selectedConnection).reversible"));
  assert.ok(ws.includes("handleStudentConnectionReverse"));
});

test("AN no routeState mutation on manage", () => {
  assert.equal(manageLib.includes("planOrthogonalRoutes"), false);
  assert.equal(manageLib.includes("applyIncremental"), false);
  assert.equal(ws.includes("setRouteState") && ws.includes("handleConnectionPointerDown") , true);
  assert.equal(manageLib.includes("setRouteState"), false);
});

test("AO no semanticGraph mutation on manage", () => {
  assert.equal(manageLib.includes("upsertConnection"), false);
  assert.equal(ws.includes("handleEditConnection"), false);
  assert.equal(createLib.includes("commitStudentConnectionCreate"), true);
});

test("editor mode connection_selected", () => {
  assert.equal(
    resolveRelatedDiagramEditorMode({
      selection: connectionDiagramSelection("cn_cur"),
      form3Open: false,
      editOpen: false,
      connecting: false,
    }),
    "connection_selected",
  );
});

test("print portal does not receive selection", () => {
  const printChunk = ws.slice(
    ws.indexOf("<RelatedDiagramPrintPortal>"),
    ws.indexOf("</RelatedDiagramPrintPortal>"),
  );
  assert.equal(printChunk.includes("selectedConnectionId"), false);
  assert.equal(printChunk.includes("onConnectionPointerDown"), false);
  assert.ok(surface.includes("interactive ? onConnectionPointerDown : undefined"));
});

test("Freeze: routing files not edited by manage module", () => {
  assert.equal(manageLib.includes("findRectilinearPath"), false);
  assert.equal(routingLib.includes("CONNECTION_HIT_STROKE_PX"), false);
  assert.equal(incrementalLib.includes("isStudentManageableConnection"), false);
});

test("2G-1 does not show stub copy", () => {
  assert.equal(actionBar.includes("未実装"), false);
  assert.equal(actionBar.includes("次のSlice"), false);
  assert.equal(ws.includes("未実装"), false);
});

test("Knowledge popover is delete-only", () => {
  assert.ok(actionBar.includes("permissions.deletable"));
  assert.ok(actionBar.includes("permissions.relationEditable"));
  assert.ok(actionBar.includes("permissions.reversible"));
  assert.equal(isProtectedConnection(knowledge), false);
  assert.equal(connectionHasManageActions(connectionPermissions(knowledge)), true);
  assert.equal(connectionPermissions(knowledge).relationEditable, false);
  assert.equal(connectionPermissions(knowledge).reversible, false);
  assert.equal(connectionPermissions(knowledge).deletable, true);
});

test("Student popover shows relation reverse delete", () => {
  const permissions = connectionPermissions(studentCurrent);
  assert.equal(permissions.relationEditable, true);
  assert.equal(permissions.reversible, true);
  assert.equal(permissions.deletable, true);
  assert.ok(actionBar.includes("data-rd-connection-relation-segments"));
  assert.ok(actionBar.includes('data-rd-connection-action="reverse"'));
  assert.ok(actionBar.includes('data-rd-connection-action="delete"'));
});

test("System popover has no mutation actions", () => {
  assert.equal(connectionHasManageActions(connectionPermissions(integration)), false);
  assert.equal(isProtectedConnection(integration), true);
});

test("Protected fixture IDs: basis and integration", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const basisConn = scene.graph.connections.find((row) => row.id === "demo_c_basis");
  const integConn = scene.graph.connections.find((row) => row.id === "demo_c_integ");
  assert.equal(basisConn?.origin, "student_diagram");
  assert.equal(basisConn?.relationType, "nursing_problem_basis");
  assert.equal(integConn?.origin, "system_integration");
  assert.equal(integConn?.relationType, "nursing_problem_integration");
  assert.equal(isProtectedConnection(basisConn!), true);
  assert.equal(isProtectedConnection(integConn!), true);
  assert.equal(connectionHasManageActions(connectionPermissions(basisConn!)), false);
  assert.equal(connectionHasManageActions(connectionPermissions(integConn!)), false);
});

test("Protected popover is read-only notice", () => {
  assert.equal(PROTECTED_CONNECTION_NOTICE, "この関係は自動的に管理されています");
  assert.ok(actionBar.includes("PROTECTED_CONNECTION_NOTICE"));
  assert.ok(actionBar.includes("data-rd-connection-protected-notice"));
  assert.ok(actionBar.includes("rd-no-print"));
  assert.ok(ws.includes("selectedConnection && connectionAnchor"));
  assert.equal(ws.includes("connectionHasManageActions("), false);
  assert.equal(isProtectedConnection(basis), true);
  assert.equal(isProtectedConnection(integration), true);
  assert.equal(isProtectedConnection(studentCurrent), false);
  assert.equal(isProtectedConnection(knowledge), false);
});

test("all visible routed fixture connections get hit coverage", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: true });
  const routeState = seedStableRouteState(
    scene.graph.cards,
    scene.graph.connections,
    scene.routeTopology,
  );
  const coverage = listConnectionHitCoverage({
    connections: scene.graph.connections,
    routes: Object.values(routeState.byId),
  });
  assert.ok(coverage.length > 0);
  const routed = coverage.filter((row) => row.hasRoute);
  assert.ok(routed.length > 0);
  assert.equal(
    routed.every((row) => row.visible && row.hit && row.permissions.selectable),
    true,
  );
  const studentLeaks = coverage.filter(
    (row) =>
      row.origin === "student_diagram" &&
      (row.relationType === "current" ||
        row.relationType === "potential" ||
        row.relationType === "treatment") &&
      row.hasRoute &&
      !row.hit,
  );
  assert.deepEqual(studentLeaks, []);
  const knowledgeRows = coverage.filter(
    (row) => row.origin === "knowledge_library",
  );
  assert.ok(knowledgeRows.length > 0);
  assert.equal(
    knowledgeRows.every((row) => row.hasRoute && row.hit),
    true,
  );
  assert.equal(layer.includes("isStudentManageableConnection"), false);
  assert.ok(layer.includes("connectionPermissions(conn).selectable"));
});

test("Knowledge delete is gated by deletable", () => {
  assert.ok(ws.includes("handleManagedConnectionDelete"));
  const open = ws.slice(
    ws.indexOf("<RelatedDiagramConnectionActionBar"),
    ws.indexOf("</RelatedDiagramConnectionActionBar>"),
  );
  assert.ok(open.includes("onDelete"));
  assert.ok(open.includes("connectionPermissions(selectedConnection).deletable"));
});

console.log(`\n${passed} passed`);
