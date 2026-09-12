/**
 * Slice 1 visual-style mapping tests.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramVisualStyle.test.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveCardBorderVisual,
  resolveConnectionStrokeVisual,
} from "./visualStyle";
import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import { buildSchizophreniaKnowledgeGraph } from "./fixtures/schizophreniaPathophysiologyFixture";
import { knowledgeRowsToSemanticGraph } from "./knowledgeLibraryMapping";

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

test("information has no state visual (solid, no byotai)", () => {
  const v = resolveCardBorderVisual("information", null);
  assert.equal(v.borderStyle, "solid");
  assert.equal(v.showByotaiLabel, false);
  assert.equal(v.showNursingProblemLabel, false);
});

test("understanding current vs potential border", () => {
  const cur = resolveCardBorderVisual("understanding", "current");
  const pot = resolveCardBorderVisual("understanding", "potential");
  assert.equal(cur.borderStyle, "solid");
  assert.equal(pot.borderStyle, "dashed");
});

test("knowledge shows 病態 label, no state border change", () => {
  const v = resolveCardBorderVisual("knowledge", null);
  assert.equal(v.showByotaiLabel, true);
  assert.equal(v.borderStyle, "solid");
  assert.notEqual(v.borderColor, "#0A5FCC");
});

test("nursing_problem current vs potential", () => {
  const cur = resolveCardBorderVisual("nursing_problem", "current");
  const pot = resolveCardBorderVisual("nursing_problem", "potential");
  assert.equal(cur.borderStyle, "solid");
  assert.equal(pot.borderStyle, "dashed");
  assert.equal(cur.showNursingProblemLabel, true);
});

test("connection visual is solid / dashed / thick only", () => {
  const current = resolveConnectionStrokeVisual("current");
  const potential = resolveConnectionStrokeVisual("potential");
  const treatment = resolveConnectionStrokeVisual("treatment");
  const basis = resolveConnectionStrokeVisual("nursing_problem_basis");
  const integ = resolveConnectionStrokeVisual("nursing_problem_integration");
  assert.equal(current.dasharray, null);
  assert.equal(current.marker, "arrow");
  assert.ok(potential.dasharray);
  assert.equal(potential.marker, "arrow");
  assert.ok(treatment.strokeWidthPx >= 3);
  assert.equal(treatment.dasharray, null);
  assert.deepEqual(basis, current);
  assert.deepEqual(integ, current);
  for (const rel of [
    "current",
    "potential",
    "treatment",
    "nursing_problem_basis",
    "nursing_problem_integration",
  ] as const) {
    assert.equal(resolveConnectionStrokeVisual(rel).stroke, "#1D1D1F");
  }
});

test("double-line and diamond visuals are gone; semantic types remain", () => {
  const styleSrc = readFileSync(
    new URL("./visualStyle.ts", import.meta.url),
    "utf8",
  );
  const layerSrc = readFileSync(
    new URL(
      "../../../components/v2/relatedDiagram/RelatedDiagramConnectionLayer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(styleSrc.includes("doubleLine"), false);
  assert.equal(styleSrc.includes("integrationMark"), false);
  assert.equal(layerSrc.includes("doubleLine"), false);
  assert.equal(layerSrc.includes("data-rd-integration-mark"), false);
  assert.equal(layerSrc.includes("rd-arrow-double"), false);
  assert.equal(layerSrc.includes("offsetOrthogonalPolyline"), false);
  assert.equal(layerSrc.includes("#0A5FCC"), false);
  assert.equal(RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION, "1");
  assert.ok(styleSrc.includes("nursing_problem_basis"));
  assert.ok(styleSrc.includes("nursing_problem_integration"));
});

test("knowledgeRowsToSemanticGraph maps library rows", () => {
  const g = knowledgeRowsToSemanticGraph({
    knowledgeVersion: "1.0.0",
    cards: [
      {
        id: "kc1",
        knowledge_group_id: "g1",
        text: "病態",
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        z_index: 0,
      },
    ],
    connections: [
      {
        id: "kn1",
        knowledge_group_id: "g1",
        source_knowledge_card_id: "kc1",
        target_knowledge_card_id: "kc1",
        relation_type: "current",
      },
    ],
  });
  assert.equal(g.cards[0]?.cardType, "knowledge");
  assert.equal(g.cards[0]?.state, null);
  assert.equal(g.cards[0]?.isLocked, true);
  assert.equal(g.connections[0]?.origin, "knowledge_library");
});

test("pathology knowledge occupancy is moderate (not dominating A3)", () => {
  const g = buildSchizophreniaKnowledgeGraph();
  const cardArea = g.cards.reduce(
    (sum, c) => sum + c.layout.width * c.layout.height,
    0,
  );
  const a3Area = A3_WIDTH_PX * A3_HEIGHT_PX;
  const ratio = cardArea / a3Area;
  assert.ok(ratio > 0.05, `too sparse: ${ratio}`);
  assert.ok(ratio < 0.35, `too dense / dominating: ${ratio}`);
  console.log(`  pathology card area ratio ≈ ${(ratio * 100).toFixed(1)}%`);
});

console.log(`\n${passed} passed`);
