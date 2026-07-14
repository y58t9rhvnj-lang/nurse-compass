// Sprint12.1: 情報整理ノート（Clinical Thinking Workspace）の表示用ヘルパー（純粋関数）。
// UI からは Information Card を「データ」として表示する。ここでは種類ラベルと
// 日時整形だけを担う。分類・解釈・整形以外の意味づけは行わない。

import type { InformationSourceType } from "../information/informationCard";

// sourceType を学生向けの短い「種類」表示へ変換する。
// 未知の値でも安全に「データ」へフォールバックする。
const SOURCE_TYPE_LABELS: Record<InformationSourceType, string> = {
  patient_conversation: "患者との会話",
  student_observation: "学生の観察",
  clinical_record: "診療録",
  nursing_record: "看護記録",
  flowsheet: "フローシート",
  prescription: "処方",
  examination: "検査",
  life_history: "生活歴",
  ot: "作業療法（OT）",
  psw: "PSW",
  student_note: "学生メモ",
  pathophysiology_reference: "病態参考",
};

export function sourceTypeLabel(sourceType: string): string {
  return SOURCE_TYPE_LABELS[sourceType as InformationSourceType] ?? "データ";
}

// ISO 8601 の日時を「YYYY/MM/DD HH:mm」へ整形する（学生の端末のローカル時刻）。
// 不正・未指定は空文字を返す（表示側で出し分ける）。
export function formatDataTimestamp(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}
