// Form3 Phase B2-2B — Save Gate（純関数）
// Hook 内に条件を分散させない。明示保存・将来 autosave の両方から呼ぶ。

import type { Form3SaveStatus } from "@/lib/v2/notebook/form3HookLogic";

export type Form3V2PersistGateReason =
  | "feature_disabled"
  | "not_user_edited"
  | "not_dirty"
  | "saving"
  | "conflict";

export type Form3V2PersistGateResult =
  | { allowed: true }
  | { allowed: false; reason: Form3V2PersistGateReason };

export type CanPersistForm3V2Input = {
  featureEnabled: boolean;
  hasUserEdited: boolean;
  dirty: boolean;
  saveStatus: Form3SaveStatus;
  hasConflict: boolean;
};

/**
 * v2 永続化の可否。
 * Migration のみ・未編集・dirty=false・conflict/saving 中は拒否。
 */
export function canPersistForm3V2(
  input: CanPersistForm3V2Input,
): Form3V2PersistGateResult {
  if (!input.featureEnabled) {
    return { allowed: false, reason: "feature_disabled" };
  }
  if (input.hasConflict || input.saveStatus === "conflict") {
    return { allowed: false, reason: "conflict" };
  }
  if (input.saveStatus === "saving") {
    return { allowed: false, reason: "saving" };
  }
  if (!input.hasUserEdited) {
    return { allowed: false, reason: "not_user_edited" };
  }
  if (!input.dirty) {
    return { allowed: false, reason: "not_dirty" };
  }
  return { allowed: true };
}
