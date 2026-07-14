// 機能フラグ（Version1 / 第1回講義向け）
//
// 第1回講義では「患者理解の入り口」に集中し、未完成の
// 情報整理ノート（Clinical Thinking Workspace）への学生導線を隠す。
// コードやデータは削除しない。開発者が必要に応じて再有効化できるよう、
// このフラグを true にするだけで導線が復活する。
//
// 参照: docs 第1回講義スコープ / Phase A-1。

export const FEATURE_FLAGS = {
  // 情報整理ノート（InformationGroup / Cue / Form2 / Form3 は未実装）。
  // 第1回講義では false（学生ナビから非表示）。
  informationNotebook: false,
  // 収集ワークフロー（患者発言・一時メモの「収集する / 収集済み」操作と収集ダイアログ）。
  // 第1回講義では収集を使わないため false（学生画面から完全に非表示）。
  // コード・データ・store は削除せず、true にすれば復活する。
  collection: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[key];
}
