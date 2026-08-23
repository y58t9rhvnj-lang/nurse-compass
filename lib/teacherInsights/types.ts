/**
 * Teacher Insight Library（教員向け教育知識）のドメイン型。
 *
 * - Gold Standard（模範思考の追体験）とは別系統。
 * - 完成答案・診断名の正解化・教員アセスメント原文の収録はしない。
 * - 学生向け UI / API / クライアントから本文モジュールを import しないこと。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";

export const TEACHER_INSIGHT_SCHEMA_VERSION = 1 as const;

export type TeacherInsightScope = "general" | "patient_specific";

/**
 * 仮説の確信度スコアではなく、カタログ根拠との関係状態。
 * AI / 教員が「どこまで言えるか」を選ぶための構造。
 */
export type TeacherInsightHypothesisEvidenceState =
  | "supported_by_catalog"
  | "partially_supported"
  | "insufficient_evidence"
  | "open_alternative";

export type TeacherInsightHypothesis = {
  id: string;
  text: string;
  evidenceState: TeacherInsightHypothesisEvidenceState;
  supportingEvidenceIds: readonly string[];
  /** カタログに無い／未確認で仮説を抑えるべき点 */
  contradictingOrMissingEvidence: readonly string[];
  caution?: string;
};

export type CoachingQuestionStage =
  | "facts"
  | "meaning"
  | "missing"
  | "update"
  | "reflection";

/**
 * 将来 AI Compass Coach が問いを選択できる単位。
 * 自由記述の塊ではなく、stage / purpose / avoidWhen を持つ。
 */
export type TeacherInsightCoachingQuestion = {
  id: string;
  question: string;
  purpose: string;
  stage: CoachingQuestionStage;
  prerequisites?: readonly string[];
  avoidWhen?: readonly string[];
  relatedPatternKeys: readonly Form3PatternKey[];
};

export type TeacherInsightGoldRelationshipKind =
  | "reinforces"
  | "extends"
  | "contrasts_risk"
  | "independent";

export type TeacherInsightGoldRelationship = {
  kind: TeacherInsightGoldRelationshipKind;
  /** 関連 CTP（任意。Gold 本文を埋め込まない） */
  relatedCtpIds: readonly string[];
  note: string;
};

export type TeacherInsightSourceMetadata = {
  sourceType: "teacher_assessment_review";
  /** 比較検証など、由来の説明（原文転記ではない） */
  derivedFrom: string;
  /** 常に false。教員アセスメント原文を収録していないことの明示 */
  containsOriginalAssessmentText: false;
};

/**
 * 1件の Teacher Insight。
 * patient_specific のとき patientId + caseId 必須（validation で強制）。
 */
export type TeacherInsightDocument = {
  schemaVersion: typeof TEACHER_INSIGHT_SCHEMA_VERSION;
  id: string;
  title: string;
  topic: string;
  scope: TeacherInsightScope;
  applicablePatternKeys: readonly Form3PatternKey[];
  patientSpecific: boolean;
  patientId?: string;
  caseId?: string;
  relatedCtpIds?: readonly string[];
  /** 正規 Information カタログの安定 ID のみ */
  evidenceInformationIds: readonly string[];
  overlookedPoints: readonly string[];
  teacherConsiderations: readonly string[];
  hypotheses: readonly TeacherInsightHypothesis[];
  missingInformation: readonly string[];
  coachingQuestions: readonly TeacherInsightCoachingQuestion[];
  commonMisconceptions: readonly string[];
  goldStandardRelationship: TeacherInsightGoldRelationship;
  caution: readonly string[];
  tags: readonly string[];
  sourceMetadata: TeacherInsightSourceMetadata;
};

export type TeacherInsightValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type TeacherInsightValidationResult =
  | { ok: true; document: TeacherInsightDocument }
  | { ok: false; issues: TeacherInsightValidationIssue[] };

export type TeacherInsightLibraryValidationResult =
  | { ok: true; documents: readonly TeacherInsightDocument[] }
  | { ok: false; issues: TeacherInsightValidationIssue[] };
