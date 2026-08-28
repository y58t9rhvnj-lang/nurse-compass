/**
 * 正式 AiEvaluationPackage 組み立て（個別 Export / Batch Export 共通）。
 * schema: docs/version2/ai/schemas/ai-evaluation-package.schema.json
 */

import { createHmac } from "crypto";
import type { AiAnonymizedAssessmentRecord } from "@/lib/v2/assessment/aiExportAnonymize";
import type { AiAnonymousIdMapper } from "@/lib/v2/assessment/aiExportAnonymize";
import {
  AI_EXPORT_SCHEMA_VERSION,
} from "@/lib/v2/assessment/aiExportAnonymize";
import {
  AI_EVAL_COMPASS_POLICY_VERSION,
  AI_EVAL_PACKAGE_SCHEMA_VERSION,
  AI_EVAL_RUBRIC_VERSION,
  aiEvalCaseVersionsForPatientId,
} from "@/lib/v2/assessment/aiEvaluationVersions";
import {
  AI_EVAL_GOLD_DECLARATION,
  buildAiEvaluationCompassPolicy,
  buildAiEvaluationInstructions,
  buildAiEvaluationOutputSchemaHint,
  buildAiEvaluationRubricBlock,
} from "@/lib/v2/assessment/aiEvaluationPackageStaticContent";
import { getPatientAGoldStandardV1OrNull } from "@/lib/gold/patientA/goldStandardV1";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "@/lib/gold/patientA/canonicalInformationCatalog";
import type { GoldStandardDocument } from "@/lib/gold/types";

export type AiEvaluationPackage = {
  metadata: Record<string, unknown>;
  compass_policy: Record<string, unknown>;
  rubric: Record<string, unknown>;
  gold_standard: Record<string, unknown>;
  case_context: Record<string, unknown>;
  student_submission: Record<string, unknown>;
  evaluation_instructions: Record<string, unknown>;
  output_schema_hint: Record<string, unknown>;
};

export type BuildAiEvaluationPackageInput = {
  evaluationRequestId: string;
  generatedAt: string;
  generatedByRole: "teacher" | "admin";
  /** prepareAiEvaluationPackageStudentSubmission 済み（evaluation_request_id は除去する） */
  studentSubmission: AiAnonymizedAssessmentRecord;
  /** 症例 patientId（例: "A"）— gold / case_version 解決用 */
  patientId: string;
  /** 匿名 ID マッパー（gold catalog ID の匿名化に再利用） */
  idMapper: AiAnonymousIdMapper;
  /** マッパー用シークレット（cinfo_ プレフィックス用） */
  idSecret: string;
  organizationScopeKey: string;
};

/** package の student_submission から evaluation_request_id を除く */
export function toPackageStudentSubmission(
  record: AiAnonymizedAssessmentRecord,
): Record<string, unknown> {
  const { evaluation_request_id: _omit, ...rest } = record;
  return { ...rest };
}

function anonCatalogId(
  secret: string,
  orgKey: string,
  rawId: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${orgKey}|cinfo|${rawId}`)
    .digest("hex")
    .slice(0, 16);
  return `cinfo_${digest}`;
}

function anonCtpId(
  secret: string,
  orgKey: string,
  rawId: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${orgKey}|ctp|${rawId}`)
    .digest("hex")
    .slice(0, 16);
  return `ctp_${digest}`;
}

function buildGoldStandardBlock(
  doc: GoldStandardDocument,
  version: string,
  secret: string,
  orgKey: string,
): Record<string, unknown> {
  return {
    version,
    schema_version: doc.schemaVersion,
    declaration: AI_EVAL_GOLD_DECLARATION,
    purpose:
      doc.purpose ??
      "完成答案を提示するのではなく、事実・意味・不足情報・患者理解の更新を追体験する教材",
    framework: {
      philosophy: "Patient Understanding First",
      basic_cycle: ["facts", "meaning", "missing", "update"],
    },
    initial_understanding: doc.initialUnderstanding,
    critical_thinking_points: doc.criticalThinkingPoints.map((ctp) => ({
      id: anonCtpId(secret, orgKey, ctp.id),
      ...(ctp.title ? { title: ctp.title } : {}),
      student_assumption: ctp.studentAssumption,
      facts: [...ctp.facts],
      gordon_lenses: [...ctp.gordonLenses],
      meaning: [...ctp.meaning],
      missing: [...ctp.missing],
      update: ctp.update,
      next_question: ctp.nextQuestion,
      evidence_information_ids: ctp.evidenceInformationIds.map((id) =>
        anonCatalogId(secret, orgKey, id),
      ),
    })),
    integrated_understanding: doc.integratedUnderstanding,
    remaining_unknowns: [...doc.remainingUnknowns],
    assessment_criteria: [...doc.assessmentCriteria],
    not_for_verbatim_matching: true,
    teacher_insight_included: false,
  };
}

