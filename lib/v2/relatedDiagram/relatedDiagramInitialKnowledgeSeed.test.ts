/**
 * Student Editor empty seed = pathophysiology Knowledge only.
 * Run: ./node_modules/.bin/jiti lib/v2/relatedDiagram/relatedDiagramInitialKnowledgeSeed.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadRelatedDiagramDraft } from "./relatedDiagramDraftPersistence";
import { createMemoryRelatedDiagramDraftStore } from "./relatedDiagramMemoryDraftStore";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";
import { seedStableRouteState } from "./incrementalRoutes";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import type { RelatedDiagramSemanticGraph } from "./types";

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

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function knowledgeSeed() {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: false });
  return {
    scene,
    snapshot: {
      graph: scene.graph,
      routeState: seedStableRouteState(
        scene.graph.cards,
        scene.graph.connections,
        scene.routeTopology,
      ),
      topology: scene.routeTopology,
    },
  };
}

await test("A empty record uses pathophysiology Knowledge seed", async () => {
  const { snapshot } = knowledgeSeed();
  const store = createMemoryRelatedDiagramDraftStore();
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: {
      userId: "u1",
      organizationId: "org",
      academicYear: 2026,
      caseId: "SP-001",
    },
    seed: snapshot,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.kind, "empty");
  assert.equal(loaded.source, "seed");
  assert.equal(loaded.graph, snapshot.graph);
  assert.equal(loaded.version, null);
});

await test("B seed has no style demo cards or connections", () => {
  const { scene } = knowledgeSeed();
  assert.equal(scene.includesStyleDemo, false);
  assert.equal(
    scene.graph.cards.some((c) => c.id.startsWith("demo_")),
    false,
  );
  assert.equal(
    scene.graph.connections.some((c) => c.id.startsWith("demo_")),
    false,
  );
  assert.equal(scene.graph.nursingProblems.length, 0);
});

await test("C Knowledge cardType / origin stay knowledge_library", () => {
  const { scene } = knowledgeSeed();
  assert.ok(scene.graph.cards.length > 0);
  assert.ok(scene.graph.connections.length > 0);
  assert.ok(scene.graph.cards.every((c) => c.cardType === "knowledge"));
  assert.ok(scene.graph.cards.every((c) => c.origin === "knowledge_library"));
  assert.ok(
    scene.graph.connections.every((c) => c.origin === "knowledge_library"),
  );
  assert.ok(
    scene.graph.cardSources.every((s) => s.sourceType === "knowledge_library"),
  );
});

await test("D existing record restores payload and is not replaced by seed", async () => {
  const { snapshot } = knowledgeSeed();
  const saved: RelatedDiagramSemanticGraph = {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards: [
      {
        id: "student_moved",
        cardType: "understanding",
        text: "学生が保存したカード",
        state: "current",
        origin: "direct_insight",
        layout: { x: 40, y: 40, width: 160, height: 72, zIndex: 1 },
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
  };
  const store = createMemoryRelatedDiagramDraftStore();
  const inserted = await store.insert({
    user_id: "u1",
    organization_id: "org",
    academic_year: 2026,
    case_id: "SP-001",
    semantic_graph: saved,
    route_scene: {
      schema: "rd.routeScene.v1",
      schemaVersion: 1,
      routes: [],
    },
  });
  assert.equal(inserted.error, null);
  assert.ok(inserted.row);
  const loaded = await loadRelatedDiagramDraft({
    store,
    identity: {
      userId: "u1",
      organizationId: "org",
      academicYear: 2026,
      caseId: "SP-001",
    },
    seed: snapshot,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.kind, "restored");
  assert.equal(loaded.source, "record");
  assert.equal(loaded.graph.cards[0]?.id, "student_moved");
  assert.equal(
    loaded.graph.cards.some((c) => c.id.startsWith("sk_")),
    false,
  );
});

await test("E workspace empty seed is knowledge-only; persist/Form3/Patient A stay unused", () => {
  const ws = src(
    "../../../components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace.tsx",
  );
  assert.ok(ws.includes("includeStyleDemo: false"));
  assert.equal(ws.includes("includeStyleDemo: true"), false);
  assert.equal(ws.includes("buildPatientAForm3Skeleton"), false);
  assert.equal(ws.includes("derivePatientAReasoningUnits"), false);
  assert.ok(ws.includes("loadRelatedDiagramDraft"));
  const persist = src("./relatedDiagramDraftPersistence.ts");
  assert.ok(persist.includes("kind: \"empty\""));
  assert.ok(persist.includes("source: \"seed\""));
  assert.ok(persist.includes("kind: \"restored\""));
});

console.log(`\n${passed} passed`);
