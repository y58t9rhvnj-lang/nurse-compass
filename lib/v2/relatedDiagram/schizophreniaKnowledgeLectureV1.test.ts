/**
 * Lecture V1 schizophrenia initial Knowledge: semantics, pathways, preview.
 * Run: npx tsx lib/v2/relatedDiagram/schizophreniaKnowledgeLectureV1.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { A3_WIDTH_PX } from "./a3Canvas";
import {
  SCHIZOPHRENIA_FIXTURE_VERSION,
  SCHIZOPHRENIA_KNOWLEDGE_CARDS,
  SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS,
  buildSchizophreniaKnowledgeGraph,
} from "./fixtures/schizophreniaPathophysiologyFixture";
import { buildSchizophreniaKnowledgeTopology } from "./fixtures/schizophreniaRouteTopology";
import { resolveDevFixtureReadonlyScene } from "./resolveReadonlyScene";

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

function conn(id: string) {
  const row = SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.find((c) => c.id === id);
  assert.ok(row, id);
  return row!;
}

function hasEdge(source: string, target: string) {
  return SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.some(
    (c) => c.sourceCardId === source && c.targetCardId === target,
  );
}

test("A all cards are Knowledge", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  assert.equal(g.cards.length, 16);
  assert.ok(g.cards.every((c) => c.cardType === "knowledge"));
  assert.ok(g.cards.every((c) => c.state === null));
  assert.equal(g.nursingProblems.length, 0);
});

test("B origin is knowledge_library", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  assert.ok(g.cards.every((c) => c.origin === "knowledge_library"));
  assert.ok(g.connections.every((c) => c.origin === "knowledge_library"));
  assert.ok(g.cardSources.every((s) => s.sourceType === "knowledge_library"));
  assert.ok(
    g.cardSources.every((s) => s.sourceVersion === SCHIZOPHRENIA_FIXTURE_VERSION),
  );
});

test("C no patient data dependence", () => {
  const src = readFileSync(
    new URL("./fixtures/schizophreniaPathophysiologyFixture.ts", import.meta.url),
    "utf8",
  );
  assert.equal(src.includes("patientA"), false);
  assert.equal(src.includes("Patient A"), false);
  assert.equal(src.includes("buildPatientA"), false);
  assert.ok(
    SCHIZOPHRENIA_KNOWLEDGE_CARDS.every(
      (c) => c.origin !== "patient_information" && c.origin !== "direct_insight",
    ),
  );
});

test("D no Form3 dependence", () => {
  const src = readFileSync(
    new URL("./fixtures/schizophreniaPathophysiologyFixture.ts", import.meta.url),
    "utf8",
  );
  const knowledgeBlock = src.slice(
    src.indexOf("export const SCHIZOPHRENIA_KNOWLEDGE_CARDS"),
    src.indexOf("export const SLICE2A_MOVABLE_DEMO_CARD_IDS"),
  );
  assert.equal(knowledgeBlock.includes("form3"), false);
  assert.equal(knowledgeBlock.includes("Form3"), false);
  assert.ok(
    SCHIZOPHRENIA_KNOWLEDGE_CARDS.every((c) => c.origin !== "form3_assessment"),
  );
});

test("E mesolimbic pathway exists on the semantic graph", () => {
  assert.equal(hasEdge("sk_da", "sk_mesolimbic"), true);
  assert.equal(hasEdge("sk_mesolimbic", "sk_positive"), true);
  assert.equal(conn("skc4").relationType, "current");
  assert.equal(conn("skc6").relationType, "current");
});

test("F mesocortical pathway exists on the semantic graph", () => {
  assert.equal(hasEdge("sk_da", "sk_mesocortical"), true);
  assert.equal(hasEdge("sk_mesocortical", "sk_negative"), true);
  assert.equal(hasEdge("sk_mesocortical", "sk_cognitive"), true);
});

test("G positive symptoms expand to representative symptoms", () => {
  assert.equal(hasEdge("sk_positive", "sk_hallucination"), true);
  assert.equal(hasEdge("sk_positive", "sk_delusion"), true);
  assert.equal(hasEdge("sk_positive", "sk_thought"), true);
});

test("H negative symptoms expand to representative symptoms", () => {
  assert.equal(hasEdge("sk_negative", "sk_avolition"), true);
  assert.equal(hasEdge("sk_negative", "sk_affect"), true);
  assert.equal(hasEdge("sk_negative", "sk_withdrawal"), true);
});

test("I cognitive impairment expands to representative symptoms", () => {
  assert.equal(hasEdge("sk_cognitive", "sk_attention"), true);
  assert.equal(hasEdge("sk_cognitive", "sk_working_memory"), true);
});

test("J knowledge preview has no style demo", () => {
  const scene = resolveDevFixtureReadonlyScene({ includeStyleDemo: false });
  assert.equal(scene.includesStyleDemo, false);
  assert.ok(scene.graph.cards.every((c) => c.cardType === "knowledge"));
  assert.equal(
    scene.graph.cards.some((c) => c.id.startsWith("demo_")),
    false,
  );
  const preview = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramKnowledgePreviewWorkspace.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(preview.includes("includeStyleDemo: false"));
  assert.equal(preview.includes("includeStyleDemo: true"), false);
});

test("K route topology covers every knowledge card and connection", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const topology = buildSchizophreniaKnowledgeTopology();
  const routed = new Set(topology.routes.map((r) => r.connectionId));
  for (const c of g.connections) {
    assert.equal(routed.has(c.id), true, `missing route ${c.id}`);
  }
  assert.equal(topology.routes.length, g.connections.length);
  const mentioned = new Set<string>();
  for (const c of g.connections) {
    mentioned.add(c.sourceCardId);
    mentioned.add(c.targetCardId);
  }
  assert.equal(mentioned.has("sk_disease"), true);
  for (const card of g.cards) {
    assert.equal(mentioned.has(card.id), true, `card ${card.id} has no connection`);
    assert.ok(card.layout.x + card.layout.width <= A3_WIDTH_PX + 1, card.id);
  }
});

test("L Persistence / production files stay unused by this rewrite", () => {
  const persist = readFileSync(
    new URL("./relatedDiagramDraftPersistence.ts", import.meta.url),
    "utf8",
  );
  const repo = readFileSync(
    new URL("./relatedDiagramRepositoryDraftStore.ts", import.meta.url),
    "utf8",
  );
  const action = readFileSync(
    new URL("../../../app/v2/actions/relatedDiagramDraft.ts", import.meta.url),
    "utf8",
  );
  assert.ok(persist.includes("kind: \"empty\""));
  assert.ok(persist.includes("source: \"record\""));
  assert.ok(repo.includes("createRelatedDiagramRepositoryDraftStore"));
  assert.ok(action.includes("readRelatedDiagramDraftRowAction"));
  assert.ok(action.includes("insertRelatedDiagramDraftRowAction"));
  assert.ok(action.includes("updateRelatedDiagramDraftRowAction"));
});

test("iPad snapshot has disease to patho and no unused cause/glu cards", () => {
  assert.equal(hasEdge("sk_disease", "sk_patho_core"), true);
  assert.equal(conn("skc1").relationType, "current");
  const byId = new Map(SCHIZOPHRENIA_KNOWLEDGE_CARDS.map((c) => [c.id, c]));
  assert.equal(byId.has("sk_genetic"), false);
  assert.equal(byId.has("sk_neurodev"), false);
  assert.equal(byId.has("sk_stress"), false);
  assert.equal(byId.has("sk_vulnerability"), false);
  assert.equal(byId.has("sk_glu"), false);
  assert.equal(byId.has("sk_nt_imbalance"), false);
  assert.equal(SCHIZOPHRENIA_KNOWLEDGE_CONNECTIONS.length, 15);
});

console.log(`\n${passed} passed`);
