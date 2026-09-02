// Compass Version 2.2 — AI評価 package 向け student_submission 整形
//
// 匿名化アーカイブ（AiAnonymizedAssessmentRecord）のキー構造は維持しつつ、
// 評価 package に載せる内容だけを scope / 評価方針に合わせて絞り込む。
// form2_evidence_links は評価根拠に使わない（常に空配列）。

import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { AssessmentSubmissionScope } from "./types";
import type { AiAnonymizedAssessmentRecord } from "./aiExportAnonymize";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function filterForm3BySelectedPatterns(
  form3: Record<string, unknown>,
  patternIds: Form3PatternKey[],
): Record<string, unknown> {
  if (patternIds.length === 0) return form3;
  const allow = new Set<string>(patternIds);

  const keepCard = (card: unknown): boolean => {
    if (!isRecord(card)) return false;
    const key =
      typeof card.patternKey === "string"
        ? card.patternKey
        : typeof card.pattern_key === "string"
          ? card.pattern_key
          : null;
    // パターン未設定カードは途中提出でも残す（過度な欠落を避ける）
    if (!key) return true;
    return allow.has(key);
  };

  const informationCards = Array.isArray(form3.informationCards)
    ? form3.informationCards.filter(keepCard)
    : form3.informationCards;
  const assessmentCards = Array.isArray(form3.assessmentCards)
    ? form3.assessmentCards.filter(keepCard)
    : form3.assessmentCards;

  let workspacePatternFlags = form3.workspacePatternFlags;
  if (isRecord(workspacePatternFlags)) {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(workspacePatternFlags)) {
      if (allow.has(k)) next[k] = v;
    }
    workspacePatternFlags = next;
  }

  return {
    ...form3,
    informationCards,
    assessmentCards,
    workspacePatternFlags,
  };
}

function rebuildIncludedArtifacts(
  record: Pick<
    AiAnonymizedAssessmentRecord,
    | "form2"
    | "form3"
    | "information_cards"
    | "field_reflections"
    | "patient_understanding"
  >,
): string[] {
  const included: string[] = [];
  if (record.form2) included.push("様式2");
  if (record.form3) included.push("様式3");
  if (record.information_cards.length > 0) included.push("情報カード");
  // Evidenceリンクは評価 package では載せない（included にも出さない）
  if (record.field_reflections.length > 0) included.push("フィールド振り返り");
  if (record.patient_understanding?.overview_text?.trim()) {
    included.push("患者理解");
  }
  return included;
}

/**
 * AI評価 package の student_submission 用に、匿名化レコードを絞り込む。
 * - 既知キーのみ allowlist 構築（未知キー / related_diagram 等は strip）
 * - submissionScope 外の成果物を可能な範囲で除外
 * - form2_evidence_links（evidence_links）は常に空
 * - キー構造（evidence_links 含む）は維持
 *
 * snapshot に存在すること ≠ AI へ送ってよい。将来 related_diagram を追加しても、
 * 本関数の allowlist と scope 対応を明示するまで AI へ出ない。
 */
export function prepareAiEvaluationPackageStudentSubmission(
  record: AiAnonymizedAssessmentRecord,
  scope: AssessmentSubmissionScope | null | undefined,
): AiAnonymizedAssessmentRecord {
  const includeForm2 = scope?.includeForm2 !== false;
  const includeForm3 = scope ? Boolean(scope.includeForm3) : true;
  const includeInformationCards = scope
    ? Boolean(scope.includeInformationCards)
    : true;
  const includeFieldReflections = scope
    ? Boolean(scope.includeFieldReflections)
    : true;
  const includePatientUnderstanding = scope
    ? Boolean(scope.includePatientUnderstanding)
    : true;

  let form2 = includeForm2 ? record.form2 : null;
  let form3 = includeForm3 ? record.form3 : null;
  if (
    form3 &&
    scope?.form3Scope?.mode === "selected_patterns" &&
    scope.form3Scope.patternIds.length > 0
  ) {
    form3 = filterForm3BySelectedPatterns(form3, scope.form3Scope.patternIds);
  }

  const information_cards = includeInformationCards
    ? record.information_cards
    : [];
  const field_reflections = includeFieldReflections
    ? record.field_reflections
    : [];
  const patient_understanding = includePatientUnderstanding
    ? record.patient_understanding
    : null;

  const next: AiAnonymizedAssessmentRecord = {
    schema_version: record.schema_version,
    export_kind: record.export_kind,
    anonymous_ids: record.anonymous_ids,
    meta: record.meta,
    form2,
    form3,
    information_cards,
    field_reflections,
    patient_understanding,
    // 評価根拠として使用しない。キーは維持し常に空。
    evidence_links: [],
    source_versions: record.source_versions,
    included_artifacts: [],
  };
  if (typeof record.evaluation_request_id === "string") {
    next.evaluation_request_id = record.evaluation_request_id;
  }
  next.included_artifacts = rebuildIncludedArtifacts(next);
  return next;
}
