import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssessmentRubricKey } from "./assessmentRubric";

export type AiEvaluationAdoptionSelection = {
  adopted_rubric_keys: AssessmentRubricKey[];
  adopted_comment_blocks: Array<
    "strengths" | "next_questions" | "gaps_or_alternatives"
  >;
  dismissed_rubric_keys: AssessmentRubricKey[];
  dismissed_comment_blocks: Array<
    "strengths" | "next_questions" | "gaps_or_alternatives"
  >;
  include_overall_comment: false;
  include_teacher_observation: false;
  applied_rubric_scores: Partial<Record<AssessmentRubricKey, number>>;
  applied_comments: Partial<{
    strengths: string;
    next_questions: string;
    gaps_or_alternatives: string;
  }>;
  overlay?: Record<string, unknown>;
};

export async function rpcAdoptAiEvaluationCandidate(
  supabase: SupabaseClient,
  input: {
    stagingId: string;
    reviewId: string;
    baseUpdatedAt: string;
    selection: AiEvaluationAdoptionSelection;
  },
): Promise<
  | {
      ok: true;
      adoptionId: string;
      adoptionSequence: number;
      reviewUpdatedAt: string;
      appliedSnapshot: Record<string, unknown>;
    }
  | { ok: false; kind: string; message: string }
> {
  const { data, error } = await supabase.rpc("adopt_ai_evaluation_candidate", {
    p_staging_id: input.stagingId,
    p_review_id: input.reviewId,
    p_base_updated_at: input.baseUpdatedAt,
    p_selection_json: {
      ...input.selection,
      include_overall_comment: false,
      include_teacher_observation: false,
    },
  });
  if (error) {
    return {
      ok: false,
      kind: "db_error",
      message: "AI評価の一部採用を保存できませんでした。",
    };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || row.ok !== true) {
    const err = typeof row?.error === "string" ? row.error : "db_error";
    const messages: Record<string, string> = {
      unauthorized: "ログインが必要です。",
      teacher_only: "採用は教員のみ実行できます。",
      not_found: "AI評価候補が見つかりません。",
      staging_not_active: "この候補は採用対象ではありません。",
      staging_superseded: "この候補は新しい取込により無効になっています。",
      invalid_candidate: "無効な候補は採用できません。",
      warnings_unacked: "未確認の警告があるため採用できません。",
      review_not_found: "評価下書きが見つかりません。",
      review_completed: "確定済みの評価には採用できません。",
      review_returned: "返却中の評価には採用できません。",
      conflict:
        "別の画面で評価が更新されています。再読み込みしてから採用してください。",
      empty_selection: "採用する項目を選択してください。",
      empty_adoption: "採用する項目を選択してください。",
      submission_mismatch: "提出と評価の対応が一致しません。",
      validation: "採用内容の形式が正しくありません。",
      invalid_rubric_key: "不明な評価項目が含まれています。",
      invalid_score: "評価スコアは1〜5の整数にしてください。",
      missing_applied_score: "採用するスコアが不足しています。",
      unsupported_comment_block: "このコメントブロックは採用対象外です。",
      invalid_comment_block: "不明なコメントブロックです。",
      staging_state_conflict: "候補の状態が競合しました。再読み込みしてください。",
    };
    return {
      ok: false,
      kind: err,
      message: messages[err] ?? "AI評価の一部採用に失敗しました。",
    };
  }
  return {
    ok: true,
    adoptionId: String(row.adoptionId),
    adoptionSequence: Number(row.adoptionSequence),
    reviewUpdatedAt: String(row.reviewUpdatedAt),
    appliedSnapshot:
      row.appliedSnapshot && typeof row.appliedSnapshot === "object"
        ? (row.appliedSnapshot as Record<string, unknown>)
        : {},
  };
}
