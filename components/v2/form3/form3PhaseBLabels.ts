// Form3 Phase B3 — Information UI 表示ラベル

import { FORM3_PATTERN_SHORT_LABELS } from "@/components/v2/form3/form3UiLabels";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { Form3InformationSourceType } from "@/lib/form3/v2/form3V2Types";
import type { Form3SaveStatus } from "@/lib/v2/notebook/form3HookLogic";

export const FORM3_SOURCE_TYPE_LABELS: Record<
  Form3InformationSourceType,
  string
> = {
  patient_conversation: "患者との会話",
  family_conversation: "家族との会話",
  nursing_record: "看護記録",
  physician_record: "医師記録",
  chart: "カルテ",
  laboratory: "検査",
  vital: "バイタル",
  observation: "観察",
  medication: "薬剤",
  treatment: "治療",
  student_observation: "学生の観察",
  other: "その他",
};

export function form3PatternShortLabel(key: Form3PatternKey): string {
  return FORM3_PATTERN_SHORT_LABELS[key];
}

export type Form3PhaseBPersistLabel =
  | "Ready"
  | "Draft"
  | "Saving"
  | "Saved"
  | "Save failed";

/**
 * Phase B（Autosave 未接続）の保存状態表示。
 *
 * Saved は hasPersistedV2=true かつ dirty=false のときだけ。
 * v1→v2 のメモリ hydrate のみ（未永続化）は Saved にしない。
 */
export function getForm3PhaseBPersistLabel(args: {
  dirty: boolean;
  saveStatus: Form3SaveStatus;
  hydrated: boolean;
  hasPersistedV2: boolean;
}): { label: Form3PhaseBPersistLabel; detailJa: string } {
  if (!args.hydrated) {
    return { label: "Ready", detailJa: "" };
  }
  if (args.saveStatus === "saving") {
    return { label: "Saving", detailJa: "保存中" };
  }
  if (args.saveStatus === "error") {
    return { label: "Save failed", detailJa: "保存に失敗しました" };
  }
  if (args.dirty || args.saveStatus === "dirty") {
    return { label: "Draft", detailJa: "下書き（未保存）" };
  }
  if (args.hasPersistedV2) {
    return { label: "Saved", detailJa: "保存済み" };
  }
  // 未永続化・未編集（例: v1 からメモリ hydrate のみ）
  return { label: "Ready", detailJa: "まだ保存されていません" };
}
