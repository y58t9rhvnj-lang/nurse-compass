/**
 * Related Diagram Slice 2B-1 — Form3 read model.
 * Read-only adapter. Does not mutate Form3 payloads or components.
 *
 * Stable identity is Form3 v2 Assessment Card `id` (UUID or payload-stable id).
 * v1 pattern-index / migrated synthetic ids are rejected (no invented identity).
 */

import {
  FORM3_PATTERN_ORDER,
  type Form3Judgment,
  type Form3PatternKey,
} from "../../form3/form3Types";
import {
  isForm3DataV2,
  type Form3AssessmentCardV2,
  type Form3DataV2,
  type Form3InformationCardV2,
  type Form3SoType,
} from "../../form3/v2/form3V2Types";

export const RELATED_DIAGRAM_FORM3_PATTERN_LABELS: Record<
  Form3PatternKey,
  string
> = {
  health_perception_management: "健康知覚・健康管理",
  nutritional_metabolic: "栄養・代謝",
  elimination: "排泄",
  activity_exercise: "活動・運動",
  sleep_rest: "睡眠・休息",
  cognitive_perceptual: "認知・知覚",
  self_perception_self_concept: "自己知覚・自己概念",
  role_relationship: "役割・関係",
  sexuality_reproductive: "性・生殖",
  coping_stress_tolerance: "コーピング・ストレス耐性",
  value_belief: "価値・信念",
};

/** Drawer tab strip — short names so 11 patterns do not consume vertical space. */
export const RELATED_DIAGRAM_FORM3_PATTERN_TAB_LABELS: Record<
  Form3PatternKey,
  string
> = {
  health_perception_management: "健康知覚",
  nutritional_metabolic: "栄養",
  elimination: "排泄",
  activity_exercise: "活動",
  sleep_rest: "睡眠",
  cognitive_perceptual: "認知",
  self_perception_self_concept: "自己知覚",
  role_relationship: "役割",
  sexuality_reproductive: "性",
  coping_stress_tolerance: "コーピング",
  value_belief: "価値",
};

const CIRCLED = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
  "⑪",
] as const;

export const RELATED_DIAGRAM_FORM3_JUDGMENT_LABELS: Record<
  Form3Judgment,
  string
> = {
  functioning_normally: "正常に機能している",
  strength: "強みがある",
  problem: "問題がある",
  risk: "問題が生じる可能性がある",
  insufficient_information: "情報不足で判断できない",
};

export type RelatedDiagramForm3CardState = "current" | "potential";

export type RelatedDiagramForm3StateMapping =
  | "explicit_current"
  | "explicit_potential"
  | "schema_default_current";

/**
 * Understanding.state is required by the existing semantic graph.
 * Form3 judgments that are educational current/potential equivalents:
 *   problem → current, risk → potential
 *
 * strength / functioning_normally / insufficient_information / null
 * → current is a **schema default only** (Frozen §7.3).
 * It does NOT mean the student determined a 顕在 problem.
 * Educational meaning of this default is deferred to a later gate.
 * AI must not estimate current / potential.
 */
export function mapForm3JudgmentToCardState(
  judgment: Form3Judgment | null,
): {
  state: RelatedDiagramForm3CardState;
  mapping: RelatedDiagramForm3StateMapping;
} {
  if (judgment === "problem") {
    return { state: "current", mapping: "explicit_current" };
  }
  if (judgment === "risk") {
    return { state: "potential", mapping: "explicit_potential" };
  }
  return { state: "current", mapping: "schema_default_current" };
}

/**
 * Compose UI initial 顕在/潜在 only.
 * Form3 classification is a hint, never the final Card state.
 * strength / functioning_normally / insufficient_information / null
 * stay unselected — they are not auto-current.
 */
export function initialUnderstandingStateFromForm3Classification(
  judgment: Form3Judgment | null,
): RelatedDiagramForm3CardState | null {
  if (judgment === "problem") return "current";
  if (judgment === "risk") return "potential";
  return null;
}

