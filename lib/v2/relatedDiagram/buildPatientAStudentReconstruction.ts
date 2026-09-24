/**
 * DEV ONLY — Patient A student-diagram reconstruction V1.
 * READ ONLY SNAPSHOT. DO NOT WRITE BACK.
 *
 * Reconstructs a student-like related-diagram density from Patient A Form3
 * only. The attached real-student image is a structure / granularity
 * reference — not a patient-data source and not a pixel copy.
 *
 * Connections are fixture-only
 * (`DEV_RECONSTRUCTED_STUDENT_CONNECTION`).
 * They are NOT production candidate-evidence lines and must never enter
 * the production Form3 compose path.
 *
 * Knowledge = 0: Patient A Form3 does not confirm a named disease model.
 * Nursing Problem cards are DEV_RECONSTRUCTION_ASSUMPTION names taken
 * from Assessment wording — not production NP provenance.
 */

import { A3_HEIGHT_PX, A3_WIDTH_PX } from "./a3Canvas";
import { getA3LegendBounds, rectIntersectsA3Legend } from "./a3Legend";
import {
  DIRECT_NURSING_PROBLEM_HEIGHT,
  DIRECT_NURSING_PROBLEM_WIDTH,
  buildDirectNursingProblemCard,
} from "./cardDirectNursingProblem";
import {
  PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
  clonePatientAForm3SkeletonSnapshot,
  type PatientAForm3SkeletonAssessment,
  type PatientAForm3SkeletonInformation,
  type PatientAForm3SkeletonSnapshot,
} from "./fixtures/patientAForm3SkeletonSnapshot";
import {
  mapForm3JudgmentToCardState,
  normalizeForm3EvidenceInformationIds,
} from "./form3AssessmentReadModel";
import {
  INFORMATION_CARD_HEIGHT,
  INFORMATION_CARD_WIDTH,
  UNDERSTANDING_CARD_HEIGHT,
  UNDERSTANDING_CARD_WIDTH,
  buildUnderstandingCardFromAssessmentSelection,
  form3AssessmentSelectionCardId,
} from "./form3ToUnderstandingCard";
import { emptyRelatedDiagramGraph } from "./resolveReadonlyScene";
import { RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION } from "./types";
import type {
  RelatedDiagramCard,
  RelatedDiagramCardSource,
  RelatedDiagramConnection,
  RelatedDiagramConnectionRelationType,
  RelatedDiagramNursingProblemSupport,
  RelatedDiagramSemanticGraph,
} from "./types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";

export const PATIENT_A_DEV_RECONSTRUCTION_KIND =
  "patient_a_student_reconstruction_dev_only" as const;

/** Fixture-only. Not a production Form3 record id. */
export const PATIENT_A_DEV_RECONSTRUCTION_FORM3_RECORD_ID =
  "dev-patient-a-reconstruction-not-a-db-id";

export const DEV_RECONSTRUCTED_STUDENT_CONNECTION =
  "DEV_RECONSTRUCTED_STUDENT_CONNECTION" as const;

export const DEV_RECONSTRUCTION_ASSUMPTION =
  "DEV_RECONSTRUCTION_ASSUMPTION" as const;

/**
 * Frozen origin used only as a visual/routing carrier.
 * Does not mean the student drew these lines in production.
 */
export const PATIENT_A_DEV_RECONSTRUCTED_CONNECTION_ORIGIN =
  "student_diagram" as const;

const DEV_TS = "2026-09-21T13:00:00.000Z";

export type PatientAReconstructionCluster =
  | "family_social"
  | "admission_life"
  | "treatment"
  | "hallucination_cognition"
  | "sleep"
  | "activity_selfcare"
  | "nutrition"
  | "elimination"
  | "psychosocial"
  | "coping"
  | "nursing_problem";

export type PatientAReconstructionStats = {
  information: number;
  understanding: number;
  knowledge: number;
  nursingProblem: number;
  cards: number;
  connections: number;
  junctions: number;
};

export type PatientAReconstructionConnectionMeta = {
  id: string;
  kind: typeof DEV_RECONSTRUCTED_STUDENT_CONNECTION;
  sourceKey: string;
  targetKey: string;
  relationType: RelatedDiagramConnectionRelationType;
};

export type PatientAReconstructionNpAssumption = {
  kind: typeof DEV_RECONSTRUCTION_ASSUMPTION;
  cardId: string;
  sourceAssessmentId: string;
  excerpt: string;
};

