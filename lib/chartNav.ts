// Compass Chart のタブ間ナビゲーション（診療録⇄処方、フローシート→診療録）
// 文字列検索ではなく共通IDで厳密にリンクする。

import type { ChartTabId } from "./chartTabs";

export type ChartFocus =
  | { type: "clinicalId"; id: string } // 診療録の記録（medicationChangeId）
  | { type: "nursingId"; id: string } // 診療録の看護記録（nursingRecordId）
  | { type: "restrictionId"; id: string } // 診療録の行動制限イベント（restrictionEventId）
  | { type: "date"; date: string } // 診療録の日付ジャンプ
  | { type: "rxId"; id: string }; // 処方オーダー（medicationChangeId）

export interface ChartNavRequest {
  tab: ChartTabId;
  focus: ChartFocus;
  token: number; // 同一対象への再遷移でも発火させる
}
