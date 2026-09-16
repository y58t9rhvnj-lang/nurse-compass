/**
 * DEV Form3 Assessment sources for the schizophrenia Related Diagram fixture.
 * Student interpretations only — not Knowledge Library content.
 */

import { createEmptyForm3V2 } from "../../../form3/v2/form3V2Factory";
import type {
  Form3AssessmentCardV2,
  Form3DataV2,
  Form3InformationCardV2,
  Form3SoType,
} from "../../../form3/v2/form3V2Types";
import type { Form3PatternKey } from "../../../form3/form3Types";
import {
  mapForm3V2ToRelatedDiagramReadModel,
  type RelatedDiagramForm3ReadModel,
} from "../form3AssessmentReadModel";

export const SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID =
  "dev-form3-schizophrenia-slice2b1";
export const SCHIZOPHRENIA_FORM3_FIXTURE_VERSION = 1;
export const SCHIZOPHRENIA_FORM3_FIXTURE_PATIENT_ID = "A";

const TS = "2026-09-16T00:00:00.000Z";

function assessment(
  id: string,
  patternKey: Form3AssessmentCardV2["patternKey"],
  interpretation: string,
  classification: Form3AssessmentCardV2["classification"],
  evidenceInformationIds: string[],
  order: number,
): Form3AssessmentCardV2 {
  return {
    id,
    interpretation,
    classification,
    evidenceInformationIds,
    needMoreInformation: "",
    patternKey,
    order,
    status: "reviewed",
    createdAt: TS,
    updatedAt: TS,
  };
}

/**
 * ≥3 patterns, ≥6 assessments, both current (problem) and potential (risk).
 * Facts align with the schizophrenia DEV patient story; no pathophysiology Knowledge.
 */
export const SCHIZOPHRENIA_FORM3_ASSESSMENT_CARDS: Form3AssessmentCardV2[] = [
  assessment(
    "f3a-dev-health-001",
    "health_perception_management",
    "入院環境を安心と感じ、服薬とSSTを続けられている。",
    "strength",
    ["info-health-sst"],
    0,
  ),
  assessment(
    "f3a-dev-sleep-001",
    "sleep_rest",
    "夜間の幻聴で入眠が妨げられ、翌日の活動に影響している。ラジオをつけても途中で目が覚めることがあり、朝は倦怠感が残る。",
    "problem",
    ["info-sleep-hallucination"],
    1,
  ),
  assessment(
    "f3a-dev-sleep-002",
    "sleep_rest",
    "睡眠薬とクエチアピン追加により、日中傾眠が生じる可能性がある。",
    "risk",
    ["info-sleep-meds"],
    2,
  ),
  assessment(
    "f3a-dev-activity-001",
    "activity_exercise",
    "OT参加が日によって変動しており、活動量が落ちる可能性がある。",
    "risk",
    ["info-activity-ot"],
    3,
  ),
  assessment(
    "f3a-dev-cognitive-001",
    "cognitive_perceptual",
    "幻聴「だめな人間だ」が残存し、自己評価を下げている。",
    "problem",
    ["info-cog-voice"],
    4,
  ),
  assessment(
    "f3a-dev-elimination-001",
    "elimination",
    "向精神薬と催眠薬の影響で、便秘が悪化する可能性がある。",
    "risk",
    ["info-eli-meds"],
    5,
  ),
  assessment(
    "f3a-dev-coping-001",
    "coping_stress_tolerance",
    "幻聴時にラジオと頓用で自分を落ち着ける手段を持っている。",
    "strength",
    ["info-coping-radio"],
    6,
  ),
];

function information(
  id: string,
  content: string,
  soType: Form3SoType,
  patternKeys: Form3PatternKey[],
  order: number,
): Form3InformationCardV2 {
  return {
    id,
    content,
    soType,
    sourceType: soType === "S" ? "patient_conversation" : "observation",
    patternKeys,
    order,
    status: "active",
    createdAt: TS,
    updatedAt: TS,
  };
}

export const SCHIZOPHRENIA_FORM3_INFORMATION_CARDS: Form3InformationCardV2[] = [
  information(
    "info-health-sst",
    "S「病院にいると安心する。SSTも続けたい」",
    "S",
    ["health_perception_management"],
    0,
  ),
  information(
    "info-health-meds",
    "朝夕の服薬を看護師の声かけで内服できている。",
    "O",
    ["health_perception_management"],
    1,
  ),
  information(
    "info-sleep-hallucination",
    "夜間に「だめな人間だ」という幻聴が聞こえ、入眠が途切れる。",
    "S",
    ["sleep_rest", "cognitive_perceptual"],
    2,
  ),
  information(
    "info-sleep-meds",
    "就寝前にクエチアピンとゾピクロンを内服している。",
    "O",
    ["sleep_rest", "activity_exercise"],
    3,
  ),
  information(
    "info-activity-ot",
    "OT参加が日によって変動している。",
    "O",
    ["activity_exercise"],
    4,
  ),
  information(
    "info-coping-radio",
    "幻聴時にラジオをつけて落ち着こうとしている。",
    "S",
    ["coping_stress_tolerance", "sleep_rest"],
    5,
  ),
];

export function buildSchizophreniaForm3V2Fixture(): Form3DataV2 {
  const payload = createEmptyForm3V2(SCHIZOPHRENIA_FORM3_FIXTURE_PATIENT_ID);
  return {
    ...payload,
    informationCards: SCHIZOPHRENIA_FORM3_INFORMATION_CARDS,
    assessmentCards: SCHIZOPHRENIA_FORM3_ASSESSMENT_CARDS,
    updatedAt: TS,
  };
}

export function buildSchizophreniaForm3ReadModel(): RelatedDiagramForm3ReadModel {
  return mapForm3V2ToRelatedDiagramReadModel({
    form3RecordId: SCHIZOPHRENIA_FORM3_FIXTURE_RECORD_ID,
    sourceVersion: SCHIZOPHRENIA_FORM3_FIXTURE_VERSION,
    payload: buildSchizophreniaForm3V2Fixture(),
  });
}