export type PatientAStudentReconstructionScene = {
  kind: typeof PATIENT_A_DEV_RECONSTRUCTION_KIND;
  graph: RelatedDiagramSemanticGraph;
  stats: PatientAReconstructionStats;
  clusters: PatientAReconstructionCluster[];
  connectionMeta: PatientAReconstructionConnectionMeta[];
  nursingProblemAssumptions: PatientAReconstructionNpAssumption[];
  cardKeys: Record<string, string>;
};

type InfoSpec = {
  key: string;
  informationId: string;
  excerpt: string;
  x: number;
  y: number;
  cluster: PatientAReconstructionCluster;
};

type UnderstandingSpec = {
  key: string;
  assessmentId: string;
  excerpt: string;
  x: number;
  y: number;
  cluster: PatientAReconstructionCluster;
};

type ConnectionSpec = {
  from: string;
  to: string;
  relationType: RelatedDiagramConnectionRelationType;
};

function compareId(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function requireSlice(source: string, excerpt: string, label: string): {
  selectedText: string;
  selectionStart: number;
  selectionEnd: number;
} {
  const selectionStart = source.indexOf(excerpt);
  if (selectionStart < 0) {
    throw new Error(`Patient A excerpt missing (${label}): ${excerpt}`);
  }
  return {
    selectedText: excerpt,
    selectionStart,
    selectionEnd: selectionStart + excerpt.length,
  };
}

function clampAwayFromLegend(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const legend = getA3LegendBounds();
  const margin = 14;
  let px = Math.max(margin, Math.min(A3_WIDTH_PX - width - margin, x));
  let py = Math.max(margin, Math.min(A3_HEIGHT_PX - height - margin, y));
  const box = { x: px, y: py, width, height };
  if (rectIntersectsA3Legend(box)) {
    px = Math.max(margin, legend.x - width - 18);
    if (rectIntersectsA3Legend({ x: px, y: py, width, height })) {
      py = Math.max(margin, legend.y - height - 18);
    }
  }
  return { x: px, y: py };
}

const INFO_SPECS: InfoSpec[] = [
  { key: "admission_2y", informationId: "8c22653d-121c-4525-b265-412cd453bceb", excerpt: "入院期間2年", x: 28, y: 36, cluster: "admission_life" },
  { key: "voluntary", informationId: "a495a199-56f5-49c2-bf25-a5d5ab8c9a8e", excerpt: "現在も任意入院", x: 36, y: 132, cluster: "admission_life" },
  { key: "gaf", informationId: "a495a199-56f5-49c2-bf25-a5d5ab8c9a8e", excerpt: "GAF 50", x: 48, y: 228, cluster: "admission_life" },
  { key: "relapse_2009", informationId: "a495a199-56f5-49c2-bf25-a5d5ab8c9a8e", excerpt: "2009年の入院は服薬中断後の再発", x: 22, y: 324, cluster: "admission_life" },
  { key: "uncle", informationId: "18b7e66b-223d-4feb-83fa-91fd91ca4ee7", excerpt: "高齢の叔父がキーパーソン", x: 30, y: 430, cluster: "family_social" },
  { key: "uncle_visit", informationId: "278cbb0f-fc39-4e43-8457-f9cb1651eac3", excerpt: "高齢の叔父がキーパーソンだが面会は減少している。", x: 18, y: 526, cluster: "family_social" },
  { key: "uncle_sad", informationId: "ad6d1752-c74b-4046-9cee-7d1d5d62ee54", excerpt: "叔父の面会が減っている話題に触れ、沈んだ表情", x: 40, y: 632, cluster: "family_social" },
  { key: "no_home", informationId: "18b7e66b-223d-4feb-83fa-91fd91ca4ee7", excerpt: "帰る家がない", x: 26, y: 738, cluster: "family_social" },
  { key: "unemployed", informationId: "18b7e66b-223d-4feb-83fa-91fd91ca4ee7", excerpt: "現在無職", x: 44, y: 844, cluster: "family_social" },
  { key: "money", informationId: "e557cd4e-4d77-4c8f-8518-df58960083f1", excerpt: "「お金が足りなくなった」", x: 20, y: 950, cluster: "family_social" },

  { key: "rejected", informationId: "ae9181a1-6b3e-454f-8aec-5b54c5285fb2", excerpt: "「嫌われたのかな」", x: 236, y: 48, cluster: "psychosocial" },
  { key: "voice", informationId: "47977aa0-1eff-4a39-add3-6e8b1db929f2", excerpt: "「だめな人間だ、と聞こえる」", x: 248, y: 154, cluster: "hallucination_cognition" },
  { key: "quiet", informationId: "8514f912-3a1e-42ef-8c29-ed098e14a27d", excerpt: "物静かで内向的", x: 228, y: 268, cluster: "psychosocial" },
  { key: "calm_i", informationId: "0d9e1e78-f101-4c59-b85c-62c822ad3a4c", excerpt: "「Iさんといると落ち着く」", x: 252, y: 374, cluster: "psychosocial" },
  { key: "courtyard", informationId: "18b7e66b-223d-4feb-83fa-91fd91ca4ee7", excerpt: "同室Iさんと中庭で菓子を分け合い過ごす", x: 232, y: 480, cluster: "psychosocial" },
  { key: "can_i", informationId: "bdcfcec8-434c-483a-9d85-1018e7013bb5", excerpt: "自分にもできるかな", x: 244, y: 586, cluster: "psychosocial" },
  { key: "advance", informationId: "14ec64d3-b61b-4587-ac6f-523f3e8bfed4", excerpt: "2週間分の前借りを希望", x: 220, y: 700, cluster: "hallucination_cognition" },
  { key: "laundry", informationId: "646a1897-ca45-4607-8d39-9905671ef9b3", excerpt: "入浴後にため込んでいた下着をまとめて洗う様子", x: 238, y: 806, cluster: "activity_selfcare" },
  { key: "hospital_safe", informationId: "6f77504b-1ad9-4f2c-9e73-179bf70fbe70", excerpt: "「ここ（病院）にいる方が安心」", x: 226, y: 920, cluster: "coping" },

  { key: "full_meds", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "定期薬は全量服用", x: 456, y: 28, cluster: "treatment" },
  { key: "risperidone", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "リスペリドン錠2mg", x: 472, y: 118, cluster: "treatment" },
  { key: "quetiapine", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "クエチアピン錠50mg 就寝前", x: 448, y: 210, cluster: "treatment" },
  { key: "zopiclone", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "ゾピクロン錠7.5mg 就寝前", x: 464, y: 302, cluster: "treatment" },
  { key: "brotizolam", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "ブロチゾラム錠0.25mg", x: 452, y: 396, cluster: "treatment" },
  { key: "sennoside", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "センノシド錠12mg", x: 478, y: 490, cluster: "treatment" },
  { key: "morning_prompt", informationId: "4a2ee2a9-22ba-4eac-91b9-01c130584929", excerpt: "朝は促しが必要な日がある", x: 440, y: 586, cluster: "treatment" },
  { key: "policy", informationId: "1b129122-2cfe-4c69-a448-0d10e6e96c55", excerpt: "段階的な自己管理・地域生活の検討", x: 458, y: 690, cluster: "treatment" },

  { key: "halluc_sleep", informationId: "cc733032-c8de-469b-b12e-7a32e674a81e", excerpt: "夜間幻聴で入眠困難の夜あり", x: 678, y: 40, cluster: "sleep" },
  { key: "radio", informationId: "cc733032-c8de-469b-b12e-7a32e674a81e", excerpt: "ラジオを小音で流して対処", x: 694, y: 146, cluster: "coping" },
  { key: "morning_drowsy", informationId: "cc733032-c8de-469b-b12e-7a32e674a81e", excerpt: "翌朝は起床が遅く眠気が残ることがある", x: 668, y: 252, cluster: "sleep" },
  { key: "ot_refuse", informationId: "49a4f08e-fb11-4817-9888-84c98d00db13", excerpt: "「気が向かない」と辞退", x: 686, y: 368, cluster: "activity_selfcare" },
  { key: "sst", informationId: "e29e8e0f-7de9-4fb6-836a-1ed1944fbbb9", excerpt: "SST参加は定着", x: 704, y: 474, cluster: "activity_selfcare" },
  { key: "indoor", informationId: "e29e8e0f-7de9-4fb6-836a-1ed1944fbbb9", excerpt: "日中は室内中心の日が多い", x: 672, y: 580, cluster: "activity_selfcare" },
  { key: "bath", informationId: "e29e8e0f-7de9-4fb6-836a-1ed1944fbbb9", excerpt: "入浴・洗濯は促しで実施", x: 690, y: 686, cluster: "activity_selfcare" },

  { key: "snack", informationId: "0f7fd20d-3262-4e71-8e4f-0cde3b65e0a3", excerpt: "間食は一つ", x: 910, y: 32, cluster: "nutrition" },
  { key: "lighter", informationId: "0f7fd20d-3262-4e71-8e4f-0cde3b65e0a3", excerpt: "少し軽くなった", x: 926, y: 128, cluster: "nutrition" },
  { key: "weight", informationId: "f1c1a89e-1c2c-439a-b8bf-f0ab142689ef", excerpt: "体重70.2kg", x: 902, y: 226, cluster: "nutrition" },
  { key: "waist", informationId: "f1c1a89e-1c2c-439a-b8bf-f0ab142689ef", excerpt: "腹囲約85cmまで減少", x: 918, y: 322, cluster: "nutrition" },
  { key: "lipid", informationId: "f1c1a89e-1c2c-439a-b8bf-f0ab142689ef", excerpt: "以前の脂質異常は改善", x: 896, y: 418, cluster: "nutrition" },
  { key: "bmi", informationId: "f1c1a89e-1c2c-439a-b8bf-f0ab142689ef", excerpt: "BMIは過体重域が続く", x: 922, y: 514, cluster: "nutrition" },
  { key: "water", informationId: "f1c1a89e-1c2c-439a-b8bf-f0ab142689ef", excerpt: "水分約1000〜1300ml", x: 908, y: 620, cluster: "nutrition" },
  { key: "bowel_var", informationId: "069ee59e-5d36-461d-9151-485ad1683e03", excerpt: "排便間隔に変動あり", x: 930, y: 726, cluster: "elimination" },
  { key: "constipation_report", informationId: "801fab3a-d4c5-493b-a7f7-88784652abdf", excerpt: "便秘など体調の変化を自分で訴え、頓服を求めることができる。", x: 888, y: 832, cluster: "elimination" },
];

const UNDERSTANDING_SPECS: UnderstandingSpec[] = [
  { key: "u_meds_ok", assessmentId: "922d2ff5-9248-4668-bb36-2097f837abd6", excerpt: "定期薬は全量服用し飲み忘れはない", x: 1124, y: 24, cluster: "treatment" },
  { key: "u_meds_understand", assessmentId: "922d2ff5-9248-4668-bb36-2097f837abd6", excerpt: "服薬の必要性は理解している", x: 1140, y: 118, cluster: "treatment" },
  { key: "u_no_confidence", assessmentId: "922d2ff5-9248-4668-bb36-2097f837abd6", excerpt: "自己管理には自信がない様子である", x: 1110, y: 214, cluster: "psychosocial" },
  { key: "u_hospital_anxiety", assessmentId: "922d2ff5-9248-4668-bb36-2097f837abd6", excerpt: "病院への安心は、地域生活の具体像や支えが見えない不安の表れである可能性がある", x: 1128, y: 318, cluster: "coping" },
  { key: "u_food_adjust", assessmentId: "edcf9ff3-8569-46ad-ab46-bf36cd27e7dd", excerpt: "食行動の自己調整が続いており", x: 1102, y: 430, cluster: "nutrition" },
  { key: "u_overweight", assessmentId: "edcf9ff3-8569-46ad-ab46-bf36cd27e7dd", excerpt: "過体重は残っている", x: 1136, y: 526, cluster: "nutrition" },
  { key: "u_weight_risk", assessmentId: "edcf9ff3-8569-46ad-ab46-bf36cd27e7dd", excerpt: "室内中心の活動と抗精神病薬の使用は、今後体重が戻りやすい条件になり得る", x: 1118, y: 622, cluster: "nutrition" },
  { key: "u_const_report", assessmentId: "047e9cd1-203b-461c-b04d-a78e136c4826", excerpt: "便秘は再発しうるが、援助を求めて悪化を自己申告できる状態である", x: 1096, y: 728, cluster: "elimination" },
  { key: "u_const_cause", assessmentId: "047e9cd1-203b-461c-b04d-a78e136c4826", excerpt: "抗精神病薬・催眠薬、活動低下、水分量が便秘に関与している可能性はある", x: 1122, y: 824, cluster: "elimination" },

  { key: "u_sst", assessmentId: "6e15c11c-9774-4212-914e-6e9e05e06bc4", excerpt: "SST参加は定着している", x: 456, y: 804, cluster: "activity_selfcare" },
  { key: "u_selfcare", assessmentId: "6e15c11c-9774-4212-914e-6e9e05e06bc4", excerpt: "セルフケアは促し依存が残る", x: 670, y: 804, cluster: "activity_selfcare" },
  { key: "u_ot_fatigue", assessmentId: "6e15c11c-9774-4212-914e-6e9e05e06bc4", excerpt: "OT辞退は意欲の欠如というより、易疲労・前夜の睡眠・本人のペースと関連している可能性がある", x: 668, y: 910, cluster: "activity_selfcare" },
  { key: "u_sleep_core", assessmentId: "13a657cd-53e9-47b0-8185-9c538f6292ec", excerpt: "睡眠障害の中心は、夜間幻聴という体験である", x: 458, y: 910, cluster: "sleep" },
  { key: "u_prn_morning", assessmentId: "13a657cd-53e9-47b0-8185-9c538f6292ec", excerpt: "頓用は入眠を助ける一方、翌朝の活動を下げうる", x: 236, y: 1010, cluster: "sleep" },
  { key: "u_self_eval", assessmentId: "568ab3b4-c9e8-42f0-b3a8-b5f957c4c3f2", excerpt: "自己評価の低下は、幻聴内容・家族関係の不確かさ・地域生活の見通しのなさから複合的に生じている可能性がある", x: 454, y: 1010, cluster: "psychosocial" },
  { key: "u_other_self", assessmentId: "568ab3b4-c9e8-42f0-b3a8-b5f957c4c3f2", excerpt: "安心できる関係の中では、別の自己像が現れている", x: 678, y: 1010, cluster: "psychosocial" },
  { key: "u_select_relation", assessmentId: "3bb8afb3-07bd-44a9-bb11-8e81858ee3a8", excerpt: "安心できる相手を選んで関係を維持できる", x: 888, y: 940, cluster: "psychosocial" },
  { key: "u_role_weak", assessmentId: "3bb8afb3-07bd-44a9-bb11-8e81858ee3a8", excerpt: "退院後の役割基盤は未整備である", x: 22, y: 1036, cluster: "family_social" },
  { key: "u_coping", assessmentId: "d4772285-c5a4-468b-95b4-5f4fa03f36e2", excerpt: "自己対処と援助希求という対処レパートリーは、すでに複数存在する", x: 888, y: 1016, cluster: "coping" },
  { key: "u_coping_risk", assessmentId: "d4772285-c5a4-468b-95b4-5f4fa03f36e2", excerpt: "対処が入院環境の手段に偏っているため、環境が変わると効きにくくなるリスクはある", x: 1104, y: 930, cluster: "coping" },
  { key: "u_values", assessmentId: "91f169f3-8d7a-4556-906e-378a45d8b89f", excerpt: "価値観の中心は安全・ペース・段階性であり、変化の拒否ではない", x: 1296, y: 40, cluster: "coping" },
  { key: "u_night_halluc", assessmentId: "b7439f34-aef6-43dd-83c9-aca109a9137a", excerpt: "夜間に幻聴がある", x: 1308, y: 146, cluster: "hallucination_cognition" },
  { key: "u_esteem", assessmentId: "b7439f34-aef6-43dd-83c9-aca109a9137a", excerpt: "自尊心や自己効力感が低下", x: 1290, y: 252, cluster: "psychosocial" },
  { key: "u_exec", assessmentId: "0b031a77-e5c7-41b9-8a42-106a964f4f41", excerpt: "実行機能の低下", x: 1314, y: 358, cluster: "hallucination_cognition" },
  { key: "u_independence", assessmentId: "0b031a77-e5c7-41b9-8a42-106a964f4f41", excerpt: "自立性の障害", x: 1298, y: 464, cluster: "activity_selfcare" },
  { key: "u_social_cog", assessmentId: "0e0c43c9-8a8a-4cca-9a48-8d1b2d38d470", excerpt: "社会的認知機能の障害", x: 1310, y: 570, cluster: "hallucination_cognition" },
];

const NP_SPECS = [
  {
    key: "np_selfcare",
    assessmentId: "6e15c11c-9774-4212-914e-6e9e05e06bc4",
    excerpt: "セルフケアは促し依存が残る",
    x: 1298,
    y: 676,
    state: "current" as const,
  },
  {
    key: "np_selfeval",
    assessmentId: "568ab3b4-c9e8-42f0-b3a8-b5f957c4c3f2",
    excerpt: "自己評価の低下",
    x: 1284,
    y: 780,
    state: "current" as const,
  },
];

const CONNECTION_SPECS: ConnectionSpec[] = [
  { from: "admission_2y", to: "no_home", relationType: "current" },
  { from: "no_home", to: "hospital_safe", relationType: "current" },
  { from: "no_home", to: "u_role_weak", relationType: "current" },
  { from: "unemployed", to: "u_role_weak", relationType: "current" },
  { from: "uncle", to: "uncle_visit", relationType: "current" },
  { from: "uncle_visit", to: "uncle_sad", relationType: "current" },
  { from: "uncle_sad", to: "rejected", relationType: "current" },
  { from: "rejected", to: "u_social_cog", relationType: "current" },
  { from: "u_social_cog", to: "u_self_eval", relationType: "current" },
  { from: "money", to: "advance", relationType: "current" },
  { from: "advance", to: "u_exec", relationType: "current" },
  { from: "laundry", to: "u_exec", relationType: "current" },
  { from: "u_exec", to: "u_independence", relationType: "current" },
  { from: "calm_i", to: "courtyard", relationType: "current" },
  { from: "courtyard", to: "u_select_relation", relationType: "current" },
  { from: "quiet", to: "u_select_relation", relationType: "current" },
  { from: "can_i", to: "u_other_self", relationType: "current" },
  { from: "u_select_relation", to: "u_other_self", relationType: "current" },
  { from: "voluntary", to: "gaf", relationType: "current" },
  { from: "gaf", to: "u_role_weak", relationType: "potential" },
  { from: "relapse_2009", to: "full_meds", relationType: "potential" },
  { from: "full_meds", to: "u_meds_ok", relationType: "current" },
  { from: "u_meds_ok", to: "u_meds_understand", relationType: "current" },
  { from: "u_meds_understand", to: "u_no_confidence", relationType: "current" },
  { from: "morning_prompt", to: "u_no_confidence", relationType: "current" },
  { from: "can_i", to: "u_no_confidence", relationType: "current" },
  { from: "policy", to: "u_values", relationType: "current" },
  { from: "risperidone", to: "u_const_cause", relationType: "treatment" },
  { from: "quetiapine", to: "u_sleep_core", relationType: "treatment" },
  { from: "zopiclone", to: "u_sleep_core", relationType: "treatment" },
  { from: "brotizolam", to: "u_prn_morning", relationType: "treatment" },
  { from: "sennoside", to: "bowel_var", relationType: "treatment" },
  { from: "voice", to: "u_night_halluc", relationType: "current" },
  { from: "u_night_halluc", to: "halluc_sleep", relationType: "current" },
  { from: "halluc_sleep", to: "u_sleep_core", relationType: "current" },
  { from: "radio", to: "u_coping", relationType: "current" },
  { from: "u_sleep_core", to: "u_prn_morning", relationType: "potential" },
  { from: "morning_drowsy", to: "u_ot_fatigue", relationType: "current" },
  { from: "u_ot_fatigue", to: "ot_refuse", relationType: "current" },
  { from: "u_night_halluc", to: "u_esteem", relationType: "current" },
  { from: "u_esteem", to: "u_self_eval", relationType: "current" },
  { from: "voice", to: "u_self_eval", relationType: "current" },
  { from: "sst", to: "u_sst", relationType: "current" },
  { from: "indoor", to: "u_weight_risk", relationType: "current" },
  { from: "bath", to: "u_selfcare", relationType: "current" },
  { from: "snack", to: "u_food_adjust", relationType: "current" },
  { from: "lighter", to: "u_food_adjust", relationType: "current" },
  { from: "weight", to: "u_overweight", relationType: "current" },
  { from: "bmi", to: "u_overweight", relationType: "current" },
  { from: "waist", to: "u_food_adjust", relationType: "current" },
  { from: "lipid", to: "u_food_adjust", relationType: "current" },
  { from: "u_overweight", to: "u_weight_risk", relationType: "potential" },
  { from: "water", to: "u_const_cause", relationType: "potential" },
  { from: "constipation_report", to: "u_const_report", relationType: "current" },
  { from: "bowel_var", to: "u_const_cause", relationType: "potential" },
  { from: "hospital_safe", to: "u_hospital_anxiety", relationType: "potential" },
  { from: "hospital_safe", to: "u_coping", relationType: "current" },
  { from: "u_coping", to: "u_coping_risk", relationType: "potential" },
  { from: "u_hospital_anxiety", to: "u_self_eval", relationType: "potential" },
  { from: "u_selfcare", to: "np_selfcare", relationType: "nursing_problem_basis" },
  { from: "u_independence", to: "np_selfcare", relationType: "nursing_problem_basis" },
  { from: "u_self_eval", to: "np_selfeval", relationType: "nursing_problem_basis" },
  { from: "u_sleep_core", to: "np_selfeval", relationType: "nursing_problem_basis" },
  { from: "u_role_weak", to: "np_selfeval", relationType: "nursing_problem_basis" },
];

export const PATIENT_A_STUDENT_RECONSTRUCTION_PLAN: PatientAReconstructionStats = {
  information: INFO_SPECS.length,
  understanding: UNDERSTANDING_SPECS.length,
  knowledge: 0,
  nursingProblem: NP_SPECS.length,
  cards: INFO_SPECS.length + UNDERSTANDING_SPECS.length + NP_SPECS.length,
  connections: CONNECTION_SPECS.length,
  junctions: 0,
};

export const PATIENT_A_RECONSTRUCTION_CLUSTERS: PatientAReconstructionCluster[] = [
  "family_social",
  "admission_life",
  "treatment",
  "hallucination_cognition",
  "sleep",
  "activity_selfcare",
  "nutrition",
  "elimination",
  "psychosocial",
  "coping",
  "nursing_problem",
];

function infoCardId(key: string): string {
  return `pa_rs_i_${key}`;
}

function npCardId(key: string): string {
  return `pa_rs_np_${key}`;
}

function connectionId(from: string, to: string): string {
  return `pa_rs_c_${from}_${to}`;
}

function buildAssessmentSource(
  card: PatientAForm3SkeletonAssessment,
): Parameters<typeof buildUnderstandingCardFromAssessmentSelection>[0]["source"] {
  const mapped = mapForm3JudgmentToCardState(card.classification);
  return {
    form3RecordId: PATIENT_A_DEV_RECONSTRUCTION_FORM3_RECORD_ID,
    sourceVersion: 34,
    patternId: (card.patternKey ?? "cognitive_perceptual") as Form3PatternKey,
    patternName: card.patternKey ?? "cognitive_perceptual",
    patternIndex: card.order,
    patternCircled: "",
    assessmentId: card.id,
    assessmentText: card.interpretation,
    judgment: card.classification,
    judgmentLabel: card.classification,
    state: mapped.state,
    stateMapping: mapped.mapping,
    evidenceInformationIds: normalizeForm3EvidenceInformationIds(
      card.evidenceInformationIds,
    ),
    hasEvidence: card.evidenceInformationIds.length > 0,
  };
}

function buildInformationCard(
  spec: InfoSpec,
  info: PatientAForm3SkeletonInformation,
): { card: RelatedDiagramCard; source: RelatedDiagramCardSource } {
  const slice = requireSlice(info.content, spec.excerpt, spec.key);
  const pos = clampAwayFromLegend(
    spec.x,
    spec.y,
    INFORMATION_CARD_WIDTH,
    INFORMATION_CARD_HEIGHT,
  );
  const id = infoCardId(spec.key);
  return {
    card: {
      id,
      cardType: "information",
      text: spec.excerpt,
      state: null,
      origin: "form3_information",
      layout: {
        x: pos.x,
        y: pos.y,
        width: INFORMATION_CARD_WIDTH,
        height: INFORMATION_CARD_HEIGHT,
        zIndex: 1,
      },
      isLocked: false,
      createdAt: DEV_TS,
      updatedAt: DEV_TS,
    },
    source: {
      id: `pa_rs_is_${spec.key}`,
      cardId: id,
      sourceType: "form3_information_card",
      sourceId: info.id,
      sourceVersion: "34",
      sourcePattern: info.patternKeys[0] ?? null,
      relation: `${DEV_RECONSTRUCTED_STUDENT_CONNECTION}:form3_information`,
      sourceExcerpt: spec.excerpt,
      selectedText: slice.selectedText,
      selectionStart: slice.selectionStart,
      selectionEnd: slice.selectionEnd,
      sourcePatterns: [...info.patternKeys],
      sourceSoType: info.soType,
      createdAt: DEV_TS,
    },
  };
}

export function buildPatientAStudentReconstruction(
  snapshot: PatientAForm3SkeletonSnapshot = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
): PatientAStudentReconstructionScene {
  const frozen = clonePatientAForm3SkeletonSnapshot(snapshot);
  const infos = new Map(frozen.informationCards.map((card) => [card.id, card]));
  const assessments = new Map(
    frozen.assessmentCards.map((card) => [card.id, card]),
  );

  const informationBuilt = INFO_SPECS.map((spec) => {
    const info = infos.get(spec.informationId);
    if (!info) {
      throw new Error(`Missing Form3 information ${spec.informationId}`);
    }
    if (info.status !== "active") {
      throw new Error(`Information ${spec.key} is not active Patient A source`);
    }
    return { spec, ...buildInformationCard(spec, info) };
  });

  const understandingBuilt = UNDERSTANDING_SPECS.map((spec) => {
    const assessment = assessments.get(spec.assessmentId);
    if (!assessment) {
      throw new Error(`Missing Form3 assessment ${spec.assessmentId}`);
    }
    if (assessment.status === "archived") {
      throw new Error(`Assessment ${spec.key} is archived`);
    }
    const slice = requireSlice(
      assessment.interpretation,
      spec.excerpt,
      spec.key,
    );
    const mapped = mapForm3JudgmentToCardState(assessment.classification);
    const pos = clampAwayFromLegend(
      spec.x,
      spec.y,
      UNDERSTANDING_CARD_WIDTH,
      UNDERSTANDING_CARD_HEIGHT,
    );
    const built = buildUnderstandingCardFromAssessmentSelection({
      source: buildAssessmentSource(assessment),
      selection: slice,
      editedText: spec.excerpt,
      state: mapped.state,
      layout: { x: pos.x, y: pos.y, zIndex: 2 },
      now: DEV_TS,
      cardId: form3AssessmentSelectionCardId(
        assessment.id,
        slice.selectionStart,
        slice.selectionEnd,
      ),
    });
    return { spec, card: built.card, source: built.sources[0]! };
  });

  const npAssumptions: PatientAReconstructionNpAssumption[] = [];
  const nursingBuilt = NP_SPECS.map((spec) => {
    const assessment = assessments.get(spec.assessmentId);
    if (!assessment) {
      throw new Error(`Missing Form3 assessment for NP ${spec.key}`);
    }
    requireSlice(assessment.interpretation, spec.excerpt, spec.key);
    const pos = clampAwayFromLegend(
      spec.x,
      spec.y,
      DIRECT_NURSING_PROBLEM_WIDTH,
      DIRECT_NURSING_PROBLEM_HEIGHT,
    );
    const built = buildDirectNursingProblemCard({
      text: spec.excerpt,
      state: spec.state,
      layout: { x: pos.x, y: pos.y, zIndex: 3 },
      cardId: npCardId(spec.key),
      now: DEV_TS,
    });
    npAssumptions.push({
      kind: DEV_RECONSTRUCTION_ASSUMPTION,
      cardId: built.card.id,
      sourceAssessmentId: spec.assessmentId,
      excerpt: spec.excerpt,
    });
    return { spec, ...built };
  });

  const cardByKey = new Map<string, string>();
  for (const row of informationBuilt) cardByKey.set(row.spec.key, row.card.id);
  for (const row of understandingBuilt) cardByKey.set(row.spec.key, row.card.id);
  for (const row of nursingBuilt) cardByKey.set(row.spec.key, row.card.id);

  const connectionMeta: PatientAReconstructionConnectionMeta[] = [];
  const connections: RelatedDiagramConnection[] = CONNECTION_SPECS.map((spec) => {
    const sourceCardId = cardByKey.get(spec.from);
    const targetCardId = cardByKey.get(spec.to);
    if (!sourceCardId || !targetCardId) {
      throw new Error(`Connection endpoint missing: ${spec.from} → ${spec.to}`);
    }
    const id = connectionId(spec.from, spec.to);
    connectionMeta.push({
      id,
      kind: DEV_RECONSTRUCTED_STUDENT_CONNECTION,
      sourceKey: spec.from,
      targetKey: spec.to,
      relationType: spec.relationType,
    });
    return {
      id,
      sourceCardId,
      targetCardId,
      relationType: spec.relationType,
      origin: PATIENT_A_DEV_RECONSTRUCTED_CONNECTION_ORIGIN,
      createdAt: DEV_TS,
      updatedAt: DEV_TS,
    };
  });

  const supports: RelatedDiagramNursingProblemSupport[] = CONNECTION_SPECS
    .filter((spec) => spec.relationType === "nursing_problem_basis")
    .map((spec) => ({
      nursingProblemCardId: cardByKey.get(spec.to)!,
      supportingCardId: cardByKey.get(spec.from)!,
      createdAt: DEV_TS,
    }));

  const cards = [
    ...informationBuilt.map((row) => row.card),
    ...understandingBuilt.map((row) => row.card),
    ...nursingBuilt.map((row) => row.card),
  ].sort((a, b) => compareId(a.id, b.id));
  const cardSources = [
    ...informationBuilt.map((row) => row.source),
    ...understandingBuilt.map((row) => row.source),
  ].sort((a, b) => compareId(a.id, b.id));
  connections.sort((a, b) => compareId(a.id, b.id));
  connectionMeta.sort((a, b) => compareId(a.id, b.id));

  const graph: RelatedDiagramSemanticGraph = {
    ...emptyRelatedDiagramGraph(),
    semanticSchemaVersion: RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION,
    cards,
    cardSources,
    connections,
    nursingProblems: nursingBuilt
      .map((row) => row.nursingProblem!)
      .sort((a, b) => compareId(a.cardId, b.cardId)),
    nursingProblemSupports: supports.sort((a, b) =>
      compareId(a.supportingCardId, b.supportingCardId),
    ),
  };

  return {
    kind: PATIENT_A_DEV_RECONSTRUCTION_KIND,
    graph,
    stats: {
      information: informationBuilt.length,
      understanding: understandingBuilt.length,
      knowledge: 0,
      nursingProblem: nursingBuilt.length,
      cards: cards.length,
      connections: connections.length,
      junctions: 0,
    },
    clusters: [...PATIENT_A_RECONSTRUCTION_CLUSTERS],
    connectionMeta,
    nursingProblemAssumptions: npAssumptions,
    cardKeys: Object.fromEntries(cardByKey),
  };
}
