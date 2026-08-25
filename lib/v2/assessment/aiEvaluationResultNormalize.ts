// Compass Version 2.2 Sprint 5B-2 — AI評価 result の正規化

import { ASSESSMENT_RUBRIC_KEYS } from "./assessmentRubric";

const RUBRIC_SET = new Set<string>(ASSESSMENT_RUBRIC_KEYS);

const RESULT_ROOT_KEYS = new Set([
  "metadata",
  "item_evaluations",
  "student_feedback_draft",
  "teacher_observation",
  "uncertainty",
  "follow_up_checks",
  "staging_hint",
]);

const METADATA_KEYS = new Set([
  "result_schema_version",
  "evaluation_request_id",
  "package_schema_version",
  "compass_policy_version",
  "rubric_version",
  "gold_standard_version",
  "case_version",
  "export_schema_version",
  "generated_at",
  "model_label",
  "locale",
]);

const ITEM_KEYS = new Set([
  "rubric_key",
  "score",
  "level_label",
  "rationale",
  "uncertainty_note",
  "citations",
]);

const CITATION_KEYS = new Set([
  "field_path",
  "anonymous_object_id",
  "excerpt",
  "note",
]);

const FEEDBACK_KEYS = new Set([
  "strengths",
  "supporting_information",
  "next_questions",
  "gaps_or_alternatives",
  "overall_tone_check",
]);

const OBSERVATION_KEYS = new Set([
  "summary",
  "attention_points",
  "suggested_focus_for_feedback",
]);

const UNCERTAINTY_KEYS = new Set([
  "overall_confidence",
  "notes",
  "affected_rubric_keys",
]);

const FOLLOW_UP_KEYS = new Set([
  "question",
  "reason",
  "related_rubric_keys",
]);

const STAGING_HINT_KEYS = new Set([
  "persist_to",
  "must_not_write_to",
  "teacher_actions_expected",
  "auto_apply_forbidden",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pick(
  src: Record<string, unknown>,
  allowed: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(src)) {
    if (!allowed.has(k)) continue;
    out[k] = src[k];
  }
  return out;
}

function trimStringsDeep(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(trimStringsDeep);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = trimStringsDeep(v);
    }
    return out;
  }
  return value;
}

/**
 * schema 外キーを除去し、文字列を trim した normalized result を返す。
 * 輸送メタ（imported_at 等）は元々 result に無い想定。
 */
export function normalizeAiEvaluationResult(
  raw: unknown,
): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const root = pick(raw, RESULT_ROOT_KEYS);

  if (isRecord(root.metadata)) {
    root.metadata = pick(root.metadata, METADATA_KEYS);
  }

  if (Array.isArray(root.item_evaluations)) {
    root.item_evaluations = root.item_evaluations.map((item) => {
      if (!isRecord(item)) return item;
      const it = pick(item, ITEM_KEYS);
      if (typeof it.rubric_key === "string" && RUBRIC_SET.has(it.rubric_key)) {
        // keep
      }
      if (Array.isArray(it.citations)) {
        it.citations = it.citations.map((c) =>
          isRecord(c) ? pick(c, CITATION_KEYS) : c,
        );
      }
      return it;
    });
  }

  if (isRecord(root.student_feedback_draft)) {
    root.student_feedback_draft = pick(root.student_feedback_draft, FEEDBACK_KEYS);
  }
  if (isRecord(root.teacher_observation)) {
    root.teacher_observation = pick(root.teacher_observation, OBSERVATION_KEYS);
  }
  if (isRecord(root.uncertainty)) {
    root.uncertainty = pick(root.uncertainty, UNCERTAINTY_KEYS);
  }
  if (Array.isArray(root.follow_up_checks)) {
    root.follow_up_checks = root.follow_up_checks.map((f) =>
      isRecord(f) ? pick(f, FOLLOW_UP_KEYS) : f,
    );
  }
  if (isRecord(root.staging_hint)) {
    root.staging_hint = pick(root.staging_hint, STAGING_HINT_KEYS);
  }

  return trimStringsDeep(root) as Record<string, unknown>;
}
