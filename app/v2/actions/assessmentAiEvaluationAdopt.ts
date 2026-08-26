"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  getTeacherAssessmentReviewBySubmissionId,
  insertTeacherAssessmentReviewDraft,
  validateReviewTargetSubmission,
} from "@/lib/v2/assessment/assessmentReviewRepository";
import { isAssessmentReviewCurrentlyReturned } from "@/lib/v2/assessment/assessmentReviewStatus";
import {
  ASSESSMENT_RUBRIC_KEYS,
  emptyRubricScores,
  sanitizeComment,
  type AssessmentRubricKey,
} from "@/lib/v2/assessment/assessmentRubric";
import {
  rpcAdoptAiEvaluationCandidate,
  type AiEvaluationAdoptionSelection,
} from "@/lib/v2/assessment/aiEvaluationAdoptionRepository";
import type { SupabaseClient } from "@supabase/supabase-js";

type TeacherContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | { ok: false; kind: string; message: string };

async function requireTeacherContext(): Promise<TeacherContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "backend not configured",
    };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "teacher") {
    return {
      ok: false,
      kind: "teacher_only",
      message: "採用は教員のみ実行できます。",
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

export type AdoptAiEvaluationInput = {
  stagingId: string;
  milestoneId: string;
  studentId: string;
  submissionId: string;
  reviewId: string | null;
  baseUpdatedAt: string | null;
  adoptedRubricKeys: AssessmentRubricKey[];
  adoptedCommentBlocks: Array<
    "strengths" | "next_questions" | "gaps_or_alternatives"
  >;
  dismissedRubricKeys?: AssessmentRubricKey[];
  dismissedCommentBlocks?: Array<
    "strengths" | "next_questions" | "gaps_or_alternatives"
  >;
  appliedRubricScores: Partial<Record<AssessmentRubricKey, number | null>>;
  appliedComments: {
    strengths?: string;
    next_questions?: string;
    gaps_or_alternatives?: string;
  };
};

export async function adoptAiEvaluationCandidateAction(
  input: AdoptAiEvaluationInput,
): Promise<
  | {
      ok: true;
      adoptionId: string;
      adoptionSequence: number;
      reviewId: string;
      reviewUpdatedAt: string;
    }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireTeacherContext();
  if (!ctx.ok) return ctx;

  const adoptedKeys = (input.adoptedRubricKeys ?? []).filter((k) =>
    (ASSESSMENT_RUBRIC_KEYS as readonly string[]).includes(k),
  );
  const adoptedBlocks = (input.adoptedCommentBlocks ?? []).filter((b) =>
    ["strengths", "next_questions", "gaps_or_alternatives"].includes(b),
  );
  if (adoptedKeys.length === 0 && adoptedBlocks.length === 0) {
    return {
      ok: false,
      kind: "empty_adoption",
      message: "採用する項目を選択してください。",
    };
  }

  const validated = await validateReviewTargetSubmission(
    ctx.supabase,
    ctx.profile.organizationId,
    {
      milestoneId: input.milestoneId,
      studentId: input.studentId,
      submissionId: input.submissionId,
    },
  );
  if (!validated.ok) {
    return {
      ok: false,
      kind: validated.kind ?? "validation",
      message: validated.message ?? "評価対象の提出を確認できません。",
    };
  }

  let reviewId = input.reviewId;
  let baseUpdatedAt = input.baseUpdatedAt;

  if (!reviewId) {
    const existing = await getTeacherAssessmentReviewBySubmissionId(
      ctx.supabase,
      ctx.profile.organizationId,
      input.submissionId,
    );
    if (existing.error) {
      return { ok: false, kind: "db_error", message: "評価を確認できませんでした。" };
    }
    if (existing.row) {
      if (existing.row.status === "completed") {
        return {
          ok: false,
          kind: "review_completed",
          message: "確定済みの評価には採用できません。",
        };
      }
      if (isAssessmentReviewCurrentlyReturned(existing.row)) {
        return {
          ok: false,
          kind: "review_returned",
          message: "返却中の評価には採用できません。",
        };
      }
      reviewId = existing.row.id;
      baseUpdatedAt = existing.row.updatedAt;
    } else {
      const inserted = await insertTeacherAssessmentReviewDraft(ctx.supabase, {
        organizationId: ctx.profile.organizationId,
        assessmentCycleId: validated.target.assessmentCycleId,
        assessmentMilestoneId: input.milestoneId,
        studentUserId: input.studentId,
        assessmentSubmissionId: input.submissionId,
        actorUserId: ctx.profile.id,
        rubricScores: emptyRubricScores(),
        overallComment: "",
        strengthsComment: "",
        nextStepsComment: "",
        missingInformationComment: "",
        privateNote: "",
      });
      if (!inserted.ok) {
        return {
          ok: false,
          kind: inserted.kind ?? "db_error",
          message: inserted.message ?? "評価下書きを作成できませんでした。",
        };
      }
      reviewId = inserted.row.id;
      baseUpdatedAt = inserted.row.updatedAt;
    }
  }

  if (!reviewId || !baseUpdatedAt) {
    return {
      ok: false,
      kind: "validation",
      message: "評価の楽観ロック情報（updated_at）が必要です。",
    };
  }

  const appliedScores: Partial<Record<AssessmentRubricKey, number>> = {};
  for (const key of adoptedKeys) {
    const v = input.appliedRubricScores[key];
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
      return {
        ok: false,
        kind: "invalid_score",
        message: `「${key}」のスコアは1〜5の整数にしてください。`,
      };
    }
    appliedScores[key] = v;
  }

  const selection: AiEvaluationAdoptionSelection = {
    adopted_rubric_keys: adoptedKeys,
    adopted_comment_blocks: adoptedBlocks,
    dismissed_rubric_keys: (input.dismissedRubricKeys ?? []).filter((k) =>
      (ASSESSMENT_RUBRIC_KEYS as readonly string[]).includes(k),
    ),
    dismissed_comment_blocks: (input.dismissedCommentBlocks ?? []).filter((b) =>
      ["strengths", "next_questions", "gaps_or_alternatives"].includes(b),
    ) as AiEvaluationAdoptionSelection["dismissed_comment_blocks"],
    include_overall_comment: false,
    include_teacher_observation: false,
    applied_rubric_scores: appliedScores,
    applied_comments: {
      strengths: sanitizeComment(input.appliedComments.strengths),
      next_questions: sanitizeComment(input.appliedComments.next_questions),
      gaps_or_alternatives: sanitizeComment(
        input.appliedComments.gaps_or_alternatives,
      ),
    },
    overlay: {
      edited_at: new Date().toISOString(),
    },
  };

  const adopted = await rpcAdoptAiEvaluationCandidate(ctx.supabase, {
    stagingId: input.stagingId,
    reviewId,
    baseUpdatedAt,
    selection,
  });
  if (!adopted.ok) return adopted;

  return {
    ok: true,
    adoptionId: adopted.adoptionId,
    adoptionSequence: adopted.adoptionSequence,
    reviewId,
    reviewUpdatedAt: adopted.reviewUpdatedAt,
  };
}
