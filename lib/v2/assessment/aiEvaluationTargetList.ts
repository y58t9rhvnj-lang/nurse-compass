/**
 * 本番 AI 評価の固定対象リスト（Export / LLM / validation / Import 共通）。
 * 個人情報は含めない。
 */

import { createHmac } from "crypto";
import type {
  AiEvalExclusionTally,
  AiEvalSelectedTarget,
} from "@/lib/v2/assessment/aiEvaluationTargetSelection";

export const AI_EVAL_TARGET_LIST_SCHEMA_VERSION = 1 as const;

export type AiEvalFixedTargetEntry = {
  evaluation_request_id: string;
  submission_id: string;
  anonymous_student_key: string;
  selection_reason: string;
};

export type AiEvalFixedTargetList = {
  schema_version: typeof AI_EVAL_TARGET_LIST_SCHEMA_VERSION;
  kind: "ai_evaluation_target_list";
  milestone_id: string;
  generated_at: string;
  target_count: number;
  targets: AiEvalFixedTargetEntry[];
  exclusions: {
    total: number;
    by_reason: AiEvalExclusionTally;
  };
};

export function anonymousStudentKey(input: {
  secret: string;
  organizationId: string;
  studentUserId: string;
}): string {
  const digest = createHmac("sha256", input.secret)
    .update(`${input.organizationId}|student|${input.studentUserId}`)
    .digest("hex")
    .slice(0, 16);
  return `stu_${digest}`;
}

export function buildAiEvalFixedTargetList(input: {
  milestoneId: string;
  generatedAt: string;
  idSecret: string;
  organizationId: string;
  selected: AiEvalSelectedTarget[];
  evaluationRequestIdsBySubmissionId: Map<string, string>;
  exclusions: AiEvalExclusionTally;
}): AiEvalFixedTargetList {
  const targets: AiEvalFixedTargetEntry[] = [];
  for (const s of input.selected) {
    const evalId = input.evaluationRequestIdsBySubmissionId.get(s.submissionId);
    if (!evalId) continue;
    targets.push({
      evaluation_request_id: evalId,
      submission_id: s.submissionId,
      anonymous_student_key: anonymousStudentKey({
        secret: input.idSecret,
        organizationId: input.organizationId,
        studentUserId: s.studentUserId,
      }),
      selection_reason: s.selectionReason,
    });
  }

  let exclusionTotal = 0;
  for (const n of Object.values(input.exclusions)) {
    exclusionTotal += n ?? 0;
  }

  return {
    schema_version: AI_EVAL_TARGET_LIST_SCHEMA_VERSION,
    kind: "ai_evaluation_target_list",
    milestone_id: input.milestoneId,
    generated_at: input.generatedAt,
    target_count: targets.length,
    targets,
    exclusions: {
      total: exclusionTotal,
      by_reason: { ...input.exclusions },
    },
  };
}

