// Compass Version 2.2 Sprint 5B-2 — AI評価 result の構造・内容検証

import { ASSESSMENT_RUBRIC_KEYS } from "./assessmentRubric";
import { normalizeAiEvaluationResult } from "./aiEvaluationResultNormalize";
import {
  sha256HexOfCanonicalJson,
  sha256HexOfString,
} from "./aiEvaluationResultHash";
import {
  AI_EVAL_RUBRIC_VERSION,
  isSupportedAiEvalPackageSchemaVersion,
  isSupportedAiEvalResultSchemaVersion,
} from "./aiEvaluationVersions";

export type AiEvalIssue = {
  code: string;
  message: string;
  path?: string;
};

export type AiEvalWarning = {
  family: "version" | "pii";
  code: string;
  message: string;
  payload: Record<string, unknown>;
  payload_hash: string;
};

export type AiEvalRequestSnapshot = {
  id: string;
  organizationId: string;
  assessmentSubmissionId: string;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  studentUserId: string;
  evaluationRequestId: string;
  packageSchemaVersion: number;
  resultSchemaVersion: number;
  compassPolicyVersion: string;
  rubricVersion: string;
  goldStandardVersion: string;
  caseVersion: string;
  exportSchemaVersion: number;
  status: "generated" | "used" | "expired";
  expiresAt: string;
  usedAt: string | null;
};

export type AiEvalValidateOutcome = {
  raw: unknown;
  normalized: Record<string, unknown> | null;
  resultHash: string | null;
  evaluationRequestId: string | null;
  validationStatus: "ok" | "warning" | "invalid";
  reviewStatus: "invalid" | "needs_review";
  errors: AiEvalIssue[];
  versionWarnings: AiEvalWarning[];
  piiWarnings: AiEvalWarning[];
  metadata: {
    resultSchemaVersion: number | null;
    packageSchemaVersion: number | null;
    compassPolicyVersion: string | null;
    rubricVersion: string | null;
    goldStandardVersion: string | null;
    caseVersion: string | null;
    exportSchemaVersion: number | null;
    generatedAt: string | null;
    modelLabel: string | null;
    sourceModel: string | null;
    sourceProvider: string | null;
    promptVersion: string | null;
  };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}

function makeWarning(
  family: "version" | "pii",
  code: string,
  message: string,
  payload: Record<string, unknown>,
): AiEvalWarning {
  return {
    family,
    code,
    message,
    payload,
    payload_hash: sha256HexOfCanonicalJson({ code, family, ...payload }),
  };
}

/** private_note キーの再帰検出 */
export function findPrivateNotePaths(
  value: unknown,
  path = "",
): string[] {
  const hits: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      hits.push(...findPrivateNotePaths(item, `${path}[${i}]`));
    });
    return hits;
  }
  if (!isRecord(value)) return hits;
  for (const [k, v] of Object.entries(value)) {
    const p = path ? `${path}.${k}` : k;
    if (/^private_note$/i.test(k) || /^privateNote$/.test(k)) {
      hits.push(p);
    }
    hits.push(...findPrivateNotePaths(v, p));
  }
  return hits;
}

type PiiHit = { code: string; strength: "strong" | "weak"; excerpt: string };

function scanPiiInText(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  if (!text) return hits;
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text)) {
    hits.push({ code: "pii_strong_email", strength: "strong", excerpt: "[EMAIL]" });
  }
  if (/(?:\+?81[- ]?)?0\d{1,4}[-−–]?\d{1,4}[-−–]?\d{3,4}/.test(text)) {
    hits.push({ code: "pii_strong_phone", strength: "strong", excerpt: "[PHONE]" });
  }
  if (
    /(?:学籍番号|学番|学生番号|個人ID|ログインID|login\s*id)[：:\s]*[A-Za-z0-9_\-]{2,32}/i.test(
      text,
    ) || /\b[Ss]\d{3,10}\b/.test(text)
  ) {
    hits.push({
      code: "pii_strong_student_id",
      strength: "strong",
      excerpt: "[STUDENT_ID]",
    });
  }
  if (/(?:氏名|名前|学生名|フルネーム)[：:\s]*[^\s、。，,\n]{1,20}/.test(text)) {
    hits.push({
      code: "pii_strong_name_label",
      strength: "strong",
      excerpt: "[NAME]",
    });
  }
  if (/\b[A-Za-z](?:\s*[.．・]\s*[A-Za-z])+\.?/.test(text)) {
    hits.push({
      code: "pii_weak_initials",
      strength: "weak",
      excerpt: "[INITIALS]",
    });
  }
  return hits;
}

