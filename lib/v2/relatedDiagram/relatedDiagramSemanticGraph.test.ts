/**
 * Related Diagram V1 Slice 0 — semantic graph review fixes.
 * Run: npx tsx lib/v2/relatedDiagram/relatedDiagramSemanticGraph.test.ts
 */

import assert from "node:assert/strict";
import { MINIMAL_RD_KNOWLEDGE_SEED } from "./minimalKnowledgeSeed";
import {
  buildSubmissionSnapshot,
  createEmptySemanticGraph,
  createNursingProblem,
  integrateNursingProblems,
  upsertCard,
  validateSemanticGraph,
} from "./semanticGraph";
import {
  createDraftServiceState,
  draftBindKnowledge,
  draftBuildImmutableSnapshot,
  draftCreateNursingProblem,
  draftIntegrateNursingProblems,
  draftSetPriority,
  draftUpsertCard,
  resolveKnowledgeBinding,
  type DraftServiceState,
} from "./relatedDiagramService";
import type {
  RelatedDiagramCard,
  RelatedDiagramSemanticGraph,
} from "./types";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";

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

function mustOk<T extends { ok: true } | { ok: false }>(
  result: T,
  label: string,
): Extract<T, { ok: true }> {
  assert.equal(result.ok, true, label);
  return result as Extract<T, { ok: true }>;
}

function newDraft(knowledgeVersion?: string): DraftServiceState {
  const binding =
    knowledgeVersion != null
      ? mustOk(
          resolveKnowledgeBinding({
            knowledgeGroupId: "kg-1",
            groupVersion: knowledgeVersion,
          }),
          "binding",
        ).binding
      : null;
  return mustOk(
    createDraftServiceState({
      id: "diag-1",
      userId: "user-1",
      organizationId: "org-1",
      academicYear: 2026,
      caseId: "case-1",
      knowledgeBinding: binding,
    }),
    "draft",
  ).state;
}

function npCard(
  id: string,
  text: string,
  state: "current" | "potential" = "current",
): RelatedDiagramCard {
  return {
    id,
    cardType: "nursing_problem",
    text,
    state,
    origin: "diagram_integration",
    layout: { x: 0, y: 0, width: 160, height: 72, zIndex: 0 },
    isLocked: false,
    createdAt: "2026-09-07T00:00:00.000Z",
    updatedAt: "2026-09-07T00:00:00.000Z",
  };
}

test("1. NP create stores supports but does not auto-create basis connection", () => {
  let g = mustOk(
    upsertCard(createEmptySemanticGraph(), {
      id: "u1",
      cardType: "understanding",
      text: "便秘",
      state: "current",
      origin: "form3_assessment",
    }),
    "u1",
  ).graph;

  g = mustOk(
    createNursingProblem(g, {
      cardId: "np1",
      text: "排便コントロールの障害",
      state: "current",
      supportingCardIds: ["u1"],
      priority: 1,
    }),
    "np",
  ).graph;

  assert.equal(g.nursingProblemSupports.length, 1);
  assert.equal(g.nursingProblemSupports[0]?.supportingCardId, "u1");
  assert.equal(
    g.connections.filter((c) => c.relationType === "nursing_problem_basis")
      .length,
    0,
  );
});

