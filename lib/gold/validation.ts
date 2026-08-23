/**
 * Gold Standard 純関数バリデーション（Zod なし・プロジェクト慣習に合わせる）。
 */

import { caseIdForPatient, isKnownPatient } from "@/lib/v2/notebook/caseId";
import { isForm3PatternKey } from "@/lib/form3/form3Types";
import {
  GOLD_STANDARD_SCHEMA_VERSION,
  type GoldCanonicalInformationRef,
  type GoldStandardDocument,
  type GoldValidationIssue,
  type GoldValidationResult,
} from "./types";

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

function push(
  issues: GoldValidationIssue[],
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

/**
 * 未知オブジェクトを GoldStandardDocument として検証する。
 * @param knownInformationIds 症例カタログに存在する安定 Information ID 集合
 */
export function validateGoldStandardDocument(
  raw: unknown,
  knownInformationIds: ReadonlySet<string>,
): GoldValidationResult {
  const issues: GoldValidationIssue[] = [];
  const root = asRecord(raw);
  if (!root) {
    return {
      ok: false,
      issues: [
        {
          code: "not_object",
          path: "",
          message: "Gold Standard root must be an object",
        },
      ],
    };
  }

  if (root.schemaVersion !== GOLD_STANDARD_SCHEMA_VERSION) {
    push(
      issues,
      "schema_version",
      "schemaVersion",
      `expected ${GOLD_STANDARD_SCHEMA_VERSION}`,
    );
  }

  const patientId =
    typeof root.patientId === "string" ? root.patientId.trim() : "";
  const caseId = typeof root.caseId === "string" ? root.caseId.trim() : "";

  if (!patientId) {
    push(issues, "patient_id_missing", "patientId", "patientId is required");
  } else if (!isKnownPatient(patientId)) {
    push(
      issues,
      "patient_id_unknown",
      "patientId",
      `unknown patientId: ${patientId}`,
    );
  }

  if (!caseId) {
    push(issues, "case_id_missing", "caseId", "caseId is required");
  } else if (patientId && isKnownPatient(patientId)) {
    const expected = caseIdForPatient(patientId);
    if (expected !== caseId) {
      push(
        issues,
        "case_id_mismatch",
        "caseId",
        `caseId ${caseId} does not match patientId ${patientId} (expected ${expected})`,
      );
    }
  }

  if (!nonEmpty(root.initialUnderstanding)) {
    push(
      issues,
      "empty_field",
      "initialUnderstanding",
      "initialUnderstanding must be non-empty",
    );
  }
  if (!nonEmpty(root.integratedUnderstanding)) {
    push(
      issues,
      "empty_field",
      "integratedUnderstanding",
      "integratedUnderstanding must be non-empty",
    );
  }
  if (!isNonEmptyStringList(root.remainingUnknowns)) {
    push(
      issues,
      "empty_list",
      "remainingUnknowns",
      "remainingUnknowns must be a non-empty string array",
    );
  }
  if (!isNonEmptyStringList(root.assessmentCriteria)) {
    push(
      issues,
      "empty_list",
      "assessmentCriteria",
      "assessmentCriteria must be a non-empty string array",
    );
  }

  if (!Array.isArray(root.criticalThinkingPoints)) {
    push(
      issues,
      "ctp_not_array",
      "criticalThinkingPoints",
      "criticalThinkingPoints must be an array",
    );
  } else if (root.criticalThinkingPoints.length === 0) {
    push(
      issues,
      "ctp_empty",
      "criticalThinkingPoints",
      "criticalThinkingPoints must not be empty",
    );
  } else {
    const seenIds = new Set<string>();
    root.criticalThinkingPoints.forEach((item, index) => {
      validateCtp(item, index, knownInformationIds, seenIds, issues);
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    document: root as unknown as GoldStandardDocument,
  };
}

function validateCtp(
  raw: unknown,
  index: number,
  knownInformationIds: ReadonlySet<string>,
  seenIds: Set<string>,
  issues: GoldValidationIssue[],
): void {
  const path = `criticalThinkingPoints[${index}]`;
  const obj = asRecord(raw);
  if (!obj) {
    push(issues, "ctp_not_object", path, "CTP must be an object");
    return;
  }

  const id = typeof obj.id === "string" ? obj.id.trim() : "";
  if (!id) {
    push(issues, "ctp_id_missing", `${path}.id`, "CTP id is required");
  } else if (seenIds.has(id)) {
    push(issues, "ctp_id_duplicate", `${path}.id`, `duplicate CTP id: ${id}`);
  } else {
    seenIds.add(id);
  }

  if (!nonEmpty(obj.studentAssumption)) {
    push(
      issues,
      "empty_field",
      `${path}.studentAssumption`,
      "studentAssumption must be non-empty",
    );
  }
  if (!isNonEmptyStringList(obj.facts)) {
    push(
      issues,
      "empty_list",
      `${path}.facts`,
      "facts must be a non-empty string array",
    );
  }
  if (!isNonEmptyStringList(obj.meaning)) {
    push(
      issues,
      "empty_list",
      `${path}.meaning`,
      "meaning must be a non-empty string array",
    );
  }
  if (!isNonEmptyStringList(obj.missing)) {
    push(
      issues,
      "empty_list",
      `${path}.missing`,
      "missing must be a non-empty string array",
    );
  }
  if (!nonEmpty(obj.update)) {
    push(issues, "empty_field", `${path}.update`, "update must be non-empty");
  }
  if (!nonEmpty(obj.nextQuestion)) {
    push(
      issues,
      "empty_field",
      `${path}.nextQuestion`,
      "nextQuestion must be non-empty",
    );
  }

  if (!Array.isArray(obj.gordonLenses) || obj.gordonLenses.length === 0) {
    push(
      issues,
      "lenses_empty",
      `${path}.gordonLenses`,
      "gordonLenses must be a non-empty array",
    );
  } else {
    obj.gordonLenses.forEach((lens, i) => {
      if (typeof lens !== "string" || !isForm3PatternKey(lens)) {
        push(
          issues,
          "invalid_pattern",
          `${path}.gordonLenses[${i}]`,
          `invalid Form3PatternKey: ${String(lens)}`,
        );
      }
    });
  }

  if (!Array.isArray(obj.evidenceInformationIds)) {
    push(
      issues,
      "evidence_not_array",
      `${path}.evidenceInformationIds`,
      "evidenceInformationIds must be an array",
    );
  } else if (obj.evidenceInformationIds.length === 0) {
    push(
      issues,
      "evidence_empty",
      `${path}.evidenceInformationIds`,
      "evidenceInformationIds must not be empty",
    );
  } else {
    obj.evidenceInformationIds.forEach((ref, i) => {
      if (typeof ref !== "string" || ref.trim().length === 0) {
        push(
          issues,
          "evidence_id_invalid",
          `${path}.evidenceInformationIds[${i}]`,
          "evidence id must be a non-empty string",
        );
        return;
      }
      if (!knownInformationIds.has(ref)) {
        push(
          issues,
          "evidence_id_unknown",
          `${path}.evidenceInformationIds[${i}]`,
          `unknown Information catalog id: ${ref}`,
        );
      }
    });
  }
}

/** カタログ配列の ID 重複・必須フィールドを検証 */
export function validateCanonicalInformationCatalog(
  catalog: readonly GoldCanonicalInformationRef[],
): GoldValidationIssue[] {
  const issues: GoldValidationIssue[] = [];
  const seen = new Set<string>();
  catalog.forEach((item, index) => {
    const path = `catalog[${index}]`;
    if (!nonEmpty(item.id)) {
      push(issues, "catalog_id_missing", `${path}.id`, "id required");
    } else if (seen.has(item.id)) {
      push(
        issues,
        "catalog_id_duplicate",
        `${path}.id`,
        `duplicate catalog id: ${item.id}`,
      );
    } else {
      seen.add(item.id);
    }
    if (!isKnownPatient(item.patientId)) {
      push(
        issues,
        "catalog_patient_unknown",
        `${path}.patientId`,
        `unknown patientId: ${item.patientId}`,
      );
    }
    const expected = caseIdForPatient(item.patientId);
    if (expected !== item.caseId) {
      push(
        issues,
        "catalog_case_mismatch",
        `${path}.caseId`,
        `caseId mismatch for ${item.patientId}`,
      );
    }
    if (item.soType !== "S" && item.soType !== "O") {
      push(issues, "catalog_so_invalid", `${path}.soType`, "soType must be S|O");
    }
    if (!isForm3PatternKey(item.primaryPatternKey)) {
      push(
        issues,
        "catalog_pattern_invalid",
        `${path}.primaryPatternKey`,
        "invalid pattern",
      );
    }
    if (!nonEmpty(item.content)) {
      push(issues, "catalog_content_empty", `${path}.content`, "content required");
    }
  });
  return issues;
}

export function catalogIdSet(
  catalog: readonly GoldCanonicalInformationRef[],
): Set<string> {
  return new Set(catalog.map((c) => c.id));
}
