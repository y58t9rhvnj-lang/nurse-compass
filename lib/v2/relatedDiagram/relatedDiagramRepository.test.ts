/**
 * Persistence P2 — related_diagram_records route_scene repository contract.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramRepository.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptySemanticGraph } from "./semanticGraph";
import {
  RELATED_DIAGRAM_SELECT_COLUMNS,
  buildRelatedDiagramInsertRow,
  buildRelatedDiagramUpdatePatch,
  mapRelatedDiagramRow,
  type RelatedDiagramRow,
} from "./relatedDiagramRecord";
import { ROUTE_SCENE_SCHEMA, serializeRouteScene } from "./routeScene";
import { emptyRouteTopology } from "./routeTopology";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import type { RelatedDiagramSemanticGraph } from "./types";

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

const GRAPH: RelatedDiagramSemanticGraph = {
  ...createEmptySemanticGraph(),
  semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
};

const SCENE = serializeRouteScene({
  graph: GRAPH,
  routeState: {
    byId: {},
    lastValidPoints: {},
    invalidReasons: {},
    bridges: [],
  },
  topology: emptyRouteTopology(),
});

function rowOf(overrides: Partial<RelatedDiagramRow> = {}): RelatedDiagramRow {
  return {
    id: "rd-1",
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    assessment_cycle_id: null,
    status: "draft",
    canvas_schema_version: "1",
    knowledge_group_id: null,
    knowledge_version: null,
    semantic_graph: GRAPH,
    route_scene: null,
    version: 1,
    created_at: "2026-09-24T00:00:00.000Z",
    updated_at: "2026-09-24T00:00:00.000Z",
    ...overrides,
  };
}

function fakeRepo() {
  const store: RelatedDiagramRow[] = [];
  return {
    store,
    get(userId: string, caseId: string) {
      const found = store.find((row) => row.user_id === userId && row.case_id === caseId);
      return { row: found ?? null, error: null };
    },
    insert(values: Parameters<typeof buildRelatedDiagramInsertRow>[0]) {
      const payload = buildRelatedDiagramInsertRow(values);
      const row = rowOf({
        user_id: payload.user_id as string,
        organization_id: payload.organization_id as string,
        academic_year: payload.academic_year as number,
        case_id: payload.case_id as string,
        semantic_graph: payload.semantic_graph as RelatedDiagramSemanticGraph,
        route_scene: (payload.route_scene as unknown | null) ?? null,
        version: payload.version as number,
      });
      store.push(row);
      return { row, error: null, payload };
    },
    update(params: Parameters<typeof buildRelatedDiagramUpdatePatch>[0]) {
      const found = store.find(
        (row) =>
          row.user_id === params.userId &&
          row.case_id === params.caseId &&
          row.version === params.expectedVersion,
      );
      if (!found) return { row: null, error: null, patch: null, conflict: true };
      const patch = buildRelatedDiagramUpdatePatch(params);
      const next: RelatedDiagramRow = {
        ...found,
        semantic_graph: patch.semantic_graph as RelatedDiagramSemanticGraph,
        version: patch.version as number,
        updated_at: "2026-09-24T01:00:00.000Z",
      };
      if ("route_scene" in patch) {
        next.route_scene = patch.route_scene as unknown | null;
      }
      store.splice(store.indexOf(found), 1, next);
      return { row: next, error: null, patch, conflict: false };
    },
  };
}

test("A row with route_scene null → read success", () => {
  const mapped = mapRelatedDiagramRow(rowOf({ route_scene: null }));
  assert.equal(mapped.routeScene, null);
  assert.equal(mapped.semanticGraph, GRAPH);
  assert.equal(mapped.version, 1);
});

test("B insert with null → payload normal", () => {
  const repo = fakeRepo();
  const result = repo.insert({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
  });
  assert.equal(result.payload.route_scene, null);
  assert.equal(result.row.route_scene, null);
  assert.equal(result.payload.version, 1);
  assert.deepEqual(result.payload.semantic_graph, createEmptySemanticGraph());
});

test("C insert with routeScene v1 → JSON kept", () => {
  const repo = fakeRepo();
  const result = repo.insert({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    semantic_graph: GRAPH,
    route_scene: SCENE,
  });
  assert.equal(result.payload.route_scene, SCENE);
  assert.equal((result.row.route_scene as { schema: string }).schema, ROUTE_SCENE_SCHEMA);
});

test("D update null → v1 updates semantic + routeScene together", () => {
  const repo = fakeRepo();
  repo.insert({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    semantic_graph: GRAPH,
    route_scene: null,
  });
  const nextGraph = { ...GRAPH, cards: GRAPH.cards };
  const result = repo.update({
    userId: "user-1",
    caseId: "case-1",
    expectedVersion: 1,
    semanticGraph: nextGraph,
    routeScene: SCENE,
  });
  assert.equal(result.conflict, false);
  assert.ok(result.patch);
  assert.equal("semantic_graph" in result.patch!, true);
  assert.equal("route_scene" in result.patch!, true);
  assert.equal(result.patch!.version, 2);
  assert.equal(result.row!.semantic_graph, nextGraph);
  assert.equal(result.row!.route_scene, SCENE);
  assert.equal(result.row!.version, 2);
});

test("E update v1 → changed v1 increments version", () => {
  const repo = fakeRepo();
  repo.insert({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    semantic_graph: GRAPH,
    route_scene: SCENE,
  });
  const changed = { ...SCENE, routes: [...SCENE.routes] };
  const result = repo.update({
    userId: "user-1",
    caseId: "case-1",
    expectedVersion: 1,
    semanticGraph: GRAPH,
    routeScene: changed,
  });
  assert.equal(result.row!.version, 2);
  assert.equal(result.row!.route_scene, changed);
});

test("F optimistic conflict keeps existing contract", () => {
  const repo = fakeRepo();
  repo.insert({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    semantic_graph: GRAPH,
    route_scene: SCENE,
  });
  const result = repo.update({
    userId: "user-1",
    caseId: "case-1",
    expectedVersion: 9,
    semanticGraph: GRAPH,
    routeScene: SCENE,
  });
  assert.equal(result.conflict, true);
  assert.equal(result.row, null);
  assert.equal(repo.store[0]!.version, 1);
  assert.equal(repo.store[0]!.route_scene, SCENE);
});

test("G routeScene JSON is not transformed", () => {
  const payload = { schema: "rd.routeScene.v1", schemaVersion: 1, extra: { keep: true }, routes: [], topology: emptyRouteTopology() };
  const insert = buildRelatedDiagramInsertRow({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    route_scene: payload,
  });
  assert.equal(insert.route_scene, payload);
  const patch = buildRelatedDiagramUpdatePatch({
    userId: "user-1",
    caseId: "case-1",
    expectedVersion: 1,
    semanticGraph: GRAPH,
    routeScene: payload,
  });
  assert.equal(patch.route_scene, payload);
});

test("H repository / record do not call routers or P1 restore", () => {
  const record = src("./relatedDiagramRecord.ts");
  const repo = src("./relatedDiagramRepository.ts");
  for (const name of [
    "restoreRouteScene",
    "serializeRouteScene",
    "classifyRouteInteractions",
    "decideStudentConnectionRoute",
    "planLightweightInitialRoutes",
    "seedInitialAutoRouteState",
    "applyLightweightCardDrop",
    "applyStudentAutoQualityReroute",
    "findRectilinearPath",
    "planOrthogonalRoutes",
  ]) {
    assert.equal(record.includes(name), false, `record ${name}`);
    assert.equal(repo.includes(name), false, `repo ${name}`);
  }
});

test("I semantic_graph-only update does not clear route_scene", () => {
  const repo = fakeRepo();
  repo.insert({
    user_id: "user-1",
    organization_id: "org-1",
    academic_year: 2026,
    case_id: "case-1",
    semantic_graph: GRAPH,
    route_scene: SCENE,
  });
  const patch = buildRelatedDiagramUpdatePatch({
    userId: "user-1",
    caseId: "case-1",
    expectedVersion: 1,
    semanticGraph: GRAPH,
  });
  assert.equal("route_scene" in patch, false);
  const result = repo.update({
    userId: "user-1",
    caseId: "case-1",
    expectedVersion: 1,
    semanticGraph: GRAPH,
  });
  assert.equal(result.row!.route_scene, SCENE);
  assert.equal(result.row!.version, 2);
});

test("select list includes route_scene; RLS/policy files stay row-level", () => {
  assert.ok(RELATED_DIAGRAM_SELECT_COLUMNS.includes("route_scene"));
  assert.ok(RELATED_DIAGRAM_SELECT_COLUMNS.includes("semantic_graph"));
  const migration = src("../../../supabase/migrations/0031_related_diagram_route_scene.sql");
  assert.ok(migration.includes("add column if not exists route_scene jsonb null"));
  assert.equal(migration.includes("NOT NULL"), false);
  assert.equal(/update\s+public\./i.test(migration), false);
  assert.equal(/set\s+route_scene/i.test(migration), false);
  assert.equal(src("../../../supabase/migrations/0030_related_diagram_v1_schema.sql").includes("route_scene"), false);
  const editor = src("../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx");
  assert.equal(editor.includes("route_scene"), false);
  assert.equal(editor.includes("getRelatedDiagram"), false);
  const readonly = src("../../../app/v2/actions/relatedDiagramReadonly.ts");
  assert.equal(readonly.includes("route_scene"), false);
  assert.equal(src("./semanticGraph.ts").includes("route_scene"), false);
  assert.equal(src("./routeScene.ts").includes("related_diagram_records"), false);
});

console.log(`\n${passed} passed`);
