/**
 * Gold Standard（教員向け模範思考データ）のドメイン型。
 *
 * - 学生の Form2 / Form3 入力・DB ペイロードとは別系統の読み取り専用教材データ。
 * - Gordon Lens は Form3PatternKey（11パターン）に限定する。
 * - Information 根拠は学生DBの可変 UUID ではなく、症例カタログの安定 ID を参照する。
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";

export const GOLD_STANDARD_SCHEMA_VERSION = 1 as const;

/** 症例との安全な関連付け（patientId + caseId の両方を必須） */
export type GoldCaseRef = {
  /** UI / 病棟マスタ上の患者ID（例: "A"） */
  patientId: string;
  /** DB・ノートブック上の教育ケースID（例: "SP-001"） */
  caseId: string;
};

/** 1件以上の非空文字列ブロック（facts / meaning 等） */
export type GoldTextList = readonly string[];

/**
 * Critical Thinking Point（CTP）1件。
 * facts / meaning / missing は1件以上。update / nextQuestion は非空文字列。
 */
export type GoldCriticalThinkingPoint = {
  id: string;
  title?: string;
  studentAssumption: string;
  facts: GoldTextList;
  /** 既存 Form3PatternKey のみ。自由文字列は不可 */
  gordonLenses: readonly Form3PatternKey[];
  meaning: GoldTextList;
  missing: GoldTextList;
  update: string;
  nextQuestion: string;
  /**
   * 根拠となる Information。
   * `lib/gold/patientA/canonicalInformationCatalog` 等の安定 ID。
   * 学生 Form3 カード UUID はここに置かない。
   */
  evidenceInformationIds: readonly string[];
};

export type GoldStandardDocument = GoldCaseRef & {
  schemaVersion: typeof GOLD_STANDARD_SCHEMA_VERSION;
  title?: string;
  purpose?: string;
  initialUnderstanding: string;
  criticalThinkingPoints: readonly GoldCriticalThinkingPoint[];
  integratedUnderstanding: string;
  remainingUnknowns: GoldTextList;
  assessmentCriteria: GoldTextList;
};

/** 症例カタログ上の安定 Information 参照（教材事実。学生DB行ではない） */
export type GoldCanonicalInformationRef = {
  id: string;
  patientId: string;
  caseId: string;
  soType: "S" | "O";
  /** 主に紐づく Gordon パターン（複数パターン横断は CTP 側 lenses で表現） */
  primaryPatternKey: Form3PatternKey;
  /** 正規化比較用の本文（学生カード content と照合可能） */
  content: string;
  /**
   * 受け入れテスト（99999991 × A）時点の Form3 active カード ID。
   * ドキュメント／照合用。Gold 本体の必須参照ではない。
   */
  acceptanceExampleCardId?: string;
};

export type GoldValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type GoldValidationResult =
  | { ok: true; document: GoldStandardDocument }
  | { ok: false; issues: GoldValidationIssue[] };
