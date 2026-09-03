/**
 * Form3 → AI evaluation package 投影用 pattern filter（純関数）。
 * 正本: docs/version2/ai/07_form3_ai_evaluation_policy.md / 08 §6
 *
 * - input を mutation しない
 * - selected_patterns 未指定 / all_patterns → 全体保持（浅いコピー）
 * - selected_patterns → 関連データのみ
 * - 未知ルートキーは増やさない（既知キーのみ再構成）
 */

import type { Form3PatternKey } from "@/lib/form3/form3Types";

const FORM3_AI_KNOWN_ROOT_KEYS = [
  "schemaVersion",
  "patientId",
  "updatedAt",
  "informationCards",
  "assessmentCards",
  "finalForm",
  "workspacePatternFlags",
] as const;

export type Form3AiEvalFilterMode =
  | { mode: "all_patterns" }
  | { mode: "selected_patterns"; patternIds: readonly string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shallowCloneForm3(
  form3: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const key of FORM3_AI_KNOWN_ROOT_KEYS) {
    if (!(key in form3)) continue;
    const value = form3[key];
    if (Array.isArray(value)) {
      next[key] = [...value];
    } else if (isRecord(value) && (key === "finalForm" || key === "workspacePatternFlags")) {
      next[key] = { ...value };
    } else {
      next[key] = value;
    }
  }
  // anonymize 経路以外の補助キー（version 等）は、既知の非危険キーのみ透過
  if ("version" in form3 && !("schemaVersion" in next)) {
    next.version = form3.version;
  }
  return next;
}

/**
 * informationCard の関連 pattern 集合。
 * V2 正: patternKeys[]。互換: patternKey / pattern_key（単数）。
 * どちらも無い / 空 → null（selected では除外）。
 */
export function informationCardPatternKeys(
  card: Record<string, unknown>,
): string[] | null {
  if (Array.isArray(card.patternKeys)) {
    const keys = card.patternKeys.filter(
      (k): k is string => typeof k === "string" && k.length > 0,
    );
    return keys.length > 0 ? keys : null;
  }
  if (typeof card.patternKey === "string" && card.patternKey.length > 0) {
    return [card.patternKey];
  }
  if (typeof card.pattern_key === "string" && card.pattern_key.length > 0) {
    return [card.pattern_key];
  }
  return null;
}

/**
 * assessmentCard の pattern。
 * 正: patternKey。互換: pattern_key。
 * null / 欠落 / 非 string → null（selected では除外）。
 */
export function assessmentCardPatternKey(
  card: Record<string, unknown>,
): string | null {
  if (typeof card.patternKey === "string" && card.patternKey.length > 0) {
    return card.patternKey;
  }
  if (typeof card.pattern_key === "string" && card.pattern_key.length > 0) {
    return card.pattern_key;
  }
  return null;
}

function keepInformationCard(
  card: unknown,
  allow: Set<string>,
): boolean {
  if (!isRecord(card)) return false;
  const keys = informationCardPatternKeys(card);
  if (!keys) return false;
  return keys.some((k) => allow.has(k));
}

function keepAssessmentCard(card: unknown, allow: Set<string>): boolean {
  if (!isRecord(card)) return false;
  const key = assessmentCardPatternKey(card);
  if (!key) return false;
  return allow.has(key);
}

function filterFinalForm(
  finalForm: unknown,
  allow: Set<string>,
): Record<string, unknown> {
  if (!isRecord(finalForm)) return {};
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(finalForm)) {
    if (allow.has(k)) next[k] = v;
  }
  return next;
}

function filterWorkspacePatternFlags(
  flags: unknown,
  allow: Set<string>,
): Record<string, unknown> {
  if (!isRecord(flags)) return {};
  const next: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (allow.has(k)) next[k] = v;
  }
  return next;
}

/**
 * selected + patternIds=[] → 評価対象を空にする（all と解釈しない）。
 * all_patterns → 既知キーの浅いコピー（全体保持）。
 */
export function filterForm3ForAiEvaluation(
  form3: Record<string, unknown>,
  filter: Form3AiEvalFilterMode,
): Record<string, unknown> {
  if (filter.mode === "all_patterns") {
    return shallowCloneForm3(form3);
  }

  const allow = new Set(
    filter.patternIds.filter((k) => typeof k === "string" && k.length > 0),
  );

  const base = shallowCloneForm3(form3);

  const informationCards = Array.isArray(form3.informationCards)
    ? form3.informationCards.filter((c) => keepInformationCard(c, allow))
    : [];

  const assessmentCards = Array.isArray(form3.assessmentCards)
    ? form3.assessmentCards.filter((c) => keepAssessmentCard(c, allow))
    : [];

  return {
    ...base,
    informationCards,
    assessmentCards,
    finalForm: filterFinalForm(form3.finalForm, allow),
    workspacePatternFlags: filterWorkspacePatternFlags(
      form3.workspacePatternFlags,
      allow,
    ),
  };
}

/** scope.form3Scope から filter mode を解決 */
export function resolveForm3AiEvalFilterMode(
  form3Scope:
    | { mode: "all_patterns" }
    | { mode: "selected_patterns"; patternIds: Form3PatternKey[] }
    | null
    | undefined,
): Form3AiEvalFilterMode {
  if (!form3Scope) return { mode: "all_patterns" };
  if (form3Scope.mode === "all_patterns") return { mode: "all_patterns" };
  return {
    mode: "selected_patterns",
    patternIds: form3Scope.patternIds ?? [],
  };
}