export function parseAiEvalFixedTargetList(
  raw: unknown,
):
  | { ok: true; list: AiEvalFixedTargetList }
  | { ok: false; message: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, message: "target-list がオブジェクトではありません。" };
  }
  const o = raw as Record<string, unknown>;
  if (o.schema_version !== AI_EVAL_TARGET_LIST_SCHEMA_VERSION) {
    return { ok: false, message: "target-list schema_version が不正です。" };
  }
  if (o.kind !== "ai_evaluation_target_list") {
    return { ok: false, message: "target-list.kind が不正です。" };
  }
  if (typeof o.milestone_id !== "string" || !o.milestone_id) {
    return { ok: false, message: "target-list.milestone_id が必要です。" };
  }
  if (typeof o.generated_at !== "string") {
    return { ok: false, message: "target-list.generated_at が必要です。" };
  }
  if (typeof o.target_count !== "number") {
    return { ok: false, message: "target-list.target_count が必要です。" };
  }
  if (!Array.isArray(o.targets)) {
    return { ok: false, message: "target-list.targets が必要です。" };
  }
  const targets: AiEvalFixedTargetEntry[] = [];
  const seenEval = new Set<string>();
  const seenSub = new Set<string>();
  for (const t of o.targets) {
    if (!t || typeof t !== "object") {
      return { ok: false, message: "target-list.targets の要素が不正です。" };
    }
    const row = t as Record<string, unknown>;
    const evaluation_request_id = String(row.evaluation_request_id ?? "");
    const submission_id = String(row.submission_id ?? "");
    const anonymous_student_key = String(row.anonymous_student_key ?? "");
    const selection_reason = String(row.selection_reason ?? "");
    if (!evaluation_request_id || !submission_id || !anonymous_student_key) {
      return { ok: false, message: "target-list の必須フィールドが欠けています。" };
    }
    if (seenEval.has(evaluation_request_id)) {
      return { ok: false, message: "evaluation_request_id が重複しています。" };
    }
    if (seenSub.has(submission_id)) {
      return { ok: false, message: "submission_id が重複しています。" };
    }
    seenEval.add(evaluation_request_id);
    seenSub.add(submission_id);
    targets.push({
      evaluation_request_id,
      submission_id,
      anonymous_student_key,
      selection_reason,
    });
  }
  if (targets.length !== o.target_count) {
    return {
      ok: false,
      message: `target_count(${o.target_count}) と targets.length(${targets.length}) が一致しません。`,
    };
  }
  const exclusionsRaw = o.exclusions;
  let exclusions: AiEvalFixedTargetList["exclusions"] = {
    total: 0,
    by_reason: {},
  };
  if (exclusionsRaw && typeof exclusionsRaw === "object" && !Array.isArray(exclusionsRaw)) {
    const er = exclusionsRaw as Record<string, unknown>;
    exclusions = {
      total: typeof er.total === "number" ? er.total : 0,
      by_reason:
        er.by_reason && typeof er.by_reason === "object" && !Array.isArray(er.by_reason)
          ? (er.by_reason as AiEvalExclusionTally)
          : {},
    };
  }
  return {
    ok: true,
    list: {
      schema_version: AI_EVAL_TARGET_LIST_SCHEMA_VERSION,
      kind: "ai_evaluation_target_list",
      milestone_id: String(o.milestone_id),
      generated_at: String(o.generated_at),
      target_count: targets.length,
      targets,
      exclusions,
    },
  };
}

/** Import が固定リスト外の evaluation_request_id を拒否する */
export function assertEvaluationRequestInTargetList(
  list: AiEvalFixedTargetList,
  evaluationRequestId: string,
): { ok: true } | { ok: false; kind: "outside_target_list"; message: string } {
  const hit = list.targets.some(
    (t) => t.evaluation_request_id === evaluationRequestId,
  );
  if (!hit) {
    return {
      ok: false,
      kind: "outside_target_list",
      message: "固定対象リスト外の evaluation_request_id です。取込できません。",
    };
  }
  return { ok: true };
}

export function assertTargetListIntegrity(list: AiEvalFixedTargetList): {
  ok: boolean;
  duplicateEvaluationRequestIds: string[];
  duplicateSubmissionIds: string[];
} {
  const evalIds = list.targets.map((t) => t.evaluation_request_id);
  const subIds = list.targets.map((t) => t.submission_id);
  const duplicateEvaluationRequestIds = evalIds.filter(
    (id, i) => evalIds.indexOf(id) !== i,
  );
  const duplicateSubmissionIds = subIds.filter(
    (id, i) => subIds.indexOf(id) !== i,
  );
  return {
    ok:
      duplicateEvaluationRequestIds.length === 0 &&
      duplicateSubmissionIds.length === 0 &&
      list.target_count === list.targets.length,
    duplicateEvaluationRequestIds,
    duplicateSubmissionIds,
  };
}