function collectTextNodes(
  value: unknown,
  path: string,
  out: Array<{ path: string; text: string }>,
): void {
  if (typeof value === "string") {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectTextNodes(item, `${path}[${i}]`, out));
    return;
  }
  if (!isRecord(value)) return;
  // ID 系キーは検査しない
  const skip = new Set([
    "evaluation_request_id",
    "anonymous_object_id",
    "field_path",
    "rubric_key",
    "locale",
    "persist_to",
  ]);
  for (const [k, v] of Object.entries(value)) {
    if (skip.has(k)) continue;
    collectTextNodes(v, path ? `${path}.${k}` : k, out);
  }
}

function validateStructure(normalized: Record<string, unknown>): AiEvalIssue[] {
  const errors: AiEvalIssue[] = [];
  const meta = normalized.metadata;
  if (!isRecord(meta)) {
    errors.push({
      code: "schema_invalid",
      message: "metadata がありません。",
      path: "metadata",
    });
    return errors;
  }

  // supported 版は aiEvaluationVersions の helper を単一経路とする（magic number 禁止）。
  if (
    typeof meta.result_schema_version !== "number" ||
    !isSupportedAiEvalResultSchemaVersion(meta.result_schema_version)
  ) {
    errors.push({
      code: "unsupported_result_schema",
      message: "未対応の result_schema_version です。",
      path: "metadata.result_schema_version",
    });
  }
  if (
    typeof meta.package_schema_version !== "number" ||
    !isSupportedAiEvalPackageSchemaVersion(meta.package_schema_version)
  ) {
    errors.push({
      code: "unsupported_package_schema",
      message: "未対応の package_schema_version です。",
      path: "metadata.package_schema_version",
    });
  }
  if (!isUuid(meta.evaluation_request_id)) {
    errors.push({
      code: "schema_invalid",
      message: "evaluation_request_id が UUID ではありません。",
      path: "metadata.evaluation_request_id",
    });
  }
  if (meta.locale !== "ja-JP") {
    errors.push({
      code: "schema_invalid",
      message: "locale は ja-JP である必要があります。",
      path: "metadata.locale",
    });
  }

  const items = normalized.item_evaluations;
  if (!Array.isArray(items) || items.length < 1) {
    errors.push({
      code: "schema_invalid",
      message: "item_evaluations が不正です。",
      path: "item_evaluations",
    });
  } else {
    const seen = new Set<string>();
    items.forEach((item, idx) => {
      if (!isRecord(item)) {
        errors.push({
          code: "schema_invalid",
          message: "評価項目がオブジェクトではありません。",
          path: `item_evaluations[${idx}]`,
        });
        return;
      }
      const key = item.rubric_key;
      if (
        typeof key !== "string" ||
        !Array.isArray(ASSESSMENT_RUBRIC_KEYS) ||
        !(ASSESSMENT_RUBRIC_KEYS as readonly string[]).includes(key)
      ) {
        errors.push({
          code: "rubric_structure_broken",
          message: "未知または不正な評価項目です。",
          path: `item_evaluations[${idx}].rubric_key`,
        });
      } else {
        seen.add(key);
      }
      const score = item.score;
      if (
        score !== null &&
        !(
          typeof score === "number" &&
          Number.isInteger(score) &&
          score >= 1 &&
          score <= 5
        )
      ) {
        errors.push({
          code: "rubric_structure_broken",
          message: "score は 1〜5 の整数または null です。",
          path: `item_evaluations[${idx}].score`,
        });
      }
      if (typeof item.rationale !== "string" || !item.rationale.trim()) {
        errors.push({
          code: "schema_invalid",
          message: "rationale が空です。",
          path: `item_evaluations[${idx}].rationale`,
        });
      }
      const citations = item.citations;
      if (!Array.isArray(citations) || citations.length < 1) {
        errors.push({
          code: "citation_invalid",
          message: "citations が必要です。",
          path: `item_evaluations[${idx}].citations`,
        });
      } else {
        citations.forEach((c, ci) => {
          if (!isRecord(c)) {
            errors.push({
              code: "citation_invalid",
              message: "citation が不正です。",
              path: `item_evaluations[${idx}].citations[${ci}]`,
            });
            return;
          }
          const hasPath =
            typeof c.field_path === "string" && c.field_path.trim().length > 0;
          const hasId =
            typeof c.anonymous_object_id === "string" &&
            c.anonymous_object_id.trim().length > 0;
          if (!hasPath && !hasId) {
            errors.push({
              code: "citation_invalid",
              message:
                "citation には field_path または anonymous_object_id が必要です。",
              path: `item_evaluations[${idx}].citations[${ci}]`,
            });
          }
        });
      }
    });
  }

  const draft = normalized.student_feedback_draft;
  const obs = normalized.teacher_observation;
  if (!isRecord(draft)) {
    errors.push({
      code: "feedback_separation_broken",
      message: "student_feedback_draft がありません。",
      path: "student_feedback_draft",
    });
  } else {
    for (const k of [
      "strengths",
      "supporting_information",
      "next_questions",
      "gaps_or_alternatives",
    ] as const) {
      if (!Array.isArray(draft[k]) || (draft[k] as unknown[]).length < 1) {
        errors.push({
          code: "feedback_separation_broken",
          message: `${k} が不足しています。`,
          path: `student_feedback_draft.${k}`,
        });
      }
    }
  }
  if (!isRecord(obs)) {
    errors.push({
      code: "feedback_separation_broken",
      message: "teacher_observation がありません。",
      path: "teacher_observation",
    });
  } else {
    if (typeof obs.summary !== "string" || !obs.summary.trim()) {
      errors.push({
        code: "feedback_separation_broken",
        message: "teacher_observation.summary が空です。",
        path: "teacher_observation.summary",
      });
    }
    if (!Array.isArray(obs.attention_points)) {
      errors.push({
        code: "feedback_separation_broken",
        message: "attention_points が不正です。",
        path: "teacher_observation.attention_points",
      });
    }
    if (
      typeof obs.suggested_focus_for_feedback !== "string" ||
      !obs.suggested_focus_for_feedback.trim()
    ) {
      errors.push({
        code: "feedback_separation_broken",
        message: "suggested_focus_for_feedback が空です。",
        path: "teacher_observation.suggested_focus_for_feedback",
      });
    }
  }

  // 混線: draft に observation キー、またはその逆
  if (isRecord(draft) && ("summary" in draft || "attention_points" in draft)) {
    errors.push({
      code: "feedback_separation_broken",
      message: "student_feedback_draft に教員向けフィールドが混在しています。",
      path: "student_feedback_draft",
    });
  }
  if (
    isRecord(obs) &&
    ("strengths" in obs || "next_questions" in obs || "gaps_or_alternatives" in obs)
  ) {
    errors.push({
      code: "feedback_separation_broken",
      message: "teacher_observation に学生向けフィールドが混在しています。",
      path: "teacher_observation",
    });
  }

  const unc = normalized.uncertainty;
  if (!isRecord(unc) || typeof unc.notes !== "string" || !unc.notes.trim()) {
    errors.push({
      code: "schema_invalid",
      message: "uncertainty.notes が必要です。",
      path: "uncertainty",
    });
  }
  if (!Array.isArray(normalized.follow_up_checks)) {
    errors.push({
      code: "schema_invalid",
      message: "follow_up_checks が必要です。",
      path: "follow_up_checks",
    });
  }

  const hint = normalized.staging_hint;
  if (!isRecord(hint) || hint.auto_apply_forbidden !== true) {
    errors.push({
      code: "staging_hint_violation",
      message: "staging_hint.auto_apply_forbidden が true である必要があります。",
      path: "staging_hint",
    });
  }

  return errors;
}