export type RelatedDiagramForm3AssessmentSource = {
  form3RecordId: string;
  sourceVersion: number;
  patternId: Form3PatternKey;
  patternName: string;
  patternIndex: number;
  patternCircled: string;
  assessmentId: string;
  assessmentText: string;
  judgment: Form3Judgment | null;
  judgmentLabel: string | null;
  state: RelatedDiagramForm3CardState;
  stateMapping: RelatedDiagramForm3StateMapping;
  hasEvidence: boolean;
};

export type RelatedDiagramForm3InformationSource = {
  form3RecordId: string;
  sourceVersion: number;
  informationId: string;
  content: string;
  soType: Form3SoType | null;
  patternKeys: Form3PatternKey[];
};

export type RelatedDiagramForm3PatternGroup = {
  patternId: Form3PatternKey;
  patternName: string;
  patternShortName: string;
  patternIndex: number;
  patternCircled: string;
  assessments: RelatedDiagramForm3AssessmentSource[];
  informations: RelatedDiagramForm3InformationSource[];
};

export type RelatedDiagramForm3ReadModel = {
  form3RecordId: string;
  sourceVersion: number;
  patterns: RelatedDiagramForm3PatternGroup[];
  assessments: RelatedDiagramForm3AssessmentSource[];
  informations: RelatedDiagramForm3InformationSource[];
};

export type MapForm3ReadModelResult =
  | { ok: true; model: RelatedDiagramForm3ReadModel }
  | {
      ok: false;
      reason: "no_stable_assessment_identity" | "invalid_payload";
    };

export function form3PatternCircledLabel(patternId: Form3PatternKey): string {
  const index = FORM3_PATTERN_ORDER.indexOf(patternId);
  const circled = index >= 0 ? CIRCLED[index] : "";
  const name = RELATED_DIAGRAM_FORM3_PATTERN_LABELS[patternId];
  return circled ? `${circled} ${name}` : name;
}

export function form3PatternTabLabel(patternId: Form3PatternKey): string {
  const index = FORM3_PATTERN_ORDER.indexOf(patternId);
  const circled = index >= 0 ? CIRCLED[index] : "";
  const name = RELATED_DIAGRAM_FORM3_PATTERN_TAB_LABELS[patternId];
  return `${circled}${name}`;
}

/** Assessment-unit identity is no longer a duplicate key. */
export function form3AssessmentOriginKey(input: {
  form3RecordId: string;
  patternId: string;
  assessmentId: string;
}): string {
  return `${input.form3RecordId}::${input.patternId}::${input.assessmentId}`;
}

export function form3InformationOriginKey(input: {
  form3RecordId: string;
  informationId: string;
}): string {
  return `info:${input.form3RecordId}::${input.informationId}`;
}

export function form3AssessmentSelectionOriginKey(input: {
  form3RecordId: string;
  assessmentId: string;
  selectionStart: number;
  selectionEnd: number;
}): string {
  return `assess:${input.form3RecordId}::${input.assessmentId}::${input.selectionStart}:${input.selectionEnd}`;
}

export function form3RecordRelation(form3RecordId: string): string {
  return `form3Record:${form3RecordId}`;
}

export function parseForm3RecordRelation(
  relation: string | null | undefined,
): string | null {
  if (!relation) return null;
  const prefix = "form3Record:";
  if (!relation.startsWith(prefix)) return null;
  const id = relation.slice(prefix.length).trim();
  return id.length > 0 ? id : null;
}

function isArchivedAssessment(
  status: Form3AssessmentCardV2["status"],
): boolean {
  return status === "archived";
}

function isArchivedInformation(
  status: Form3InformationCardV2["status"],
): boolean {
  return status === "archived";
}

function mapInformationCard(
  card: Form3InformationCardV2,
  input: { form3RecordId: string; sourceVersion: number },
): RelatedDiagramForm3InformationSource | null {
  if (isArchivedInformation(card.status)) return null;
  if (!card.id.trim()) return null;
  const content = card.content.trim();
  if (!content) return null;
  const patternKeys = card.patternKeys.filter((key) =>
    FORM3_PATTERN_ORDER.includes(key),
  );
  if (patternKeys.length === 0) return null;
  return {
    form3RecordId: input.form3RecordId,
    sourceVersion: input.sourceVersion,
    informationId: card.id,
    content,
    soType: card.soType,
    patternKeys,
  };
}

