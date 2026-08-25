"use server";

import { isSupabaseConfigured } from "@/lib/v2/env";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  parseRubricScores,
  type AssessmentRubricScores,
} from "@/lib/v2/assessment/assessmentRubric";
import type { AssessmentEvaluationType } from "@/lib/v2/assessment/types";

export type StudentReturnedReviewListItem = {
  reviewId: string;
  cycleTitle: string;
  milestoneTitle: string;
  evaluationType: AssessmentEvaluationType;
  submissionNumber: number;
  returnedAt: string;
};

export type StudentReturnedReviewDetail = StudentReturnedReviewListItem & {
  rubricScores: AssessmentRubricScores;
  overallComment: string;
  strengthsComment: string;
  nextStepsComment: string;
  missingInformationComment: string;
};

function asEvaluationType(v: unknown): AssessmentEvaluationType {
  return v === "summative" ? "summative" : "formative";
}

async function requireStudent() {
  if (!isSupabaseConfigured()) {
    return {
      ok: false as const,
      kind: "not_configured",
      message: "backend not configured",
    };
  }
  const profile = await getCurrentProfile();
  if (!profile || !profile.isActive || profile.role !== "student") {
    return {
      ok: false as const,
      kind: "unauthorized",
      message: "student login required",
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true as const, supabase, profile };
}

export async function listStudentReturnedReviewsAction(): Promise<
  | { ok: true; items: StudentReturnedReviewListItem[]; count: number }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase.rpc(
    "list_my_returned_assessment_reviews",
  );
  if (error) {
    return { ok: false, kind: "db_error", message: "フィードバックを読み込めませんでした。" };
  }
  const root = data as Record<string, unknown> | null;
  if (!root || root.ok !== true) {
    return {
      ok: false,
      kind: String(root?.error ?? "db_error"),
      message: "フィードバックを読み込めませんでした。",
    };
  }
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const items: StudentReturnedReviewListItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    // private_note 等が混入していても無視
    if (typeof o.reviewId !== "string") continue;
    items.push({
      reviewId: o.reviewId,
      cycleTitle: String(o.cycleTitle ?? ""),
      milestoneTitle: String(o.milestoneTitle ?? ""),
      evaluationType: asEvaluationType(o.evaluationType),
      submissionNumber: Number(o.submissionNumber ?? 0),
      returnedAt: String(o.returnedAt ?? ""),
    });
  }
  return { ok: true, items, count: items.length };
}

export async function getStudentReturnedReviewDetailAction(
  reviewId: string,
): Promise<
  | { ok: true; review: StudentReturnedReviewDetail }
  | { ok: false; kind: string; message: string }
> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  if (!reviewId) {
    return { ok: false, kind: "validation", message: "評価が指定されていません。" };
  }

  const { data, error } = await ctx.supabase.rpc(
    "get_my_returned_assessment_review",
    { p_review_id: reviewId },
  );
  if (error) {
    return { ok: false, kind: "db_error", message: "フィードバックを読み込めませんでした。" };
  }
  const root = data as Record<string, unknown> | null;
  if (!root || root.ok !== true || !root.review || typeof root.review !== "object") {
    const err = String(root?.error ?? "not_found");
    return {
      ok: false,
      kind: err,
      message:
        err === "not_found"
          ? "フィードバックが見つかりません。"
          : "フィードバックを読み込めませんでした。",
    };
  }
  const o = root.review as Record<string, unknown>;
  // 明示 DTO — private_note / *_by / submission_id は載せない
  return {
    ok: true,
    review: {
      reviewId: String(o.reviewId ?? ""),
      cycleTitle: String(o.cycleTitle ?? ""),
      milestoneTitle: String(o.milestoneTitle ?? ""),
      evaluationType: asEvaluationType(o.evaluationType),
      submissionNumber: Number(o.submissionNumber ?? 0),
      returnedAt: String(o.returnedAt ?? ""),
      rubricScores: parseRubricScores(o.rubricScores),
      overallComment: String(o.overallComment ?? ""),
      strengthsComment: String(o.strengthsComment ?? ""),
      nextStepsComment: String(o.nextStepsComment ?? ""),
      missingInformationComment: String(o.missingInformationComment ?? ""),
    },
  };
}
