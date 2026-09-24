/**
 * DEV ONLY — Patient A Reasoning Unit derivation.
 * READ ONLY SNAPSHOT. DO NOT WRITE BACK.
 *
 * Audit concept, not a production semantic type.
 * patternKey is never treated as layout ownership.
 */

import {
  patientADevEvidenceRelationId,
  patientADevInformationCardId,
  patientADevUnderstandingCardId,
} from "./buildPatientAForm3Skeleton";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  clonePatientAForm3SkeletonSnapshot,
  type PatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";

/** Shared infos are grouped when they share at least this many Units. */
export const SHARED_POCKET_MIN_UNIT_OVERLAP = 2;

export type PatientAReasoningUnit = {
  assessmentId: string;
  understandingCardId: string;
  evidenceInformationIds: string[];
  exclusiveInformationIds: string[];
  sharedInformationIds: string[];
};

export type PatientASharedInformation = {
  informationId: string;
  cardId: string;
  degree: number;
  unitAssessmentIds: string[];
};

export type PatientASharedPocket = {
  id: string;
  informationIds: string[];
  cardIds: string[];
};

export type PatientAReasoningUnitDerivation = {
  units: PatientAReasoningUnit[];
  exclusiveInformationIds: string[];
  sharedInformations: PatientASharedInformation[];
  isolatedInformationIds: string[];
  pockets: PatientASharedPocket[];
  evidenceRelationIds: string[];
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function uniqueSorted(ids: string[]): string[] {
  return [...new Set(ids)].sort(compareId);
}

function findRoot(parent: Map<string, string>, id: string): string {
  let cur = id;
  while (parent.get(cur) !== cur) {
    const next = parent.get(cur);
    if (!next) break;
    cur = next;
  }
  let walk = id;
  while (walk !== cur) {
    const next = parent.get(walk);
    if (!next) break;
    parent.set(walk, cur);
    walk = next;
  }
  return cur;
}

function union(parent: Map<string, string>, a: string, b: string): void {
  const ra = findRoot(parent, a);
  const rb = findRoot(parent, b);
  if (ra === rb) return;
  if (ra < rb) parent.set(rb, ra);
  else parent.set(ra, rb);
}

function deriveSharedPockets(
  shared: PatientASharedInformation[],
): PatientASharedPocket[] {
  if (shared.length === 0) return [];
  const ids = shared.map((row) => row.informationId).sort(compareId);
  const parent = new Map(ids.map((id) => [id, id]));
  const unitsOf = new Map(
    shared.map((row) => [row.informationId, new Set(row.unitAssessmentIds)]),
  );

  for (let i = 0; i < ids.length; i += 1) {
    const a = ids[i]!;
    const aUnits = unitsOf.get(a);
    if (!aUnits) continue;
    for (let j = i + 1; j < ids.length; j += 1) {
      const b = ids[j]!;
      const bUnits = unitsOf.get(b);
      if (!bUnits) continue;
      let overlap = 0;
      for (const unitId of aUnits) {
        if (bUnits.has(unitId)) overlap += 1;
      }
      if (overlap >= SHARED_POCKET_MIN_UNIT_OVERLAP) {
        union(parent, a, b);
      }
    }
  }

  const grouped = new Map<string, string[]>();
  for (const id of ids) {
    const root = findRoot(parent, id);
    const list = grouped.get(root) ?? [];
    list.push(id);
    grouped.set(root, list);
  }

  return [...grouped.values()]
    .map((members) => {
      const informationIds = uniqueSorted(members);
      return {
        id: `pocket:${informationIds[0]}`,
        informationIds,
        cardIds: informationIds.map(patientADevInformationCardId),
      };
    })
    .sort((a, b) => {
      if (a.informationIds.length !== b.informationIds.length) {
        return b.informationIds.length - a.informationIds.length;
      }
      return compareId(a.id, b.id);
    });
}

export function derivePatientAReasoningUnits(
  snapshot: PatientAForm3SkeletonSnapshot = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
): PatientAReasoningUnitDerivation {
  const frozen = clonePatientAForm3SkeletonSnapshot(snapshot);
  const infos = frozen.informationCards
    .filter((card) => card.status === "active")
    .slice()
    .sort((a, b) => compareId(a.id, b.id));
  const assessments = frozen.assessmentCards
    .filter((card) => card.status === "reviewed")
    .slice()
    .sort((a, b) => compareId(a.id, b.id));
  const activeIds = new Set(infos.map((card) => card.id));

  const unitEvidence = assessments.map((assessment) => ({
    assessmentId: assessment.id,
    evidenceInformationIds: uniqueSorted(assessment.evidenceInformationIds).filter(
      (id) => activeIds.has(id),
    ),
  }));

  const degree = new Map<string, string[]>();
  for (const unit of unitEvidence) {
    for (const informationId of unit.evidenceInformationIds) {
      const owners = degree.get(informationId) ?? [];
      owners.push(unit.assessmentId);
      degree.set(informationId, owners);
    }
  }
  for (const [id, owners] of degree) {
    degree.set(id, uniqueSorted(owners));
  }

  const units: PatientAReasoningUnit[] = unitEvidence.map((unit) => {
    const exclusiveInformationIds: string[] = [];
    const sharedInformationIds: string[] = [];
    for (const informationId of unit.evidenceInformationIds) {
      const owners = degree.get(informationId) ?? [];
      if (owners.length >= 2) sharedInformationIds.push(informationId);
      else exclusiveInformationIds.push(informationId);
    }
    return {
      assessmentId: unit.assessmentId,
      understandingCardId: patientADevUnderstandingCardId(unit.assessmentId),
      evidenceInformationIds: unit.evidenceInformationIds,
      exclusiveInformationIds: uniqueSorted(exclusiveInformationIds),
      sharedInformationIds: uniqueSorted(sharedInformationIds),
    };
  });

  const sharedInformations: PatientASharedInformation[] = [...degree.entries()]
    .filter(([, owners]) => owners.length >= 2)
    .map(([informationId, unitAssessmentIds]) => ({
      informationId,
      cardId: patientADevInformationCardId(informationId),
      degree: unitAssessmentIds.length,
      unitAssessmentIds,
    }))
    .sort((a, b) => {
      if (a.degree !== b.degree) return b.degree - a.degree;
      return compareId(a.informationId, b.informationId);
    });

  const referenced = new Set(degree.keys());
  const exclusiveInformationIds = uniqueSorted(
    [...degree.entries()]
      .filter(([, owners]) => owners.length === 1)
      .map(([id]) => id),
  );
  const isolatedInformationIds = infos
    .map((card) => card.id)
    .filter((id) => !referenced.has(id));

  const evidenceRelationIds = units
    .flatMap((unit) =>
      unit.evidenceInformationIds.map((informationId) =>
        patientADevEvidenceRelationId(unit.assessmentId, informationId),
      ),
    )
    .sort(compareId);

  return {
    units,
    exclusiveInformationIds,
    sharedInformations,
    isolatedInformationIds,
    pockets: deriveSharedPockets(sharedInformations),
    evidenceRelationIds,
  };
}

export function sharedDegreeDistribution(
  derivation: PatientAReasoningUnitDerivation,
): { d2: number; d3: number; d4: number } {
  let d2 = 0;
  let d3 = 0;
  let d4 = 0;
  for (const row of derivation.sharedInformations) {
    if (row.degree === 2) d2 += 1;
    else if (row.degree === 3) d3 += 1;
    else if (row.degree >= 4) d4 += 1;
  }
  return { d2, d3, d4 };
}
