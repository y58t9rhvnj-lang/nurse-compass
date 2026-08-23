/**
 * Teacher Insight 純関数バリデーション（Zod なし・gold 慣習に合わせる）。
 */

import { caseIdForPatient, isKnownPatient } from "@/lib/v2/notebook/caseId";
import { isForm3PatternKey } from "@/lib/form3/form3Types";
import {
  TEACHER_INSIGHT_SCHEMA_VERSION,
  type CoachingQuestionStage,
  type TeacherInsightDocument,
  type TeacherInsightGoldRelationshipKind,
  type TeacherInsightHypothesisEvidenceState,
  type TeacherInsightLibraryValidationResult,
  type TeacherInsightScope,
  type TeacherInsightValidationIssue,
  type TeacherInsightValidationResult,
} from "./types";

const SCOPES: ReadonlySet<TeacherInsightScope> = new Set([
  "general",
  "patient_specific",
]);

const STAGES: ReadonlySet<CoachingQuestionStage> = new Set([
  "facts",
  "meaning",
  "missing",
  "update",
  "reflection",
]);

const EVIDENCE_STATES: ReadonlySet<TeacherInsightHypothesisEvidenceState> =
  new Set([
    "supported_by_catalog",
    "partially_supported",
    "insufficient_evidence",
    "open_alternative",
  ]);

const GOLD_KINDS: ReadonlySet<TeacherInsightGoldRelationshipKind> = new Set([
  "reinforces",
  "extends",
  "contrasts_risk",
  "independent",
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonEmptyStringList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => nonEmpty(item))
  );
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => nonEmpty(item));
}