test("2. understanding state=null is rejected", () => {
  const bad = upsertCard(createEmptySemanticGraph(), {
    id: "u1",
    cardType: "understanding",
    text: "x",
    state: null,
    origin: "form3_assessment",
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.code, "invalid_state_for_type");
});

test("3. nursing_problem state=null is rejected", () => {
  const bad = upsertCard(createEmptySemanticGraph(), {
    id: "np1",
    cardType: "nursing_problem",
    text: "x",
    state: null,
    origin: "diagram_integration",
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.code, "invalid_state_for_type");
});

test("4. Information/Knowledge current|potential are rejected", () => {
  const info = upsertCard(createEmptySemanticGraph(), {
    id: "i1",
    cardType: "information",
    text: "排便1回/5日",
    state: "current",
    origin: "patient_information",
  });
  assert.equal(info.ok, false);

  const know = upsertCard(createEmptySemanticGraph(), {
    id: "k1",
    cardType: "knowledge",
    text: "抗コリン作用",
    state: "potential",
    origin: "knowledge_library",
  });
  assert.equal(know.ok, false);
});

test("5. orphan integration member is rejected", () => {
  const g: RelatedDiagramSemanticGraph = {
    ...createEmptySemanticGraph(),
    cards: [npCard("np1", "P1")],
    nursingProblems: [
      {
        cardId: "np1",
        status: "active",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
    ],
    integrationMembers: [
      { integrationId: "missing-integ", sourceProblemCardId: "np1" },
    ],
  };
  const v = validateSemanticGraph(g);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.equal(v.code, "orphan_integration_member");
});

test("6. integration member count < 2 is rejected", () => {
  const g: RelatedDiagramSemanticGraph = {
    ...createEmptySemanticGraph(),
    cards: [npCard("np1", "P1"), npCard("np2", "P2")],
    nursingProblems: [
      {
        cardId: "np1",
        status: "integrated",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
      {
        cardId: "np2",
        status: "active",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
    ],
    integrations: [
      { id: "integ1", resultProblemCardId: "np2", createdAt: "t" },
    ],
    integrationMembers: [
      { integrationId: "integ1", sourceProblemCardId: "np1" },
    ],
    connections: [
      {
        id: "c1",
        sourceCardId: "np1",
        targetCardId: "np2",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
    ],
  };
  const v = validateSemanticGraph(g);
  assert.equal(v.ok, false);
  if (v.ok) return;
  assert.equal(v.code, "integration_member_count");
});

test("7. integration cycle is rejected by snapshot validation", () => {
  // C composed-of A,B ; A composed-of C,D → cycle
  const g: RelatedDiagramSemanticGraph = {
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards: [
      npCard("A", "A"),
      npCard("B", "B"),
      npCard("C", "C"),
      npCard("D", "D"),
    ],
    cardSources: [],
    nursingProblems: ["A", "B", "C", "D"].map((id) => ({
      cardId: id,
      status: "active" as const,
      priority: null,
      createdAt: "t",
      updatedAt: "t",
    })),
    nursingProblemSupports: [],
    integrations: [
      { id: "i1", resultProblemCardId: "C", createdAt: "t" },
      { id: "i2", resultProblemCardId: "A", createdAt: "t" },
    ],
    integrationMembers: [
      { integrationId: "i1", sourceProblemCardId: "A" },
      { integrationId: "i1", sourceProblemCardId: "B" },
      { integrationId: "i2", sourceProblemCardId: "C" },
      { integrationId: "i2", sourceProblemCardId: "D" },
    ],
    connections: [
      {
        id: "e1",
        sourceCardId: "A",
        targetCardId: "C",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "e2",
        sourceCardId: "B",
        targetCardId: "C",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "e3",
        sourceCardId: "C",
        targetCardId: "A",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "e4",
        sourceCardId: "D",
        targetCardId: "A",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
    ],
  };

  const snap = buildSubmissionSnapshot({
    relatedDiagramId: "d",
    caseId: "c",
    studentRef: "u",
    submittedAt: "2026-09-07T00:00:00.000Z",
    assessmentCycleId: null,
    knowledgeGroupId: null,
    knowledgeVersion: null,
    statusAtSubmit: "draft",
    graph: g,
  });
  assert.equal(snap.ok, false);
  if (snap.ok) return;
  assert.equal(snap.code, "integration_cycle");
});

test("8. non-NP card as integration member/result is rejected", () => {
  const understanding: RelatedDiagramCard = {
    id: "u1",
    cardType: "understanding",
    text: "U",
    state: "current",
    origin: "form3_assessment",
    layout: { x: 0, y: 0, width: 160, height: 72, zIndex: 0 },
    isLocked: false,
    createdAt: "t",
    updatedAt: "t",
  };

  const asMember: RelatedDiagramSemanticGraph = {
    ...createEmptySemanticGraph(),
    cards: [understanding, npCard("np1", "P1"), npCard("np2", "P2")],
    nursingProblems: [
      {
        cardId: "np1",
        status: "active",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
      {
        cardId: "np2",
        status: "active",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
    ],
    integrations: [
      { id: "i1", resultProblemCardId: "np2", createdAt: "t" },
    ],
    integrationMembers: [
      { integrationId: "i1", sourceProblemCardId: "u1" },
      { integrationId: "i1", sourceProblemCardId: "np1" },
    ],
    connections: [
      {
        id: "c1",
        sourceCardId: "u1",
        targetCardId: "np2",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "c2",
        sourceCardId: "np1",
        targetCardId: "np2",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
    ],
  };
  const v1 = validateSemanticGraph(asMember);
  assert.equal(v1.ok, false);
  if (v1.ok) return;
  assert.equal(v1.code, "integration_member_not_nursing_problem");

  const asResult: RelatedDiagramSemanticGraph = {
    ...createEmptySemanticGraph(),
    cards: [understanding, npCard("np1", "P1"), npCard("np2", "P2")],
    nursingProblems: [
      {
        cardId: "np1",
        status: "active",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
      {
        cardId: "np2",
        status: "active",
        priority: null,
        createdAt: "t",
        updatedAt: "t",
      },
    ],
    integrations: [
      { id: "i1", resultProblemCardId: "u1", createdAt: "t" },
    ],
    integrationMembers: [
      { integrationId: "i1", sourceProblemCardId: "np1" },
      { integrationId: "i1", sourceProblemCardId: "np2" },
    ],
    connections: [
      {
        id: "c1",
        sourceCardId: "np1",
        targetCardId: "u1",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
      {
        id: "c2",
        sourceCardId: "np2",
        targetCardId: "u1",
        relationType: "nursing_problem_integration",
        origin: "system_integration",
        createdAt: "t",
        updatedAt: "t",
      },
    ],
  };
  const v2 = validateSemanticGraph(asResult);
  assert.equal(v2.ok, false);
  if (v2.ok) return;
  assert.equal(v2.code, "integration_result_not_nursing_problem");
});

test("9. valid multi-stage integration A+B→C, C+D→E passes", () => {
  let state = newDraft();
  state = mustOk(
    draftUpsertCard(state, {
      id: "u1",
      cardType: "understanding",
      text: "U",
      state: "current",
      origin: "form3_assessment",
    }),
    "u1",
  ).state;

  for (const id of ["A", "B", "D"] as const) {
    state = mustOk(
      draftCreateNursingProblem(state, {
        cardId: id,
        text: id,
        state: "current",
        supportingCardIds: ["u1"],
      }),
      id,
    ).state;
  }

  state = mustOk(
    draftIntegrateNursingProblems(state, {
      integrationId: "i1",
      resultCardId: "C",
      resultText: "C",
      resultState: "current",
      sourceProblemCardIds: ["A", "B"],
    }),
    "i1",
  ).state;

  state = mustOk(
    draftIntegrateNursingProblems(state, {
      integrationId: "i2",
      resultCardId: "E",
      resultText: "E",
      resultState: "current",
      sourceProblemCardIds: ["C", "D"],
    }),
    "i2",
  ).state;

  assert.deepEqual(validateSemanticGraph(state.graph), { ok: true });
  assert.equal(state.graph.integrations.length, 2);
  assert.equal(state.graph.integrationMembers.length, 4);
});

test("10. active priority duplicate is rejected", () => {
  let state = newDraft();
  state = mustOk(
    draftUpsertCard(state, {
      id: "u1",
      cardType: "understanding",
      text: "U",
      state: "current",
      origin: "form3_assessment",
    }),
    "u1",
  ).state;
  state = mustOk(
    draftCreateNursingProblem(state, {
      cardId: "np1",
      text: "P1",
      state: "current",
      supportingCardIds: ["u1"],
      priority: 1,
    }),
    "np1",
  ).state;
  const dup = draftCreateNursingProblem(state, {
    cardId: "np2",
    text: "P2",
    state: "potential",
    supportingCardIds: ["u1"],
    priority: 1,
  });
  assert.equal(dup.ok, false);
  if (dup.ok) return;
  assert.equal(dup.code, "duplicate_priority");
});

test("11. valid graph builds immutable snapshot", () => {
  let state = newDraft(MINIMAL_RD_KNOWLEDGE_SEED.version);
  state = mustOk(
    draftUpsertCard(state, {
      id: "u1",
      cardType: "understanding",
      text: "腸蠕動低下",
      state: "current",
      origin: "form3_assessment",
    }),
    "u1",
  ).state;
  state = mustOk(
    draftCreateNursingProblem(state, {
      cardId: "np1",
      text: "排便コントロールの障害",
      state: "current",
      supportingCardIds: ["u1"],
      priority: 1,
    }),
    "np",
  ).state;

  const snap = mustOk(
    draftBuildImmutableSnapshot(state, "2026-09-07T01:00:00.000Z"),
    "snap",
  );
  assert.equal(snap.snapshot.knowledgeVersion, "2026.1");
  assert.equal(snap.snapshot.graph.nursingProblemSupports.length, 1);
  assert.equal(
    snap.snapshot.graph.connections.filter(
      (c) => c.relationType === "nursing_problem_basis",
    ).length,
    0,
  );

  const later = mustOk(draftSetPriority(state, "np1", 2), "prio");
  assert.equal(snap.snapshot.graph.nursingProblems[0]?.priority, 1);
  assert.equal(
    later.state.graph.nursingProblems.find((p) => p.cardId === "np1")?.priority,
    2,
  );
});

test("knowledge binding rejects mismatched claimed version", () => {
  const bad = resolveKnowledgeBinding({
    knowledgeGroupId: "kg-1",
    groupVersion: "2026.1",
    claimedKnowledgeVersion: "2025.9",
  });
  assert.equal(bad.ok, false);
  if (bad.ok) return;
  assert.equal(bad.code, "knowledge_version_mismatch");

  let state = newDraft();
  const bindBad = draftBindKnowledge(state, {
    knowledgeGroupId: "kg-1",
    groupVersion: "2026.1",
    claimedKnowledgeVersion: "other",
  });
  assert.equal(bindBad.ok, false);

  state = mustOk(
    draftBindKnowledge(state, {
      knowledgeGroupId: "kg-1",
      groupVersion: "2026.1",
      claimedKnowledgeVersion: "2026.1",
    }),
    "bind",
  ).state;
  assert.equal(state.meta.knowledgeVersion, "2026.1");
});

test("origin ⊥ state still holds (form3_assessment + potential)", () => {
  const card = mustOk(
    upsertCard(createEmptySemanticGraph(), {
      id: "u1",
      cardType: "understanding",
      text: "腸蠕動低下",
      state: "potential",
      origin: "form3_assessment",
    }),
    "card",
  );
  assert.equal(card.value.origin, "form3_assessment");
  assert.equal(card.value.state, "potential");
});

console.log(`\n${passed} passed`);
