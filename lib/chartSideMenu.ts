// 電子カルテ専用左メニュー項目（Version1）
// Version1で学生が情報収集に使う機能に整理。意味の不明な業務用語・未使用項目は除外。

export const CHART_SIDE_MENU = [
  "カルテ画面",
  "医師指示",
  "病棟申し送り",
  "患者スケジュール",
  "隔離・拘束",
  "検査結果",
  "処方・注射",
  "看護印刷",
] as const;

export type ChartSideMenuItem = (typeof CHART_SIDE_MENU)[number];