export type ValidateAiEvaluationResultInput = {
  /** アップロード本文（文字列）または既に parse 済みオブジェクト */
  source: string | unknown;
  /** 組織コンテキスト（request 照合用）。無い場合は request 系チェックをスキップ */
  actorOrganizationId?: string;
  request?: AiEvalRequestSnapshot | null;
  /** request 行が無いと分かっているとき */
  requestLookup?: "found" | "missing" | "skipped";
};

/**
 * 取込前〜取込時の検証。DB 副作用なし。
 * request 照合は呼び出し側でロードした snapshot を渡す。
 */
export function validateAiEvaluationResult(
  input: ValidateAiEvaluationResultInput,
): AiEvalValidateOutcome {
  const errors: AiEvalIssue[] = [];
  const versionWarnings: AiEvalWarning[] = [];
  const piiWarnings: AiEvalWarning[] = [];

  let raw: unknown;
  if (typeof input.source === "string") {
    try {
      raw = JSON.parse(input.source);
    } catch {
      return {
        raw: null,
        normalized: null,
        resultHash: null,
        evaluationRequestId: null,
        validationStatus: "invalid",
        reviewStatus: "invalid",
        errors: [
          {
            code: "json_parse_error",
            message: "JSON として解析できません。",
          },
        ],
        versionWarnings: [],
        piiWarnings: [],
        metadata: emptyMeta(),
      };
    }
  } else {
    raw = input.source;
  }

  // 初期版: 1ファイル = 1 result（配列・JSONL は拒否）
  if (Array.isArray(raw)) {
    errors.push({
      code: "schema_invalid",
      message: "初期版は1ファイルあたり1件の result オブジェクトのみ受け付けます。",
    });
  }

  const privatePaths = findPrivateNotePaths(raw);
  if (privatePaths.length > 0) {
    errors.push({
      code: "private_note_contaminated",
      message: "private_note 相当のキーが含まれています。",
      path: privatePaths[0],
    });
  }

  const normalized = normalizeAiEvaluationResult(raw);
  if (!normalized) {
    errors.push({
      code: "schema_invalid",
      message: "result のルートがオブジェクトではありません。",
    });
  }

  if (normalized) {
    errors.push(...validateStructure(normalized));
  }

  const meta = normalized && isRecord(normalized.metadata) ? normalized.metadata : null;
  const evaluationRequestId = meta && isUuid(meta.evaluation_request_id)
    ? meta.evaluation_request_id
    : null;

  const resultHash = normalized ? sha256HexOfCanonicalJson(normalized) : null;

  // request 照合
  if (input.requestLookup === "missing") {
    errors.push({
      code: "evaluation_request_missing",
      message: "対応する評価リクエストが見つかりません。",
    });
  } else if (input.request) {
    const req = input.request;
    if (
      evaluationRequestId &&
      req.evaluationRequestId !== evaluationRequestId
    ) {
      errors.push({
        code: "evaluation_request_mismatch",
        message: "evaluation_request_id がリクエストと一致しません。",
      });
    }
    if (
      input.actorOrganizationId &&
      req.organizationId !== input.actorOrganizationId
    ) {
      errors.push({
        code: "submission_org_mismatch",
        message: "他組織の評価リクエストは取り込めません。",
      });
    }
    const expiresAt = new Date(req.expiresAt).getTime();
    if (
      req.status === "expired" ||
      (Number.isFinite(expiresAt) && expiresAt <= Date.now())
    ) {
      errors.push({
        code: "request_expired",
        message: "評価リクエストの有効期限が切れています。",
      });
    }

    // version warnings vs request
    if (meta) {
      pushVersionMismatch(
        versionWarnings,
        "rubric_version_mismatch",
        "rubric_version",
        meta.rubric_version,
        req.rubricVersion,
      );
      // 現行アプリ定数とも照合
      if (
        typeof meta.rubric_version === "string" &&
        meta.rubric_version !== AI_EVAL_RUBRIC_VERSION
      ) {
        const already = versionWarnings.some(
          (w) => w.code === "rubric_version_mismatch",
        );
        if (!already) {
          versionWarnings.push(
            makeWarning(
              "version",
              "rubric_version_mismatch",
              "rubric_version が現行アプリ定数と一致しません。",
              {
                expected: AI_EVAL_RUBRIC_VERSION,
                actual: meta.rubric_version,
              },
            ),
          );
        }
      }
      pushVersionMismatch(
        versionWarnings,
        "compass_policy_version_mismatch",
        "compass_policy_version",
        meta.compass_policy_version,
        req.compassPolicyVersion,
      );
      pushVersionMismatch(
        versionWarnings,
        "gold_standard_version_mismatch",
        "gold_standard_version",
        meta.gold_standard_version,
        req.goldStandardVersion,
      );
      pushVersionMismatch(
        versionWarnings,
        "case_version_mismatch",
        "case_version",
        meta.case_version,
        req.caseVersion,
      );
      if (
        typeof meta.export_schema_version === "number" &&
        meta.export_schema_version !== req.exportSchemaVersion
      ) {
        versionWarnings.push(
          makeWarning(
            "version",
            "export_schema_version_mismatch",
            "export_schema_version がリクエストと一致しません。",
            {
              expected: req.exportSchemaVersion,
              actual: meta.export_schema_version,
            },
          ),
        );
      }
    }
  }

  // incomplete rubric (warning, not fatal if structure otherwise ok)
  if (normalized && Array.isArray(normalized.item_evaluations)) {
    const keys = new Set<string>();
    for (const item of normalized.item_evaluations) {
      if (isRecord(item) && typeof item.rubric_key === "string") {
        keys.add(item.rubric_key);
      }
    }
    if (keys.size > 0 && keys.size < ASSESSMENT_RUBRIC_KEYS.length) {
      versionWarnings.push(
        makeWarning(
          "version",
          "incomplete_rubric_items",
          "評価項目が7件未満です。",
          { count: keys.size, expected: ASSESSMENT_RUBRIC_KEYS.length },
        ),
      );
    }
  }

  // PII
  if (normalized) {
    const texts: Array<{ path: string; text: string }> = [];
    collectTextNodes(normalized, "", texts);
    const seenCodes = new Set<string>();
    for (const t of texts) {
      for (const hit of scanPiiInText(t.text)) {
        const dedupe = `${hit.code}:${t.path}`;
        if (seenCodes.has(dedupe)) continue;
        seenCodes.add(dedupe);
        piiWarnings.push(
          makeWarning("pii", hit.code, `個人情報の疑い（${hit.strength}）: ${t.path}`, {
            path: t.path,
            strength: hit.strength,
            excerpt: hit.excerpt,
          }),
        );
      }
    }
  }

  const validationStatus: "ok" | "warning" | "invalid" =
    errors.length > 0
      ? "invalid"
      : versionWarnings.length > 0 || piiWarnings.length > 0
        ? "warning"
        : "ok";

  return {
    raw,
    normalized,
    resultHash,
    evaluationRequestId,
    validationStatus,
    reviewStatus: validationStatus === "invalid" ? "invalid" : "needs_review",
    errors,
    versionWarnings,
    piiWarnings,
    metadata: {
      resultSchemaVersion:
        typeof meta?.result_schema_version === "number"
          ? meta.result_schema_version
          : null,
      packageSchemaVersion:
        typeof meta?.package_schema_version === "number"
          ? meta.package_schema_version
          : null,
      compassPolicyVersion:
        typeof meta?.compass_policy_version === "string"
          ? meta.compass_policy_version
          : null,
      rubricVersion:
        typeof meta?.rubric_version === "string" ? meta.rubric_version : null,
      goldStandardVersion:
        typeof meta?.gold_standard_version === "string"
          ? meta.gold_standard_version
          : null,
      caseVersion:
        typeof meta?.case_version === "string" ? meta.case_version : null,
      exportSchemaVersion:
        typeof meta?.export_schema_version === "number"
          ? meta.export_schema_version
          : null,
      generatedAt:
        typeof meta?.generated_at === "string" ? meta.generated_at : null,
      modelLabel: typeof meta?.model_label === "string" ? meta.model_label : null,
      sourceModel: typeof meta?.model_label === "string" ? meta.model_label : null,
      sourceProvider: null,
      promptVersion: null,
    },
  };
}

function pushVersionMismatch(
  out: AiEvalWarning[],
  code: string,
  field: string,
  actual: unknown,
  expected: string,
) {
  if (typeof actual !== "string") return;
  if (actual === expected) return;
  out.push(
    makeWarning("version", code, `${field} がリクエストと一致しません。`, {
      field,
      expected,
      actual,
    }),
  );
}

function emptyMeta(): AiEvalValidateOutcome["metadata"] {
  return {
    resultSchemaVersion: null,
    packageSchemaVersion: null,
    compassPolicyVersion: null,
    rubricVersion: null,
    goldStandardVersion: null,
    caseVersion: null,
    exportSchemaVersion: null,
    generatedAt: null,
    modelLabel: null,
    sourceModel: null,
    sourceProvider: null,
    promptVersion: null,
  };
}

/** テスト・プレビュー用: 文字列ハッシュの安定性確認 */
export function hashWarningPayloadForTest(
  payload: Record<string, unknown>,
): string {
  return sha256HexOfString(JSON.stringify(payload));
}