function push(
  issues: TeacherInsightValidationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function validatePatternKeys(
  value: unknown,
  path: string,
  issues: TeacherInsightValidationIssue[],
  requireNonEmpty: boolean,
): void {
  if (!Array.isArray(value)) {
    push(issues, "invalid_patterns", path, "must be an array of Form3PatternKey");
    return;
  }
  if (requireNonEmpty && value.length === 0) {
    push(issues, "empty_patterns", path, "must contain at least one pattern");
    return;
  }
  value.forEach((item, i) => {
    if (typeof item !== "string" || !isForm3PatternKey(item)) {
      push(
        issues,
        "invalid_pattern",
        `${path}[${i}]`,
        `invalid Form3PatternKey: ${String(item)}`,
      );
    }
  });
}

function validateEvidenceIds(
  value: unknown,
  path: string,
  knownInformationIds: ReadonlySet<string>,
  issues: TeacherInsightValidationIssue[],
): void {
  if (!Array.isArray(value)) {
    push(issues, "invalid_evidence", path, "must be an array of catalog ids");
    return;
  }
  const seen = new Set<string>();
  value.forEach((item, i) => {
    if (!nonEmpty(item)) {
      push(issues, "empty_evidence_id", `${path}[${i}]`, "empty evidence id");
      return;
    }
    if (seen.has(item)) {
      push(issues, "duplicate_evidence_id", `${path}[${i}]`, `duplicate ${item}`);
      return;
    }
    seen.add(item);
    if (!knownInformationIds.has(item)) {
      push(
        issues,
        "unknown_evidence_id",
        `${path}[${i}]`,
        `not in canonical catalog: ${item}`,
      );
    }
  });
}

function validateHypotheses(
  value: unknown,
  path: string,
  knownInformationIds: ReadonlySet<string>,
  issues: TeacherInsightValidationIssue[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    push(issues, "empty_hypotheses", path, "hypotheses must be non-empty");
    return;
  }
  const ids = new Set<string>();
  value.forEach((raw, i) => {
    const h = asRecord(raw);
    const p = `${path}[${i}]`;
    if (!h) {
      push(issues, "invalid_hypothesis", p, "must be object");
      return;
    }
    if (!nonEmpty(h.id)) {
      push(issues, "empty_field", `${p}.id`, "id required");
    } else if (ids.has(h.id)) {
      push(issues, "duplicate_hypothesis_id", `${p}.id`, h.id);
    } else {
      ids.add(h.id);
    }
    if (!nonEmpty(h.text)) {
      push(issues, "empty_field", `${p}.text`, "text required");
    }
    if (
      typeof h.evidenceState !== "string" ||
      !EVIDENCE_STATES.has(h.evidenceState as TeacherInsightHypothesisEvidenceState)
    ) {
      push(
        issues,
        "invalid_evidence_state",
        `${p}.evidenceState`,
        String(h.evidenceState),
      );
    }
    validateEvidenceIds(
      h.supportingEvidenceIds ?? [],
      `${p}.supportingEvidenceIds`,
      knownInformationIds,
      issues,
    );
    if (!isStringList(h.contradictingOrMissingEvidence ?? [])) {
      push(
        issues,
        "invalid_list",
        `${p}.contradictingOrMissingEvidence`,
        "must be string[]",
      );
    }
    if (h.caution !== undefined && !nonEmpty(h.caution)) {
      push(issues, "empty_field", `${p}.caution`, "caution if present must be non-empty");
    }
  });
}

function validateCoachingQuestions(
  value: unknown,
  path: string,
  issues: TeacherInsightValidationIssue[],
): void {
  if (!Array.isArray(value) || value.length === 0) {
    push(
      issues,
      "empty_coaching_questions",
      path,
      "coachingQuestions must contain at least one item",
    );
    return;
  }
  const ids = new Set<string>();
  value.forEach((raw, i) => {
    const q = asRecord(raw);
    const p = `${path}[${i}]`;
    if (!q) {
      push(issues, "invalid_question", p, "must be object");
      return;
    }
    if (!nonEmpty(q.id)) {
      push(issues, "empty_field", `${p}.id`, "id required");
    } else if (ids.has(q.id)) {
      push(issues, "duplicate_question_id", `${p}.id`, q.id);
    } else {
      ids.add(q.id);
    }
    if (!nonEmpty(q.question)) {
      push(issues, "empty_field", `${p}.question`, "question required");
    }
    if (!nonEmpty(q.purpose)) {
      push(issues, "empty_field", `${p}.purpose`, "purpose required");
    }
    if (
      typeof q.stage !== "string" ||
      !STAGES.has(q.stage as CoachingQuestionStage)
    ) {
      push(issues, "invalid_stage", `${p}.stage`, String(q.stage));
    }
    validatePatternKeys(
      q.relatedPatternKeys ?? [],
      `${p}.relatedPatternKeys`,
      issues,
      false,
    );
    if (
      q.prerequisites !== undefined &&
      !isStringList(q.prerequisites)
    ) {
      push(issues, "invalid_list", `${p}.prerequisites`, "must be string[]");
    }
    if (q.avoidWhen !== undefined && !isStringList(q.avoidWhen)) {
      push(issues, "invalid_list", `${p}.avoidWhen`, "must be string[]");
    }
  });
}

/**
 * 単一 Insight を検証する。
 * @param knownInformationIds 正規カタログ安定 ID
 * @param knownCtpIds 任意。指定時は relatedCtpIds の存在を検証
 */
export function validateTeacherInsightDocument(
  raw: unknown,
  knownInformationIds: ReadonlySet<string>,
  knownCtpIds?: ReadonlySet<string>,
): TeacherInsightValidationResult {
  const issues: TeacherInsightValidationIssue[] = [];
  const root = asRecord(raw);
  if (!root) {
    return {
      ok: false,
      issues: [
        {
          code: "not_object",
          path: "",
          message: "Teacher Insight root must be an object",
        },
      ],
    };
  }

  if (root.schemaVersion !== TEACHER_INSIGHT_SCHEMA_VERSION) {
    push(
      issues,
      "schema_version",
      "schemaVersion",
      `expected ${TEACHER_INSIGHT_SCHEMA_VERSION}`,
    );
  }

  if (!nonEmpty(root.id)) {
    push(issues, "empty_field", "id", "id required");
  }
  if (!nonEmpty(root.title)) {
    push(issues, "empty_field", "title", "title required");
  }
  if (!nonEmpty(root.topic)) {
    push(issues, "empty_field", "topic", "topic required");
  }

  if (typeof root.scope !== "string" || !SCOPES.has(root.scope as TeacherInsightScope)) {
    push(issues, "invalid_scope", "scope", String(root.scope));
  }

  if (typeof root.patientSpecific !== "boolean") {
    push(issues, "invalid_patient_specific", "patientSpecific", "must be boolean");
  }

  const scope = root.scope as TeacherInsightScope | undefined;
  const patientSpecific = root.patientSpecific === true;
  const patientId =
    typeof root.patientId === "string" ? root.patientId.trim() : "";
  const caseId = typeof root.caseId === "string" ? root.caseId.trim() : "";

  if (scope === "patient_specific" || patientSpecific) {
    if (!patientId) {
      push(issues, "patient_id_missing", "patientId", "required for patient_specific");
    } else if (!isKnownPatient(patientId)) {
      push(issues, "patient_id_unknown", "patientId", patientId);
    }
    if (!caseId) {
      push(issues, "case_id_missing", "caseId", "required for patient_specific");
    } else if (patientId && isKnownPatient(patientId)) {
      const expected = caseIdForPatient(patientId);
      if (expected !== caseId) {
        push(
          issues,
          "case_id_mismatch",
          "caseId",
          `expected ${expected} for patient ${patientId}`,
        );
      }
    }
    if (scope === "patient_specific" && patientSpecific !== true) {
      push(
        issues,
        "scope_mismatch",
        "patientSpecific",
        "patient_specific scope requires patientSpecific=true",
      );
    }
  }

  if (scope === "general") {
    if (patientId || caseId) {
      push(
        issues,
        "general_has_case",
        "patientId/caseId",
        "general scope must not set patientId/caseId",
      );
    }
    if (patientSpecific) {
      push(
        issues,
        "scope_mismatch",
        "patientSpecific",
        "general scope requires patientSpecific=false",
      );
    }
  }

  validatePatternKeys(
    root.applicablePatternKeys,
    "applicablePatternKeys",
    issues,
    true,
  );
  validateEvidenceIds(
    root.evidenceInformationIds ?? [],
    "evidenceInformationIds",
    knownInformationIds,
    issues,
  );

  if (!isNonEmptyStringList(root.overlookedPoints)) {
    push(issues, "empty_list", "overlookedPoints", "must be non-empty string[]");
  }
  if (!isNonEmptyStringList(root.teacherConsiderations)) {
    push(
      issues,
      "empty_list",
      "teacherConsiderations",
      "must be non-empty string[]",
    );
  }
  if (!isStringList(root.missingInformation ?? [])) {
    push(issues, "invalid_list", "missingInformation", "must be string[]");
  }
  if (!isNonEmptyStringList(root.commonMisconceptions)) {
    push(
      issues,
      "empty_list",
      "commonMisconceptions",
      "must be non-empty string[]",
    );
  }
  if (!isNonEmptyStringList(root.caution)) {
    push(issues, "empty_list", "caution", "must be non-empty string[]");
  }
  if (!isStringList(root.tags ?? [])) {
    push(issues, "invalid_list", "tags", "must be string[]");
  }

  validateHypotheses(
    root.hypotheses,
    "hypotheses",
    knownInformationIds,
    issues,
  );
  validateCoachingQuestions(root.coachingQuestions, "coachingQuestions", issues);

  const gold = asRecord(root.goldStandardRelationship);
  if (!gold) {
    push(
      issues,
      "invalid_gold_relationship",
      "goldStandardRelationship",
      "must be object",
    );
  } else {
    if (
      typeof gold.kind !== "string" ||
      !GOLD_KINDS.has(gold.kind as TeacherInsightGoldRelationshipKind)
    ) {
      push(issues, "invalid_gold_kind", "goldStandardRelationship.kind", String(gold.kind));
    }
    if (!nonEmpty(gold.note)) {
      push(issues, "empty_field", "goldStandardRelationship.note", "note required");
    }
    if (!Array.isArray(gold.relatedCtpIds)) {
      push(
        issues,
        "invalid_ctp_ids",
        "goldStandardRelationship.relatedCtpIds",
        "must be array",
      );
    } else if (knownCtpIds) {
      gold.relatedCtpIds.forEach((id, i) => {
        if (!nonEmpty(id) || !knownCtpIds.has(id)) {
          push(
            issues,
            "unknown_ctp_id",
            `goldStandardRelationship.relatedCtpIds[${i}]`,
            String(id),
          );
        }
      });
    }
  }

  if (root.relatedCtpIds !== undefined) {
    if (!Array.isArray(root.relatedCtpIds)) {
      push(issues, "invalid_ctp_ids", "relatedCtpIds", "must be array");
    } else if (knownCtpIds) {
      root.relatedCtpIds.forEach((id, i) => {
        if (!nonEmpty(id) || !knownCtpIds.has(id)) {
          push(issues, "unknown_ctp_id", `relatedCtpIds[${i}]`, String(id));
        }
      });
    }
  }

  const meta = asRecord(root.sourceMetadata);
  if (!meta) {
    push(issues, "invalid_source_metadata", "sourceMetadata", "must be object");
  } else {
    if (meta.sourceType !== "teacher_assessment_review") {
      push(
        issues,
        "invalid_source_type",
        "sourceMetadata.sourceType",
        String(meta.sourceType),
      );
    }
    if (!nonEmpty(meta.derivedFrom)) {
      push(
        issues,
        "empty_field",
        "sourceMetadata.derivedFrom",
        "derivedFrom required",
      );
    }
    if (meta.containsOriginalAssessmentText !== false) {
      push(
        issues,
        "original_text_flag",
        "sourceMetadata.containsOriginalAssessmentText",
        "must be false (original assessment text must not be stored)",
      );
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, document: root as unknown as TeacherInsightDocument };
}

export function validateTeacherInsightLibrary(
  documents: readonly unknown[],
  knownInformationIds: ReadonlySet<string>,
  knownCtpIds?: ReadonlySet<string>,
): TeacherInsightLibraryValidationResult {
  const issues: TeacherInsightValidationIssue[] = [];
  const validated: TeacherInsightDocument[] = [];
  const ids = new Set<string>();

  documents.forEach((raw, i) => {
    const result = validateTeacherInsightDocument(
      raw,
      knownInformationIds,
      knownCtpIds,
    );
    if (!result.ok) {
      for (const issue of result.issues) {
        issues.push({
          ...issue,
          path: `documents[${i}].${issue.path}`,
        });
      }
      return;
    }
    if (ids.has(result.document.id)) {
      issues.push({
        code: "duplicate_insight_id",
        path: `documents[${i}].id`,
        message: result.document.id,
      });
      return;
    }
    ids.add(result.document.id);
    validated.push(result.document);
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, documents: validated };
}

export function catalogIdSetFromList(
  ids: readonly { id: string }[],
): ReadonlySet<string> {
  return new Set(ids.map((item) => item.id));
}
