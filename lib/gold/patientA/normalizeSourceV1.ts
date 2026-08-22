/**
 * A_gold_standard_v1.json（外部ソース）→ 内部 GoldStandardDocument 正規化。
 */

import { FORM3_PATTERN_ORDER, type Form3PatternKey } from "@/lib/form3/form3Types";
import { getForm3PatternDefinition } from "@/lib/form3/form3PatternDefinitions";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  GOLD_STANDARD_SCHEMA_VERSION,
  type GoldCriticalThinkingPoint,
  type GoldStandardDocument,
  type GoldValidationIssue,
} from "../types";
import { PATIENT_A_CTP_EVIDENCE_MAP } from "./ctpEvidenceMap";

const LABEL_TO_KEY: ReadonlyMap<string, Form3PatternKey> = new Map(
  FORM3_PATTERN_ORDER.map((key) => [
    getForm3PatternDefinition(key).labelJa,
    key,
  ]),
);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return list.length > 0 ? list : null;
}

function resolvePatientAndCase(
  rawCaseId: unknown,
): { patientId: string; caseId: string } | null {
  if (typeof rawCaseId !== "string") return null;
  const token = rawCaseId.trim();
  // ソースは caseId: "A"（患者ID）。内部は patientId + SP-001。
  if (token === "A" || token === "SP-001") {
    return { patientId: "A", caseId: caseIdForPatient("A")! };
  }
  return null;
}

function mapGordonLens(
  label: unknown,
  path: string,
  issues: GoldValidationIssue[],
): Form3PatternKey | null {
  if (typeof label !== "string") {
    issues.push({
      code: "invalid_pattern",
      path,
      message: `gordon lens must be string, got ${typeof label}`,
    });
    return null;
  }
  const key = LABEL_TO_KEY.get(label.trim());
  if (!key) {
    issues.push({
      code: "invalid_pattern",
      path,
      message: `unknown Gordon label: ${label}`,
    });
    return null;
  }
  return key;
}

export type NormalizeGoldSourceResult =
  | { ok: true; document: GoldStandardDocument }
  | { ok: false; issues: GoldValidationIssue[] };

/**
 * Downloads 版 A_gold_standard_v1.json を内部型へ変換する。
 * evidenceInformationIds は CTP_EVIDENCE_MAP から付与する（ソース JSON には無い）。
 */
