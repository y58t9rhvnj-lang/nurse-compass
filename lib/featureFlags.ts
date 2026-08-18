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
  // Version2「精神様式2 受け持ち対象記録」ワークスペース（入力・保存・再編集）。
  // Version1 本番では false（通常導線から非表示）。true にすると学生導線に
  // 「精神様式2」が現れ、患者トップ／サイドナビから開けるようになる。
  form2Workspace: false,
  // Form3 Phase B（Information / Assessment Cards → Final Form）。
  // default false: 現行 Form3（schemaVersion 1）を維持。
  // true: 新 Form3 入口（Phase B）。旧 UI は削除しない。
  // 参照: docs/version3/11_form3_phase_b_implementation_plan.md
  form3PhaseB: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  // Local-only override: set NEXT_PUBLIC_FORM3_PHASE_B=true in .env.local.
  // Unset / any other value keeps the source default (false). Does not affect other flags.
  if (
    key === "form3PhaseB" &&
    process.env.NEXT_PUBLIC_FORM3_PHASE_B === "true"
  ) {
    return true;
  }
  return FEATURE_FLAGS[key];
}