function buildCaseContextBlock(input: {
  caseKey: string;
  caseVersion: string;
  studentSubmission: AiAnonymizedAssessmentRecord;
  goldDoc: GoldStandardDocument | null;
  secret: string;
  orgKey: string;
}): Record<string, unknown> {
  const meta = input.studentSubmission.meta;
  const referencedIds = new Set<string>();
  if (input.goldDoc) {
    for (const ctp of input.goldDoc.criticalThinkingPoints) {
      for (const id of ctp.evidenceInformationIds) referencedIds.add(id);
    }
  }
  const goldReferenced = PATIENT_A_CANONICAL_INFORMATION_CATALOG.filter((c) =>
    referencedIds.has(c.id),
  ).map((c) => ({
    anonymous_id: anonCatalogId(input.secret, input.orgKey, c.id),
    so_type: c.soType,
    primary_pattern_key: c.primaryPatternKey,
    content: c.content,
  }));

  return {
    case_key: input.caseKey,
    case_version: input.caseVersion,
    evaluation_moment: {
      anonymous_label: meta.milestone_title ?? "評価時点",
      milestone_type: meta.milestone_type ?? "midterm",
      evaluation_type: meta.evaluation_type ?? "formative",
    },
    canonical_case: {
      summary:
        "精神看護の教育症例（匿名）。退院準備期の生活・症状・活動参加に関する情報が学生に提示される。",
      allowed_facts: [
        "OT辞退とSST定着に関する観察",
        "夜間幻聴と対処行動に関する観察",
        "促しがあれば入浴・洗濯を実施できるという観察",
      ],
    },
    gold_referenced_information: goldReferenced,
    student_visible_scope: {
      description:
        "提出時点のスナップショットのうち、課題scopeに含まれる成果物と理解形成工程のみを評価に用いる。",
      includes: [
        "症例正本のうち学生公開範囲",
        "Goldが参照する根拠情報のうち学生が収集し得た事実に対応するもの",
        "提出スナップショット内の様式2・情報カード・フィールド振り返り・患者理解",
        "課題scopeに含まれる場合の様式3",
      ],
    },
    excluded_from_evaluation: [
      "教員のみが知る後日情報",
      "非公開カルテ拡張",
      "Teacher Insight",
      "private_note",
      "student_notes",
      "form2_evidence_links",
      "保存回数・入力回数・編集履歴・autosave・作業時間・文章量そのもの",
      "カード数・リンク数の努力点加点",
    ],
  };
}

/**
 * schema 準拠の正式 AiEvaluationPackage を1件組み立てる。
 * 個別 Export / Batch Export の唯一の Package 生成経路。
 */
export function buildAiEvaluationPackage(
  input: BuildAiEvaluationPackageInput,
): AiEvaluationPackage {
  const versions = aiEvalCaseVersionsForPatientId(input.patientId);
  const goldDoc =
    input.patientId === "A" || input.patientId.toLowerCase() === "a"
      ? getPatientAGoldStandardV1OrNull()
      : null;

  const gold_standard = goldDoc
    ? buildGoldStandardBlock(
        goldDoc,
        versions.goldStandardVersion,
        input.idSecret,
        input.organizationScopeKey,
      )
    : {
        version: versions.goldStandardVersion,
        schema_version: 1,
        declaration: AI_EVAL_GOLD_DECLARATION,
        purpose:
          "完成答案を提示するのではなく、事実・意味・不足情報・患者理解の更新を追体験する教材",
        framework: {
          philosophy: "Patient Understanding First",
          basic_cycle: ["facts", "meaning", "missing", "update"],
        },
        initial_understanding: "",
        critical_thinking_points: [],
        integrated_understanding: "",
        remaining_unknowns: [],
        assessment_criteria: [],
        not_for_verbatim_matching: true,
        teacher_insight_included: false,
      };

  return {
    metadata: {
      package_schema_version: AI_EVAL_PACKAGE_SCHEMA_VERSION,
      compass_policy_version: AI_EVAL_COMPASS_POLICY_VERSION,
      rubric_version: AI_EVAL_RUBRIC_VERSION,
      gold_standard_version: versions.goldStandardVersion,
      case_version: versions.caseVersion,
      export_schema_version: AI_EXPORT_SCHEMA_VERSION,
      generated_at: input.generatedAt,
      evaluation_request_id: input.evaluationRequestId,
      generated_by_role: input.generatedByRole,
      locale: "ja-JP",
    },
    compass_policy: buildAiEvaluationCompassPolicy(),
    rubric: buildAiEvaluationRubricBlock(),
    gold_standard,
    case_context: buildCaseContextBlock({
      caseKey: versions.caseKey,
      caseVersion: versions.caseVersion,
      studentSubmission: input.studentSubmission,
      goldDoc,
      secret: input.idSecret,
      orgKey: input.organizationScopeKey,
    }),
    student_submission: toPackageStudentSubmission(input.studentSubmission),
    evaluation_instructions: buildAiEvaluationInstructions(),
    output_schema_hint: buildAiEvaluationOutputSchemaHint(),
  };
}

/** Package の必須ルートキー（軽量チェック） */
export function assertAiEvaluationPackageShape(
  pkg: unknown,
): { ok: true } | { ok: false; missing: string[] } {
  if (!pkg || typeof pkg !== "object" || Array.isArray(pkg)) {
    return {
      ok: false,
      missing: [
        "metadata",
        "compass_policy",
        "rubric",
        "gold_standard",
        "case_context",
        "student_submission",
        "evaluation_instructions",
        "output_schema_hint",
      ],
    };
  }
  const o = pkg as Record<string, unknown>;
  const required = [
    "metadata",
    "compass_policy",
    "rubric",
    "gold_standard",
    "case_context",
    "student_submission",
    "evaluation_instructions",
    "output_schema_hint",
  ];
  const missing = required.filter((k) => !(k in o));
  if (missing.length) return { ok: false, missing };
  const meta = o.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return { ok: false, missing: ["metadata.evaluation_request_id"] };
  }
  if (
    typeof (meta as Record<string, unknown>).evaluation_request_id !== "string"
  ) {
    return { ok: false, missing: ["metadata.evaluation_request_id"] };
  }
  return { ok: true };
}
