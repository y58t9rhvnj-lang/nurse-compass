// Compass Version2 — Question 型（設計書 12 / Architecture Principles §2）。
//
// Question は「答え」ではなく「次に確認・観察・考える方向」を示す問い（scaffolding）。
// 診断・正解・完成アセスメント・様式2 転記文は含めない（Direct Diagnosis 禁止）。
// MVP は静的・決定論（AI 由来の値を持たない）。createdBy は "system" に限定する。

// 分類（設計書 12 §7.4）。診断カテゴリ・疾患名は使わない。
export type QuestionCategory = "confirm" | "observe" | "think";

// 学生が自分の思考を整理するための最小状態。
// 「正解 / 完了 / 合格」など学習結果を断定する語は使わない。
export type QuestionStatus = "unread" | "considering" | "reviewed";

export interface Question {
  id: string;
  category: QuestionCategory;
  // 問い本文。必ず問いの形（断定・完成質問文にしない）。
  prompt: string;
  // 短い目的説明（任意）。なぜこの問いを考えるのか。
  purpose?: string;
  // 将来の Evidence–Question 接続用の余地。MVP では通常空。0 件でもエラーにしない。
  relatedEvidenceIds?: string[];
  // 将来の source_reference 接続用の余地（次工程）。
  sourceReferenceIds?: string[];
  // 表示順の目安（小さいほど先）。
  priority?: number;
  // 決定論的（教員監修の静的データ）。AI 由来ではない。
  createdBy: "system";
}

// 分類の日本語ラベル・表示順（学生に分かりやすい日本語）。
export const QUESTION_CATEGORY_LABEL: Record<QuestionCategory, string> = {
  confirm: "確認する",
  observe: "観察する",
  think: "考える",
};

export const QUESTION_CATEGORY_ORDER: QuestionCategory[] = [
  "confirm",
  "observe",
  "think",
];

// 状態の日本語ラベル・表示順。
export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  unread: "未確認",
  considering: "考えている",
  reviewed: "確認済み",
};

export const QUESTION_STATUS_ORDER: QuestionStatus[] = [
  "unread",
  "considering",
  "reviewed",
];

export const DEFAULT_QUESTION_STATUS: QuestionStatus = "unread";
