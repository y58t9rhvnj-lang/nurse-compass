// 看護記録エリアのサブナビ・形式正規化（Sprint A-3.2）
import type { NursingRecord } from "./chartData";

/** 看護記録タブ内のサブビュー（内部id daily は表示ラベル「記録」） */
export type NursingSubTab = "daily" | "plan" | "summary";

export const NURSING_SUB_TABS: { id: NursingSubTab; label: string }[] = [
  { id: "daily", label: "記録" },
  { id: "plan", label: "看護計画" },
  { id: "summary", label: "看護サマリー" },
];

export const DEFAULT_NURSING_SUB_TAB: NursingSubTab = "daily";

/**
 * 看護サブナビの sticky 設定（スクロール時も固定表示）。
 * スクロールコンテナ自身の上部パディングを 0 にした上で top-0 に貼り付けるため、
 * 負のマージンは使わない（負マージンは上位タブとの間に隙間を生む原因になる）。
 * 不透明背景＋下線で、記録本文がバー間から透けないようにする。
 */
export const NURSING_SUBNAV_STICKY_CLASS =
  "sticky top-0 z-20 border-b border-[#E5E5EA] bg-[#F7F7F9] px-2.5 pt-2.5 pb-2";

/** 日々の記録の内部形式 */
export type NursingRecordType = "soap" | "pos" | "chronological";

/** 旧形式との互換（narrative → chronological） */
export type NursingRecordFormat = NursingRecordType | "narrative";

export type NursingPlanStatus = "継続" | "修正" | "終了";

export interface NursingPlanItem {
  problemNumber: string; // 例: N1（看護問題番号 #N。医師POS #1〜 とは別体系）
  problem: string;
  longTermGoal: string;
  shortTermGoal: string;
  op: string;
  tp: string;
  ep: string;
  startDate: string;
  reviewDate: string;
  status: NursingPlanStatus;
}

export interface NursingSummaryRecord {
  id: string;
  period: string; // 対象期間
  date: string;
  author: string;
  title: string;
  living: string;
  symptoms: string;
  sleep: string;
  medication: string;
  adl: string;
  activity: string;
  interpersonal: string;
  physical: string;
  ongoingIssues: string;
  strengths: string;
}

export type NursingTypeFilter = "all" | NursingRecordType;

export const NURSING_TYPE_FILTERS: { id: NursingTypeFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "soap", label: "SOAP" },
  { id: "pos", label: "POS" },
  { id: "chronological", label: "経時" },
];

/** 記録形式を正規化（旧データ互換） */
export function inferNursingType(r: NursingRecord): NursingRecordType {
  const raw = r.type ?? r.format;
  if (raw === "narrative") return "chronological";
  if (raw === "soap" || raw === "pos" || raw === "chronological") return raw;
  if (r.s || r.o || r.a || r.p) return "soap";
  if (r.s ?? r.observation) {
    if (r.intervention || r.evaluation || r.a || r.p) return "soap";
  }
  if (r.observation && (r.intervention || r.evaluation)) return "soap";
  if (r.focus || r.body || r.course) return "pos";
  if (r.content || r.narrative) return "chronological";
  return "chronological";
}

export function nursingTypeLabel(t: NursingRecordType): string {
  if (t === "soap") return "SOAP";
  if (t === "pos") return "POS";
  return "経時";
}

/** 表示用 SOAP フィールド（旧 observation/intervention/evaluation からのフォールバック） */
export function resolveSoapFields(r: NursingRecord): {
  s?: string;
  o?: string;
  a?: string;
  p?: string;
} {
  return {
    s: r.s,
    o: r.o ?? r.observation,
    a: r.a ?? r.evaluation,
    p: r.p ?? r.intervention,
  };
}

/**
 * 本文中の日本語引用「…」を順序どおりに抽出する。
 * 「」で明示された本人発言は SOAP の S に整理する（客観 O から除外する）。
 */
export function extractJapaneseQuotedStatements(text?: string | null): string[] {
  if (!text) return [];
  return text.match(/「[^」]*」/g) ?? [];
}

// O 本文から「…」引用と、それに続く伝達句（と話す 等）を除去して客観情報のみ残す。
const SPEECH_ATTRIBUTION = "(?:と(?:話す|話される|話し|訴える|訴え|発言|表出|述べる|述べ|言う|言い|語る|こぼす|返答|返事)[^。」]*)?";
const QUOTE_WITH_ATTRIBUTION = new RegExp(`「[^」]*」${SPEECH_ATTRIBUTION}`, "g");

function stripQuotesFromObjective(text: string): string {
  if (!text) return "";
  let out = text.replace(QUOTE_WITH_ATTRIBUTION, "");
  // 引用除去で残った重複句読点・余分な空白を整える。
  out = out
    .replace(/、\s*(?=。)/g, "")
    .replace(/。\s*。+/g, "。")
    .replace(/^[、。\s]+/, "")
    .replace(/、+\s*$/, "")
    .trim();
  return out;
}

/**
 * SOAP 表示用に S/O を正規化する（Sprint A-3.2 Hotfix）。
 * 優先度:
 *   S: 明示 s → O/observation から抽出した「…」引用 → 空（記載なし）
 *   O: 明示 o → observation（いずれも「…」引用を除去）
 * 引用は S と O に重複させない。A/P は臨床的意味を変えない。
 */
export function normalizeSoapFields(r: NursingRecord): {
  s: string;
  o: string;
  a: string;
  p: string;
} {
  const explicitS = (r.s ?? "").trim();
  const oSource = r.o ?? r.observation ?? "";
  const quotesInO = extractJapaneseQuotedStatements(oSource);
  const s = explicitS !== "" ? explicitS : quotesInO.join("\n");
  const o = stripQuotesFromObjective(oSource);
  const a = (r.a ?? r.evaluation ?? "").trim();
  const p = (r.p ?? r.intervention ?? "").trim();
  return { s, o, a, p };
}

export function nursingRecordText(r: NursingRecord): string {
  const t = inferNursingType(r);
  if (t === "soap") {
    const { s, o, a, p } = normalizeSoapFields(r);
    return [s, o, a, p].filter(Boolean).join(" ");
  }
  if (t === "pos") {
    return [r.focus, r.body, r.course, r.posEvaluation, r.posPlan].filter(Boolean).join(" ");
  }
  return r.narrative ?? r.content ?? "";
}
