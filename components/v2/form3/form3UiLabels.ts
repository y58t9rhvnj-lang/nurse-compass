// Compass Version2.1 Day 4 — 様式3 UI 表示ラベル（純データ）。
// 進捗判定・整理済み条件は lib/form3 の純関数を正とする。ここは表示文言のみ。

import type {
  Form3Judgment,
  Form3PatternKey,
  Form3PatternProgress,
} from "@/lib/form3/form3Types";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
import type { Form3SaveStatus } from "@/lib/v2/notebook/form3HookLogic";
import type { Form3PatternField } from "@/lib/v2/notebook/form3HookLogic";
import { formatSavedAtJa } from "@/lib/datetime/formatSavedAtJa";

/** ナビ用の短いパターン名（正式ラベルは form3PatternDefinitions） */
export const FORM3_PATTERN_SHORT_LABELS: Record<Form3PatternKey, string> = {
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

export const FORM3_PROGRESS_LABELS: Record<Form3PatternProgress, string> = {
  not_started: "未着手",
  in_progress: "入力中",
  needs_rationale: "根拠不足",
  reviewed: "整理済み",
  reviewed_insufficient: "情報不足で整理済み",
};

export const FORM3_JUDGMENT_LABELS: Record<Form3Judgment, string> = {
  functioning_normally: "正常に機能している",
  strength: "強みがある",
  problem: "問題がある",
  risk: "問題が生じる可能性がある",
  insufficient_information: "情報不足で判断できない",
};

/** 思考順どおりの入力欄（judgment は選択肢 UI） */
export const FORM3_FIELD_ORDER = [
  "relatedInformation",
  "interpretation",
  "crossPatternRelations",
  "judgment",
  "judgmentRationale",
  "additionalInformationNeeded",
] as const satisfies readonly Form3PatternField[];

export type Form3EditableTextField = Exclude<
  (typeof FORM3_FIELD_ORDER)[number],
  "judgment"
>;

export type Form3FieldMeta = {
  field: Form3EditableTextField;
  label: string;
  hint: string;
  placeholder: string;
};

export const FORM3_TEXT_FIELD_META: readonly Form3FieldMeta[] = [
  {
    field: "relatedInformation",
    label: "関連する患者情報（S・O情報）",
    hint: "カルテ、患者さんとの会話、観察、検査値などから、このパターンに関連する事実を整理します。解釈は次の欄へ。",
    placeholder: "このパターンに関連する事実を書く",
  },
  {
    field: "interpretation",
    label: "情報から考えたこと",
    hint: "集めた情報が何を意味するのか、疾患・症状・治療・生活との関係を考えます。",
    placeholder: "事実から考えた意味を書く",
  },
  {
    field: "crossPatternRelations",
    label: "他の情報・健康パターンとの関連",
    hint: "疾患・症状・治療・生活背景や、他の健康パターンとのつながりを考えます。",
    placeholder:
      "疾患・症状・治療・生活背景や、他の健康パターンとのつながりを考えて記述してください。",
  },
  {
    field: "judgmentRationale",
    label: "判断の根拠",
    hint: "選択した判断を支える患者情報を、自分の言葉で説明してください。正常・強みの場合も根拠が必要です。",
    placeholder: "判断を支える根拠を書く",
  },
  {
    field: "additionalInformationNeeded",
    label: "追加で必要な情報",
    hint: "現時点で不足している情報や、今後確認したいことを記述します。",
    placeholder: "これから確認したいことを書く",
  },
];

export const FORM3_REVIEW_ISSUE_LABELS: Record<Form3ReviewIssue, string> = {
  judgment_required: "判断を選択してください",
  rationale_required: "判断の根拠を記入してください",
  additional_information_required:
    "情報不足のときは、追加で必要な情報を記入してください",
};

export type Form3SaveStatusView = {
  /** 主表示（日本語） */
  label: string;
  /** Saved 時の時刻など Secondary */
  detail?: string;
  tone: "neutral" | "busy" | "warn" | "error" | "conflict";
  showLoadLatest: boolean;
};

/**
 * 保存状態の表示文言。warnings があっても失敗扱いにしない（呼び出し側で別途）。
 * DB 生エラーは出さない。
 */
export function getForm3SaveStatusView(
  status: Form3SaveStatus,
  lastSavedAt: string,
  hydrated: boolean,
): Form3SaveStatusView {
  if (!hydrated) {
    return { label: "", tone: "neutral", showLoadLatest: false };
  }

  const time = formatForm3SavedTime(lastSavedAt);

  switch (status) {
    case "saving":
      return { label: "保存中…", tone: "busy", showLoadLatest: false };
    case "dirty":
      return {
        label: "未保存の変更あり",
        tone: "warn",
        showLoadLatest: false,
      };
    case "error":
      return {
        label: "保存できませんでした",
        tone: "error",
        showLoadLatest: false,
      };
    case "conflict":
      return {
        label: "別の変更と競合しました",
        tone: "conflict",
        showLoadLatest: true,
      };
    case "saved":
      return {
        label: "保存済み",
        detail: time || undefined,
        tone: "neutral",
        showLoadLatest: false,
      };
    case "idle":
    default:
      return {
        label: "保存済み",
        detail: time || undefined,
        tone: "neutral",
        showLoadLatest: false,
      };
  }
}

export function formatForm3SavedTime(iso: string): string {
  return formatSavedAtJa(iso);
}

export function formatForm3OverallProgressLabel(
  reviewedCount: number,
  total: number,
): string {
  return `${reviewedCount} / ${total} パターン整理済み`;
}
