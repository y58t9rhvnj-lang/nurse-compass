// Compass Version2 — Workspace Inspector 共通型（CWDS §4/§7）。
//
// Inspector は「器」であり、中身（Panel）は差し替え可能な登録型とする。
// 本 Sprint（2-3A）では基盤のみを実装し、実際の Panel（Question 等）は未実装。
// パネルを追加するときは、この union と（必要なら）表示メタを増やすだけで済む構造にする。

// Inspector に載せられるパネルの識別子。CWDS §9「Future Expansion」に対応。
// 現時点ではどれも未実装で、Inspector は概要（overview）を表示する。
export type InspectorPanelId =
  | "question"
  | "reflection"
  | "story"
  | "teacherGuide"
  | "aiAssistant"
  | "clinicalNotebook";

// トリガーボタン（aria-controls）と Inspector 本体（id）を結ぶ共有の DOM id。
export const INSPECTOR_DOM_ID = "workspace-inspector";

// activePanel が null（未指定）か、まだ実装されていないパネルのときに表示する概要。
// Inspector が「補助領域」であることを静かに伝える文言。答え・診断を想起させない。
export const INSPECTOR_TITLE = "学習支援";
export const INSPECTOR_OVERVIEW_LEAD =
  "必要なときに、問いや根拠をここで確認できます。";
export const INSPECTOR_OVERVIEW_EMPTY =
  "いまは、表示できる支援はありません。";