export function normalizePatientAGoldSourceV1(
  raw: unknown,
): NormalizeGoldSourceResult {
  const issues: GoldValidationIssue[] = [];
  const root = asRecord(raw);
  if (!root) {
    return {
      ok: false,
      issues: [{ code: "not_object", path: "", message: "root must be object" }],
    };
  }

  const schemaOk =
    root.schemaVersion === "1.0" ||
    root.schemaVersion === 1 ||
    root.schemaVersion === "1";
  if (!schemaOk) {
    issues.push({
      code: "schema_version",
      path: "schemaVersion",
      message: `unsupported schemaVersion: ${String(root.schemaVersion)}`,
    });
  }

  const ref = resolvePatientAndCase(root.caseId);
  if (!ref) {
    issues.push({
      code: "case_id_unknown",
      path: "caseId",
      message: `expected patient A / SP-001, got ${String(root.caseId)}`,
    });
  }

  const initialObj = asRecord(root.initialUnderstanding);
  const initialText =
    typeof root.initialUnderstanding === "string"
      ? root.initialUnderstanding.trim()
      : typeof initialObj?.text === "string"
        ? initialObj.text.trim()
        : "";
  if (!initialText) {
    issues.push({
      code: "empty_field",
      path: "initialUnderstanding",
      message: "initialUnderstanding.text required",
    });
  }

  const integratedObj = asRecord(root.integratedUnderstanding);
  const integratedText =
    typeof root.integratedUnderstanding === "string"
      ? root.integratedUnderstanding.trim()
      : typeof integratedObj?.text === "string"
        ? integratedObj.text.trim()
        : "";
  if (!integratedText) {
    issues.push({
      code: "empty_field",
      path: "integratedUnderstanding",
      message: "integratedUnderstanding.text required",
    });
  }

  const remainingUnknowns =
    asStringList(integratedObj?.remainingUnknowns) ??
    asStringList(root.remainingUnknowns);
  if (!remainingUnknowns) {
    issues.push({
      code: "empty_list",
      path: "remainingUnknowns",
      message: "remainingUnknowns required",
    });
  }

  const assessmentCriteria = asStringList(root.assessmentCriteria);
  if (!assessmentCriteria) {
    issues.push({
      code: "empty_list",
      path: "assessmentCriteria",
      message: "assessmentCriteria required",
    });
  }

  if (!Array.isArray(root.criticalThinkingPoints)) {
    issues.push({
      code: "ctp_not_array",
      path: "criticalThinkingPoints",
      message: "criticalThinkingPoints must be array",
    });
  }

  const ctps: GoldCriticalThinkingPoint[] = [];
  if (Array.isArray(root.criticalThinkingPoints)) {
    root.criticalThinkingPoints.forEach((item, index) => {
      const path = `criticalThinkingPoints[${index}]`;
      const ctp = asRecord(item);
      if (!ctp) {
        issues.push({
          code: "ctp_not_object",
          path,
          message: "CTP must be object",
        });
        return;
      }
      const id = typeof ctp.id === "string" ? ctp.id.trim() : "";
      const studentAssumption =
        typeof ctp.studentAssumption === "string"
          ? ctp.studentAssumption.trim()
          : "";
      const facts = asStringList(ctp.facts);
      const meaning = asStringList(ctp.meaning);
      const missing = asStringList(ctp.missing);
      const update = typeof ctp.update === "string" ? ctp.update.trim() : "";
      const nextQuestion =
        typeof ctp.nextQuestion === "string" ? ctp.nextQuestion.trim() : "";
      const title = typeof ctp.title === "string" ? ctp.title.trim() : undefined;

      if (!id) {
        issues.push({ code: "ctp_id_missing", path: `${path}.id`, message: "id required" });
      }
      if (!studentAssumption) {
        issues.push({
          code: "empty_field",
          path: `${path}.studentAssumption`,
          message: "required",
        });
      }
      if (!facts) {
        issues.push({ code: "empty_list", path: `${path}.facts`, message: "required" });
      }
      if (!meaning) {
        issues.push({ code: "empty_list", path: `${path}.meaning`, message: "required" });
      }
      if (!missing) {
        issues.push({ code: "empty_list", path: `${path}.missing`, message: "required" });
      }
      if (!update) {
        issues.push({ code: "empty_field", path: `${path}.update`, message: "required" });
      }
      if (!nextQuestion) {
        issues.push({
          code: "empty_field",
          path: `${path}.nextQuestion`,
          message: "required",
        });
      }

      const lenses: Form3PatternKey[] = [];
      if (!Array.isArray(ctp.gordonLenses)) {
        issues.push({
          code: "lenses_empty",
          path: `${path}.gordonLenses`,
          message: "required",
        });
      } else {
        ctp.gordonLenses.forEach((label, i) => {
          const key = mapGordonLens(label, `${path}.gordonLenses[${i}]`, issues);
          if (key) lenses.push(key);
        });
      }

      const evidence = id ? PATIENT_A_CTP_EVIDENCE_MAP[id] : undefined;
      if (!evidence || evidence.length === 0) {
        issues.push({
          code: "evidence_map_missing",
          path: `${path}.evidenceInformationIds`,
          message: `no catalog evidence map for CTP id: ${id || "(missing)"}`,
        });
      }

      if (
        id &&
        studentAssumption &&
        facts &&
        meaning &&
        missing &&
        update &&
        nextQuestion &&
        lenses.length > 0 &&
        evidence &&
        evidence.length > 0
      ) {
        ctps.push({
          id,
          title,
          studentAssumption,
          facts,
          gordonLenses: lenses,
          meaning,
          missing,
          update,
          nextQuestion,
          evidenceInformationIds: evidence,
        });
      }
    });
  }

  if (issues.length > 0 || !ref || !remainingUnknowns || !assessmentCriteria) {
    return { ok: false, issues };
  }

  const document: GoldStandardDocument = {
    schemaVersion: GOLD_STANDARD_SCHEMA_VERSION,
    patientId: ref.patientId,
    caseId: ref.caseId,
    title: typeof root.title === "string" ? root.title : undefined,
    purpose: typeof root.purpose === "string" ? root.purpose : undefined,
    initialUnderstanding: initialText,
    criticalThinkingPoints: ctps,
    integratedUnderstanding: integratedText,
    remainingUnknowns,
    assessmentCriteria,
  };

  return { ok: true, document };
}
