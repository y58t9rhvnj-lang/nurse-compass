// Compass Version 2.2 Sprint 5C — AI評価候補の教員向け read model（raw 非公開）

import {
  ASSESSMENT_RUBRIC_KEYS,
  ASSESSMENT_RUBRIC_LABELS,
  type AssessmentRubricKey,
  type AssessmentRubricScores,
} from "./assessmentRubric";
import type { AiEvalIssue, AiEvalWarning } from "./aiEvaluationResultValidate";

export type AiCandidateCitation = {
  fieldPath: string | null;
  anonymousObjectId: string | null;
  excerpt: string | null;
  note: string | null;
  resolveStatus: "ok" | "missing" | "excluded_evidence_links" | "unknown";
  resolveMessage: string | null;
};

export type AiCandidateItem = {
  rubricKey: AssessmentRubricKey;
  label: string;
  score: number | null;
  levelLabel: string | null;
  rationale: string;
  uncertaintyNote: string | null;
  citations: AiCandidateCitation[];
  teacherScore: number | null;
};

export type AiCandidateFeedbackDraft = {
  strengths: string[];
  supportingInformation: string[];
  nextQuestions: string[];
  gapsOrAlternatives: string[];
  overallToneCheck: string | null;
};

export type AiCandidateTeacherObservation = {
  summary: string;
  attentionPoints: string[];
  suggestedFocusForFeedback: string | null;
};

export type AiCandidateWarningView = {
  family: "version" | "pii";
  code: string;
  message: string;
  payloadHash: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};

export type AiCandidateHistoryItem = {
  id: string;
  reviewStatus: string;
  validationStatus: string;
  importedAt: string;
  resultHash: string;
};