function mapAssessmentCard(
  card: Form3AssessmentCardV2,
  input: { form3RecordId: string; sourceVersion: number },
): RelatedDiagramForm3AssessmentSource | null {
  if (isArchivedAssessment(card.status)) return null;
  if (!card.patternKey) return null;
  if (!card.id.trim()) return null;
  const assessmentText = card.interpretation.trim();
  if (!assessmentText) return null;
  const patternIndex = FORM3_PATTERN_ORDER.indexOf(card.patternKey);
  if (patternIndex < 0) return null;
  const mapped = mapForm3JudgmentToCardState(card.classification);
  return {
    form3RecordId: input.form3RecordId,
    sourceVersion: input.sourceVersion,
    patternId: card.patternKey,
    patternName: RELATED_DIAGRAM_FORM3_PATTERN_LABELS[card.patternKey],
    patternIndex,
    patternCircled: CIRCLED[patternIndex] ?? "",
    assessmentId: card.id,
    assessmentText,
    judgment: card.classification,
    judgmentLabel: card.classification
      ? RELATED_DIAGRAM_FORM3_JUDGMENT_LABELS[card.classification]
      : null,
    state: mapped.state,
    stateMapping: mapped.mapping,
    hasEvidence: card.evidenceInformationIds.length > 0,
  };
}

export function emptyForm3ReadModel(input: {
  form3RecordId: string;
  sourceVersion: number;
}): RelatedDiagramForm3ReadModel {
  return {
    form3RecordId: input.form3RecordId,
    sourceVersion: input.sourceVersion,
    patterns: FORM3_PATTERN_ORDER.map((patternId, patternIndex) => ({
      patternId,
      patternName: RELATED_DIAGRAM_FORM3_PATTERN_LABELS[patternId],
      patternShortName: RELATED_DIAGRAM_FORM3_PATTERN_TAB_LABELS[patternId],
      patternIndex,
      patternCircled: CIRCLED[patternIndex] ?? "",
      assessments: [],
      informations: [],
    })),
    assessments: [],
    informations: [],
  };
}

export function mapForm3V2ToRelatedDiagramReadModel(input: {
  form3RecordId: string;
  sourceVersion: number;
  payload: Form3DataV2;
}): RelatedDiagramForm3ReadModel {
  const model = emptyForm3ReadModel({
    form3RecordId: input.form3RecordId,
    sourceVersion: input.sourceVersion,
  });
  const mapped = input.payload.assessmentCards
    .map((card) =>
      mapAssessmentCard(card, {
        form3RecordId: input.form3RecordId,
        sourceVersion: input.sourceVersion,
      }),
    )
    .filter((row): row is RelatedDiagramForm3AssessmentSource => row != null)
    .sort((a, b) => {
      if (a.patternIndex !== b.patternIndex) return a.patternIndex - b.patternIndex;
      return a.assessmentId.localeCompare(b.assessmentId);
    });
  model.assessments = mapped;
  for (const row of mapped) {
    const group = model.patterns[row.patternIndex];
    if (group) group.assessments.push(row);
  }

  const informations = input.payload.informationCards
    .map((card) =>
      mapInformationCard(card, {
        form3RecordId: input.form3RecordId,
        sourceVersion: input.sourceVersion,
      }),
    )
    .filter((row): row is RelatedDiagramForm3InformationSource => row != null)
    .sort((a, b) => a.informationId.localeCompare(b.informationId));
  model.informations = informations;
  for (const row of informations) {
    for (const patternId of row.patternKeys) {
      const group = model.patterns.find((p) => p.patternId === patternId);
      if (group) group.informations.push(row);
    }
  }
  return model;
}

export function mapUnknownForm3PayloadToReadModel(input: {
  form3RecordId: string;
  sourceVersion: number;
  payload: unknown;
}): MapForm3ReadModelResult {
  if (!isForm3DataV2(input.payload)) {
    return { ok: false, reason: "no_stable_assessment_identity" };
  }
  return {
    ok: true,
    model: mapForm3V2ToRelatedDiagramReadModel({
      form3RecordId: input.form3RecordId,
      sourceVersion: input.sourceVersion,
      payload: input.payload,
    }),
  };
}
