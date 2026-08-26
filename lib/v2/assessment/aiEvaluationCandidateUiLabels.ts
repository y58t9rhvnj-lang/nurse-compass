// Compass Version 2.2 Sprint 5C-UX — 教員向け表示ラベル（内部コードは変更しない）

import type { AiCandidateCitation } from "./aiEvaluationCandidateReadModel";

const CITATION_ADOPT_NOTE =
  "採用は可能ですが、元の提出内容を確認してください";

/** staging.review_status の表示 */
export function aiReviewStatusLabel(status: string): string {
  switch (status) {
    case "needs_review":
      return "確認待ち";
    case "partially_adopted":
      return "一部採用済み";
    case "adopted":
      return "採用済み";
    case "rejected":
      return "却下";
    case "superseded":
      return "更新により無効";
    case "invalid":
      return "無効";
    default:
      return status;
  }
}

/** staging.validation_status の表示 */
export function aiValidationStatusLabel(status: string): string {
  switch (status) {
    case "warning":
      return "警告あり";
    case "ok":
      return "問題なし";
    case "invalid":
      return "エラーあり";
    default:
      return status;
  }
}

/** 警告コードの教員向け見出し */
export function aiWarningCodeLabel(
  family: "version" | "pii",
  code: string,
): string {
  if (family === "pii" || code.startsWith("pii_")) {
    switch (code) {
      case "pii_strong_email":
        return "個人情報に関する警告（メールアドレス）";
      case "pii_strong_phone":
        return "個人情報に関する警告（電話番号）";
      case "pii_strong_student_id":
        return "個人情報に関する警告（学籍番号）";
      case "pii_strong_name_label":
        return "個人情報に関する警告（氏名）";
      case "pii_weak_initials":
        return "個人情報に関する警告（イニシャル）";
      default:
        return "個人情報に関する警告";
    }
  }

  switch (code) {
    case "policy_version_mismatch":
    case "compass_policy_version_mismatch":
      return "評価方針の版が異なります";
    case "rubric_version_mismatch":
      return "評価基準の版が異なります";
    case "gold_standard_version_mismatch":
      return "ゴールドスタンダードの版が異なります";
    case "case_version_mismatch":
      return "事例の版が異なります";
    case "export_schema_version_mismatch":
      return "出力スキーマの版が異なります";
    default:
      return code;
  }
}

export function aiWarningFamilyTitle(family: "version" | "pii"): string {
  return family === "pii" ? "個人情報に関する警告" : "版に関する警告";
}

const FIELD_PATH_LABELS: Array<{ match: RegExp | string; label: string }> = [
  {
    match: /^student_submission\.patient_understanding\.overview_text$/,
    label: "患者理解「私が捉えた患者さん」",
  },
  {
    match: /^student_submission\.patient_understanding/,
    label: "患者理解",
  },
  {
    match: /^student_submission\.field_reflections/,
    label: "フィールド振り返り",
  },
  {
    match: /^student_submission\.information_cards/,
    label: "情報カード",
  },
  {
    match: /^student_submission\.form2/,
    label: "様式2",
  },
  {
    match: /^student_submission\.form3/,
    label: "様式3",
  },
  {
    match: /^patient_understanding\.overview_text$/,
    label: "患者理解「私が捉えた患者さん」",
  },
  { match: /^patient_understanding/, label: "患者理解" },
  { match: /^field_reflections/, label: "フィールド振り返り" },
  { match: /^information_cards/, label: "情報カード" },
  { match: /^form2/, label: "様式2" },
  { match: /^form3/, label: "様式3" },
];

/** citation field_path の教員向け主表示 */
export function aiCitationFieldPathLabel(fieldPath: string | null): string {
  if (!fieldPath) return "引用箇所（パスなし）";
  for (const row of FIELD_PATH_LABELS) {
    if (typeof row.match === "string") {
      if (fieldPath === row.match || fieldPath.startsWith(`${row.match}.`)) {
        return row.label;
      }
    } else if (row.match.test(fieldPath)) {
      return row.label;
    }
  }
  return "提出内容の引用";
}

/**
 * citation 警告の教員向け文言。
 * resolve ロジック自体は変えず、表示だけ置き換える。
 */
export function aiCitationResolveDisplay(
  citation: Pick<AiCandidateCitation, "resolveStatus" | "resolveMessage">,
): { message: string; adoptNote: string } | null {
  if (citation.resolveStatus === "ok") return null;

  if (citation.resolveStatus === "excluded_evidence_links") {
    return {
      message: "この引用は評価根拠の対象外です",
      adoptNote: CITATION_ADOPT_NOTE,
    };
  }

  if (citation.resolveStatus === "missing") {
    return {
      message: "提出時点の記録から該当箇所を確認できません",
      adoptNote: CITATION_ADOPT_NOTE,
    };
  }

  // unknown ほか
  const raw = citation.resolveMessage ?? "";
  if (/照合ルールが未定義|自動照合できません/.test(raw)) {
    return {
      message: "引用箇所を自動確認できません",
      adoptNote: CITATION_ADOPT_NOTE,
    };
  }
  if (/field_path|anonymous_object_id/.test(raw)) {
    return {
      message: "引用情報を確認できません",
      adoptNote: CITATION_ADOPT_NOTE,
    };
  }
  if (/スナップショットを照合できません/.test(raw)) {
    return {
      message: "提出時点の記録と照合できません",
      adoptNote: CITATION_ADOPT_NOTE,
    };
  }

  return {
    message: "引用箇所を自動確認できません",
    adoptNote: CITATION_ADOPT_NOTE,
  };
}

export const AI_CITATION_ADOPT_NOTE = CITATION_ADOPT_NOTE;

export const AI_FEEDBACK_BLOCK_LABELS = {
  strengths: "良かった点",
  next_questions: "次に考えてほしいこと",
  gaps_or_alternatives: "不足情報・別の見方",
  supporting_information: "根拠として確認した情報",
} as const;
