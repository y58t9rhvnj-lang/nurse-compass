// Compass Version 2.2 Sprint 4A — assessment snapshot の安全な読み取りモデル

import { sanitizeForm2Payload } from "@/lib/v2/notebook/form2Mapper";
import { sanitizeForm3PayloadAsV2 } from "@/lib/form3/v2/form3V2Mapper";
import type { Form2Data } from "@/lib/form2/form2Types";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";
import { parseSubmissionScope } from "./submissionScope";
import {
  ASSESSMENT_SNAPSHOT_SCHEMA_VERSION,
  type AssessmentSnapshotSourceVersions,
  type AssessmentSubmissionScope,
  type AssessmentSubmissionSnapshot,
} from "./types";

export type SnapshotReadModelOk = {
  ok: true;
  schemaVersion: number;
  caseId: string;
  submittedAt: string;
  cycleTitle: string | null;
  milestoneTitle: string | null;
  milestoneType: string | null;
  evaluationType: string | null;
  submissionScope: AssessmentSubmissionScope | null;
  sourceVersions: AssessmentSnapshotSourceVersions;
  form2: Form2Data | null;
  form3: Form3DataV2 | null;
  informationCards: Array<Record<string, unknown>>;
  form2EvidenceLinks: Array<Record<string, unknown>>;
  fieldReflections: Array<Record<string, unknown>>;
  patientUnderstanding: {
    patientId: string;
    overviewText: string;
    updatedAt: string | null;
  } | null;
  includedArtifacts: string[];
};

export type SnapshotReadModelFail = {
  ok: false;
  message: string;
};

export type SnapshotReadModel = SnapshotReadModelOk | SnapshotReadModelFail;

const UNSUPPORTED =
  "この提出データは現在の表示形式に対応していません";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asSourceVersions(raw: unknown): AssessmentSnapshotSourceVersions {
  if (!isRecord(raw)) {
    return { form2: null, form3: null, patientUnderstanding: null };
  }
  return {
    form2: typeof raw.form2 === "number" ? raw.form2 : null,
    form3: typeof raw.form3 === "number" ? raw.form3 : null,
    patientUnderstanding:
      typeof raw.patientUnderstanding === "string"
        ? raw.patientUnderstanding
        : null,
  };
}

/**
 * assessment_submissions.snapshot を検証し、教員向け表示用モデルへ変換する。
 * 想定外形式では ok:false（画面破壊・生JSON露出なし）。
 */
export function parseAssessmentSnapshot(
  raw: unknown,
  patientIdFallback = "A",
): SnapshotReadModel {
  try {
    if (!isRecord(raw)) {
      return { ok: false, message: UNSUPPORTED };
    }

    const schemaVersion = Number(raw.schemaVersion);
    if (
      !Number.isFinite(schemaVersion) ||
      schemaVersion < 1 ||
      schemaVersion > ASSESSMENT_SNAPSHOT_SCHEMA_VERSION + 2
    ) {
      return { ok: false, message: UNSUPPORTED };
    }

    const caseId =
      typeof raw.caseId === "string" && raw.caseId.trim()
        ? raw.caseId
        : null;
    if (!caseId) return { ok: false, message: UNSUPPORTED };

    const submittedAt =
      typeof raw.submittedAt === "string" ? raw.submittedAt : "";

    const cycle = isRecord(raw.assessmentCycle) ? raw.assessmentCycle : null;
    const milestone = isRecord(raw.assessmentMilestone)
      ? raw.assessmentMilestone
      : null;

    let form2: Form2Data | null = null;
    if (raw.form2 != null) {
      try {
        form2 = sanitizeForm2Payload(raw.form2, patientIdFallback);
      } catch {
        return { ok: false, message: UNSUPPORTED };
      }
    }

    let form3: Form3DataV2 | null = null;
    if (raw.form3 != null) {
      try {
        const sanitized = sanitizeForm3PayloadAsV2(
          raw.form3,
          patientIdFallback,
        );
        form3 = sanitized.payload;
      } catch {
        return { ok: false, message: UNSUPPORTED };
      }
    }

    const informationCards = Array.isArray(raw.informationCards)
      ? raw.informationCards.filter(isRecord)
      : [];
    const form2EvidenceLinks = Array.isArray(raw.form2EvidenceLinks)
      ? raw.form2EvidenceLinks.filter(isRecord)
      : [];
    const fieldReflections = Array.isArray(raw.fieldReflections)
      ? raw.fieldReflections.filter(isRecord)
      : [];

    let patientUnderstanding: SnapshotReadModelOk["patientUnderstanding"] =
      null;
    if (isRecord(raw.patientUnderstanding)) {
      patientUnderstanding = {
        patientId:
          typeof raw.patientUnderstanding.patientId === "string"
            ? raw.patientUnderstanding.patientId
            : patientIdFallback,
        overviewText:
          typeof raw.patientUnderstanding.overviewText === "string"
            ? raw.patientUnderstanding.overviewText
            : "",
        updatedAt:
          typeof raw.patientUnderstanding.updatedAt === "string"
            ? raw.patientUnderstanding.updatedAt
            : null,
      };
    }

    const sourceVersions = asSourceVersions(raw.sourceVersions);
    const submissionScope = milestone?.submissionScope
      ? parseSubmissionScope(milestone.submissionScope)
      : null;

    const includedArtifacts: string[] = [];
    if (form2) includedArtifacts.push("様式2");
    if (form3) includedArtifacts.push("様式3");
    if (informationCards.length > 0) includedArtifacts.push("情報カード");
    if (form2EvidenceLinks.length > 0) includedArtifacts.push("Evidenceリンク");
    if (fieldReflections.length > 0) includedArtifacts.push("フィールド振り返り");
    if (patientUnderstanding?.overviewText?.trim()) {
      includedArtifacts.push("患者理解");
    }

    return {
      ok: true,
      schemaVersion,
      caseId,
      submittedAt,
      cycleTitle:
        cycle && typeof cycle.title === "string" ? cycle.title : null,
      milestoneTitle:
        milestone && typeof milestone.title === "string"
          ? milestone.title
          : null,
      milestoneType:
        milestone && typeof milestone.milestoneType === "string"
          ? milestone.milestoneType
          : null,
      evaluationType:
        milestone && typeof milestone.evaluationType === "string"
          ? milestone.evaluationType
          : null,
      submissionScope,
      sourceVersions,
      form2,
      form3,
      informationCards,
      form2EvidenceLinks,
      fieldReflections,
      patientUnderstanding,
      includedArtifacts,
    };
  } catch {
    return { ok: false, message: UNSUPPORTED };
  }
}

/** 型ガード用（テスト・呼び出し側） */
export function isAssessmentSubmissionSnapshot(
  raw: unknown,
): raw is AssessmentSubmissionSnapshot {
  return parseAssessmentSnapshot(raw).ok;
}