export type AiEvaluationCandidateReadModel = {
  stagingId: string;
  evaluationRequestId: string;
  requestId: string;
  assessmentSubmissionId: string;
  reviewStatus: string;
  validationStatus: string;
  resultHash: string;
  sourceModel: string | null;
  sourceProvider: string | null;
  promptVersion: string | null;
  versions: {
    packageSchemaVersion: number;
    resultSchemaVersion: number;
    compassPolicyVersion: string;
    rubricVersion: string;
    goldStandardVersion: string;
    caseVersion: string;
    exportSchemaVersion: number;
  };
  versionWarnings: AiCandidateWarningView[];
  piiWarnings: AiCandidateWarningView[];
  validationErrors: AiEvalIssue[];
  unackedWarningCount: number;
  canAdopt: boolean;
  adoptBlockedReasons: string[];
  items: AiCandidateItem[];
  feedbackDraft: AiCandidateFeedbackDraft;
  teacherObservation: AiCandidateTeacherObservation | null;
  uncertainty: {
    overallConfidence: string | null;
    notes: string | null;
    affectedRubricKeys: string[];
  } | null;
  followUpChecks: Array<{
    question: string;
    reason: string | null;
    relatedRubricKeys: string[];
  }>;
  teacherDraftOverlay: Record<string, unknown> | null;
  history: AiCandidateHistoryItem[];
  adoptionCount: number;
  hasPrivateNoteKey: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function joinCommentLines(lines: string[]): string {
  return lines.map((s) => s.trim()).filter(Boolean).join("\n");
}

export function feedbackBlockToReviewComment(
  block: "strengths" | "next_questions" | "gaps_or_alternatives",
  draft: AiCandidateFeedbackDraft,
): string {
  if (block === "strengths") return joinCommentLines(draft.strengths);
  if (block === "next_questions") return joinCommentLines(draft.nextQuestions);
  return joinCommentLines(draft.gapsOrAlternatives);
}

export type BuildCandidateReadModelInput = {
  staging: {
    id: string;
    evaluationRequestId: string;
    requestId: string;
    assessmentSubmissionId: string;
    reviewStatus: string;
    validationStatus: string;
    resultHash: string;
    sourceModel: string | null;
    sourceProvider: string | null;
    promptVersion: string | null;
    packageSchemaVersion: number;
    resultSchemaVersion: number;
    compassPolicyVersion: string;
    rubricVersion: string;
    goldStandardVersion: string;
    caseVersion: string;
    exportSchemaVersion: number;
    normalizedResultJson: unknown;
    versionWarnings: AiEvalWarning[];
    piiWarnings: AiEvalWarning[];
    validationErrors: AiEvalIssue[];
    teacherDraftOverlayJson: unknown;
    importedAt: string;
  };
  acks: Array<{
    warningFamily: "version" | "pii";
    warningCode: string;
    warningPayloadHash: string;
    acknowledgedAt: string;
  }>;
  teacherRubricScores: AssessmentRubricScores;
  review: {
    status: "draft" | "completed";
    currentlyReturned: boolean;
    exists: boolean;
  };
  actorRole: "teacher" | "admin";
  history: AiCandidateHistoryItem[];
  adoptionCount: number;
  resolveCitation: (c: {
    fieldPath: string | null;
    anonymousObjectId: string | null;
  }) => {
    resolveStatus: AiCandidateCitation["resolveStatus"];
    resolveMessage: string | null;
  };
};

function mapWarnings(
  family: "version" | "pii",
  warnings: AiEvalWarning[],
  acks: BuildCandidateReadModelInput["acks"],
): AiCandidateWarningView[] {
  return warnings.map((w) => {
    const ack = acks.find(
      (a) =>
        a.warningFamily === family &&
        a.warningCode === w.code &&
        a.warningPayloadHash === w.payload_hash,
    );
    return {
      family,
      code: w.code,
      message: w.message,
      payloadHash: w.payload_hash,
      acknowledged: Boolean(ack),
      acknowledgedAt: ack?.acknowledgedAt ?? null,
    };
  });
}

function findPrivateNoteKey(value: unknown, path = ""): boolean {
  if (Array.isArray(value)) {
    return value.some((v, i) => findPrivateNoteKey(v, `${path}[${i}]`));
  }
  if (!isRecord(value)) return false;
  for (const [k, v] of Object.entries(value)) {
    if (/^private_note$/i.test(k) || k === "privateNote") return true;
    if (findPrivateNoteKey(v, path ? `${path}.${k}` : k)) return true;
  }
  return false;
}

export function buildAiEvaluationCandidateReadModel(
  input: BuildCandidateReadModelInput,
): AiEvaluationCandidateReadModel {
  const normalized = input.staging.normalizedResultJson;
  const root = isRecord(normalized) ? normalized : {};
  const hasPrivateNoteKey = findPrivateNoteKey(normalized);

  const versionWarnings = mapWarnings(
    "version",
    input.staging.versionWarnings ?? [],
    input.acks,
  );
  const piiWarnings = mapWarnings(
    "pii",
    input.staging.piiWarnings ?? [],
    input.acks,
  );
  const unackedWarningCount =
    versionWarnings.filter((w) => !w.acknowledged).length +
    piiWarnings.filter((w) => !w.acknowledged).length;

  const itemEvals = Array.isArray(root.item_evaluations)
    ? root.item_evaluations
    : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const raw of itemEvals) {
    if (!isRecord(raw) || typeof raw.rubric_key !== "string") continue;
    byKey.set(raw.rubric_key, raw);
  }

  const items: AiCandidateItem[] = ASSESSMENT_RUBRIC_KEYS.map((key) => {
    const raw = byKey.get(key);
    const citationsRaw = Array.isArray(raw?.citations) ? raw!.citations : [];
    const citations: AiCandidateCitation[] = citationsRaw
      .filter(isRecord)
      .map((c) => {
        const fieldPath =
          typeof c.field_path === "string" && c.field_path.trim()
            ? c.field_path.trim()
            : null;
        const anonymousObjectId =
          typeof c.anonymous_object_id === "string" && c.anonymous_object_id.trim()
            ? c.anonymous_object_id.trim()
            : null;
        const resolved = input.resolveCitation({ fieldPath, anonymousObjectId });
        return {
          fieldPath,
          anonymousObjectId,
          excerpt:
            typeof c.excerpt === "string" && c.excerpt.trim()
              ? c.excerpt.trim().slice(0, 280)
              : null,
          note:
            typeof c.note === "string" && c.note.trim() ? c.note.trim() : null,
          resolveStatus: resolved.resolveStatus,
          resolveMessage: resolved.resolveMessage,
        };
      });

    const score =
      typeof raw?.score === "number" &&
      Number.isInteger(raw.score) &&
      raw.score >= 1 &&
      raw.score <= 5
        ? raw.score
        : null;

    return {
      rubricKey: key,
      label: ASSESSMENT_RUBRIC_LABELS[key],
      score,
      levelLabel:
        typeof raw?.level_label === "string" ? raw.level_label : null,
      rationale: typeof raw?.rationale === "string" ? raw.rationale : "",
      uncertaintyNote:
        typeof raw?.uncertainty_note === "string" ? raw.uncertainty_note : null,
      citations,
      teacherScore:
        typeof input.teacherRubricScores[key] === "number"
          ? (input.teacherRubricScores[key] as number)
          : null,
    };
  });

  const fb = isRecord(root.student_feedback_draft)
    ? root.student_feedback_draft
    : {};
  const feedbackDraft: AiCandidateFeedbackDraft = {
    strengths: asStringArray(fb.strengths),
    supportingInformation: asStringArray(fb.supporting_information),
    nextQuestions: asStringArray(fb.next_questions),
    gapsOrAlternatives: asStringArray(fb.gaps_or_alternatives),
    overallToneCheck:
      typeof fb.overall_tone_check === "string" ? fb.overall_tone_check : null,
  };

  let teacherObservation: AiCandidateTeacherObservation | null = null;
  if (isRecord(root.teacher_observation)) {
    teacherObservation = {
      summary:
        typeof root.teacher_observation.summary === "string"
          ? root.teacher_observation.summary
          : "",
      attentionPoints: asStringArray(root.teacher_observation.attention_points),
      suggestedFocusForFeedback:
        typeof root.teacher_observation.suggested_focus_for_feedback === "string"
          ? root.teacher_observation.suggested_focus_for_feedback
          : null,
    };
  }

  let uncertainty: AiEvaluationCandidateReadModel["uncertainty"] = null;
  if (isRecord(root.uncertainty)) {
    uncertainty = {
      overallConfidence:
        typeof root.uncertainty.overall_confidence === "string"
          ? root.uncertainty.overall_confidence
          : null,
      notes:
        typeof root.uncertainty.notes === "string"
          ? root.uncertainty.notes
          : null,
      affectedRubricKeys: asStringArray(root.uncertainty.affected_rubric_keys),
    };
  }

  const followUpChecks: AiEvaluationCandidateReadModel["followUpChecks"] = [];
  if (Array.isArray(root.follow_up_checks)) {
    for (const raw of root.follow_up_checks) {
      if (!isRecord(raw) || typeof raw.question !== "string") continue;
      followUpChecks.push({
        question: raw.question,
        reason: typeof raw.reason === "string" ? raw.reason : null,
        relatedRubricKeys: asStringArray(raw.related_rubric_keys),
      });
    }
  }

  const adoptBlockedReasons: string[] = [];
  const active =
    input.staging.reviewStatus === "needs_review" ||
    input.staging.reviewStatus === "partially_adopted";
  if (!active) {
    adoptBlockedReasons.push("この候補は確認中ではありません。");
  }
  if (input.staging.validationStatus === "invalid") {
    adoptBlockedReasons.push("検証エラーがある候補は採用できません。");
  }
  if (unackedWarningCount > 0) {
    adoptBlockedReasons.push("未確認の警告があります。");
  }
  // 下書き未作成でも採用可（adopt action が空の下書きを作成する）。
  // Batch Import 直後はほぼ全学生が未作成のため、ここでブロックすると
  // チェックボックスが disabled のまま反応しないように見える。
  if (input.review.exists && input.review.status === "completed") {
    adoptBlockedReasons.push("確定済みの評価には採用できません。");
  } else if (input.review.exists && input.review.currentlyReturned) {
    adoptBlockedReasons.push("返却中の評価には採用できません。");
  }
  if (input.actorRole !== "teacher") {
    adoptBlockedReasons.push("採用は教員のみ実行できます（管理者は閲覧のみ）。");
  }
  if (hasPrivateNoteKey) {
    adoptBlockedReasons.push("結果に private_note が含まれています。");
  }

  const canAdopt = adoptBlockedReasons.length === 0;

  return {
    stagingId: input.staging.id,
    evaluationRequestId: input.staging.evaluationRequestId,
    requestId: input.staging.requestId,
    assessmentSubmissionId: input.staging.assessmentSubmissionId,
    reviewStatus: input.staging.reviewStatus,
    validationStatus: input.staging.validationStatus,
    resultHash: input.staging.resultHash,
    sourceModel: input.staging.sourceModel,
    sourceProvider: input.staging.sourceProvider,
    promptVersion: input.staging.promptVersion,
    versions: {
      packageSchemaVersion: input.staging.packageSchemaVersion,
      resultSchemaVersion: input.staging.resultSchemaVersion,
      compassPolicyVersion: input.staging.compassPolicyVersion,
      rubricVersion: input.staging.rubricVersion,
      goldStandardVersion: input.staging.goldStandardVersion,
      caseVersion: input.staging.caseVersion,
      exportSchemaVersion: input.staging.exportSchemaVersion,
    },
    versionWarnings,
    piiWarnings,
    validationErrors: input.staging.validationErrors ?? [],
    unackedWarningCount,
    canAdopt,
    adoptBlockedReasons,
    items,
    feedbackDraft,
    teacherObservation,
    uncertainty,
    followUpChecks,
    teacherDraftOverlay: isRecord(input.staging.teacherDraftOverlayJson)
      ? (input.staging.teacherDraftOverlayJson as Record<string, unknown>)
      : null,
    history: input.history,
    adoptionCount: input.adoptionCount,
    hasPrivateNoteKey,
  };
}
