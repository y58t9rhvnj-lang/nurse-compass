// Form3 Phase B2-2C2 — Autosave Reason（Information Card 操作）
//
// Hook / Controller が「なぜ dirty になったか」を追跡する。
// 保存ロジック自体は変えない。

export const FORM3_V2_AUTOSAVE_REASONS = [
  "information_added",
  "information_updated",
  "information_archived",
  "information_restored",
  "information_reordered",
] as const;

export type Form3V2AutosaveReason = (typeof FORM3_V2_AUTOSAVE_REASONS)[number];

export function isForm3V2AutosaveReason(
  value: unknown,
): value is Form3V2AutosaveReason {
  return (
    typeof value === "string" &&
    (FORM3_V2_AUTOSAVE_REASONS as readonly string[]).includes(value)
  );
}
