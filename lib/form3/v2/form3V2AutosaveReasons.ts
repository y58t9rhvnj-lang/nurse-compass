// Form3 Phase B — Autosave Reason（Information / Assessment 操作）
//
// Hook / Controller が「なぜ dirty になったか」を追跡する。
// 保存ロジック自体は変えない。

export const FORM3_V2_AUTOSAVE_REASONS = [
  "information_added",
  "information_updated",
  "information_archived",
  "information_restored",
  "information_reordered",
  "assessment_added",
  "assessment_updated",
  "assessment_archived",
  "assessment_restored",
  "final_updated",
] as const;

export type Form3V2AutosaveReason = (typeof FORM3_V2_AUTOSAVE_REASONS)[number];

export const FORM3_V2_INFORMATION_AUTOSAVE_REASONS = [
  "information_added",
  "information_updated",
  "information_archived",
  "information_restored",
  "information_reordered",
] as const satisfies readonly Form3V2AutosaveReason[];

export const FORM3_V2_ASSESSMENT_AUTOSAVE_REASONS = [
  "assessment_added",
  "assessment_updated",
  "assessment_archived",
  "assessment_restored",
] as const satisfies readonly Form3V2AutosaveReason[];

export const FORM3_V2_FINAL_AUTOSAVE_REASONS = [
  "final_updated",
] as const satisfies readonly Form3V2AutosaveReason[];

export function isForm3V2AutosaveReason(
  value: unknown,
): value is Form3V2AutosaveReason {
  return (
    typeof value === "string" &&
    (FORM3_V2_AUTOSAVE_REASONS as readonly string[]).includes(value)
  );
}
