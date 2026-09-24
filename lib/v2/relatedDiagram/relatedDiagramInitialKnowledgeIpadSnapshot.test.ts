/**
 * iPad-promoted Initial Knowledge V1 lock.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramInitialKnowledgeIpadSnapshot.test.ts
 */

import assert from "node:assert/strict";
import {
  SCHIZOPHRENIA_KNOWLEDGE_CARDS,
  SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import { buildSchizophreniaKnowledgeTopology } from "./fixtures/schizophreniaRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { loadRelatedDiagramDraft } from "./relatedDiagramDraftPersistence";
import { createMemoryRelatedDiagramDraftStore } from "./relatedDiagramMemoryDraftStore";
import { seedStableRouteState } from "./incrementalRoutes";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  const run = async () => {
    try {
      await fn();
      passed += 1;
      console.log(`ok - ${name}`);
    } catch (e) {
      console.error(`FAIL - ${name}`);
      throw e;
    }
  };
  return run();
}

const EXPECTED_EDGES = [
  ["skc1", "sk_disease", "sk_patho_core"],
  ["skc2", "sk_patho_core", "sk_da"],
  ["skc4", "sk_da", "sk_mesolimbic"],
  ["skc5", "sk_da", "sk_mesocortical"],
  ["skc6", "sk_mesolimbic", "sk_positive"],
  ["skc7", "sk_mesocortical", "sk_negative"],
  ["skc8", "sk_mesocortical", "sk_cognitive"],
  ["skc9", "sk_positive", "sk_hallucination"],
  ["skc10", "sk_positive", "sk_delusion"],
  ["skc11", "sk_positive", "sk_thought"],
  ["skc12", "sk_negative", "sk_avolition"],
  ["skc13", "sk_negative", "sk_affect"],
  ["skc21", "sk_negative", "sk_withdrawal"],
  ["skc14", "sk_cognitive", "sk_attention"],
  ["skc15", "sk_cognitive", "sk_working_memory"],
] as const;

await test("A-H seed is the iPad snapshot without style demo", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: false });
  assert.equal(scene.includesStyleDemo, false);
  assert.equal(SCHIZOPHRENIA_KNOWLEDGE_CARDS.length, 16);
  assert.equal(SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.length, 15);
  assert.equal(scene.routeTopology?.routes.length, 15);
  assert.equal(scene.graph.nursingProblems.length, 0);
  assert.equal(scene.graph.cards.some((c) => c.id.startsWith("demo_")), false);
  assert.ok(scene.graph.cards.every((c) => c.cardType === "knowledge"));
  assert.ok(scene.graph.cards.every((c) => c.origin === "knowledge_library"));
  const byId = new Map(SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.map((c) => [c.id, c]));
  for (const [id, source, target] of EXPECTED_EDGES) {
    const row = byId.get(id);
    assert.ok(row, id);
    assert.equal(row!.sourceCardId, source);
    assert.equal(row!.targetCardId, target);
    assert.equal(row!.relationType, "current");
  }
  const disease = SCHIZOPHRENIA_KNOWLEDGE_CARDS.find((c) => c.id === "sk_disease")!;
  assert.equal(disease.layout.x, 439.741606);
  assert.equal(disease.layout.y, 274.199786);
  const topo = buildSchizophreniaKnowledgeTopology();
  assert.equal(topo.routeGroups.length, 0);
  assert.equal(topo.trunks.length, 0);
  assert.equal(topo.branchPoints.length, 0);
  for (const route of topo.routes) {
    assert.ok(route.points.length >= 2, route.connectionId);
  }
});

await test("I empty record uses the new seed", async () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: false });
  const loaded = await loadRelatedDiagramDraft({
    store: createMemoryRelatedDiagramDraftStore(),
    identity: {
      userId: "u1",
      organizationId: "org",
      academicYear: 2026,
      caseId: "SP-001",
    },
    seed: {
      graph: scene.graph,
      routeState: seedStableRouteState(
        scene.graph.cards,
        scene.graph.connections,
        scene.routeTopology,
      ),
      topology: scene.routeTopology,
    },
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.kind, "empty");
  assert.equal(loaded.source, "seed");
  assert.equal(loaded.graph.cards.length, 16);
});

await test("J existing record is restored and not replaced by seed", async () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: false });
  const store = createMemoryRelatedDiagramDraftStore();
  await store.insert({
    user_id: "u1",
    organization_id: "org",
    academic_year: 2026,
    case_id: "SP-001",
    semantic_graph: {
      semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
      cards: [
        {
          id: "student_kept",
          cardType: "understanding",
          text: "保存済み",
          state: "current",
          origin: "direct_insight",
          layout: { x: 10, y: 10, width: 120, height: 60, zIndex: 1 },
          isLocked: false,
          createdAt: "2026-09-24T00:00:00.000Z",
          updatedAt: "2026-09-24T00:00:00.000Z",
        },
      ],
      cardSources: [],
      connections: [],
      nursingProblems: [],
      nursingProblemSupports: [],
      integrations: [],
      integrationMembers: [],
    },
    route_scene: { schema: "rd.routeScene.v1", schemaVersion: 1, routes: [] },
  });
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: {
      userId: "u1",
      organizationId: "org",
      academicYear: 2026,
      caseId: "SP-001",
    },
    seed: {
      graph: scene.graph,
      routeState: seedStableRouteState(
        scene.graph.cards,
        scene.graph.connections,
        scene.routeTopology,
      ),
      topology: scene.routeTopology,
    },
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.kind, "restored");
  assert.equal(loaded.graph.cards[0]?.id, "student_kept");
});

console.log(`\n${passed} passed`);
