// Compass Version 2.2 Sprint 4B — 固定ルーブリック（アプリ定数）

export const ASSESSMENT_REVIEW_COMMENT_MAX_CHARS = 3000;

export const ASSESSMENT_RUBRIC_KEYS = [
  "information_gathering",
  "relating_information",
  "interpretation_analysis",
  "clarity_of_evidence",
  "awareness_of_gaps",
  "patient_understanding",
  "overall_integration",
] as const;

export type AssessmentRubricKey = (typeof ASSESSMENT_RUBRIC_KEYS)[number];

export type AssessmentRubricScores = Partial<
  Record<AssessmentRubricKey, number | null>
>;

export const ASSESSMENT_RUBRIC_LABELS: Record<AssessmentRubricKey, string> = {
  information_gathering: "情報収集",
  relating_information: "情報の関連づけ",
  interpretation_analysis: "解釈・分析",
  clarity_of_evidence: "根拠の明確さ",
  awareness_of_gaps: "不足情報への気づき",
  patient_understanding: "患者理解",
  overall_integration: "全体統合",
};

export const ASSESSMENT_RUBRIC_LEVELS: ReadonlyArray<{
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
}> = [
  { value: 1, label: "到達していない" },
  { value: 2, label: "一部到達" },
  { value: 3, label: "概ね到達" },
  { value: 4, label: "十分到達" },
  { value: 5, label: "高い水準で到達" },
];

export type AssessmentReviewStatus = "draft" | "completed";

export function emptyRubricScores(): AssessmentRubricScores {
  const out: AssessmentRubricScores = {};
  for (const key of ASSESSMENT_RUBRIC_KEYS) {
    out[key] = null;
  }
  return out;
}

export function parseRubricScores(raw: unknown): AssessmentRubricScores {
  const out = emptyRubricScores();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  for (const key of ASSESSMENT_RUBRIC_KEYS) {
    const v = o[key];
    if (v == null) {
      out[key] = null;
      continue;
    }
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      out[key] = n;
    } else {
      out[key] = null;
    }
  }
  return out;
}

export function sanitizeComment(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, ASSESSMENT_REVIEW_COMMENT_MAX_CHARS);
}

export function countRubricScores(
  scores: AssessmentRubricScores,
): number {
  let n = 0;
  for (const key of ASSESSMENT_RUBRIC_KEYS) {
    const v = scores[key];
    if (typeof v === "number" && v >= 1 && v <= 5) n += 1;
  }
  return n;
}

/** 確定条件: 総合コメント1文字以上、またはスコア1項目以上 */
export function canCompleteAssessmentReview(input: {
  overallComment: string;
  rubricScores: AssessmentRubricScores;
}): boolean {
  if (input.overallComment.trim().length >= 1) return true;
  return countRubricScores(input.rubricScores) >= 1;
}

export function validateRubricScoresInput(
  raw: unknown,
): { ok: true; scores: AssessmentRubricScores } | { ok: false; message: string } {
  if (raw == null) {
    return { ok: true, scores: emptyRubricScores() };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "評価スコアの形式が正しくありません。" };
  }
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    if (!(ASSESSMENT_RUBRIC_KEYS as readonly string[]).includes(key)) {
      return { ok: false, message: "未知の評価項目が含まれています。" };
    }
  }
  for (const key of ASSESSMENT_RUBRIC_KEYS) {
    if (!(key in o)) continue;
    const v = o[key];
    if (v == null) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return {
        ok: false,
        message: "評価は1〜5の整数、または未入力にしてください。",
      };
    }
  }
  return { ok: true, scores: parseRubricScores(raw) };
}
