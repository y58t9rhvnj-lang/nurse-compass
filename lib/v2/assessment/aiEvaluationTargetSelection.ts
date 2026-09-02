/**
 * 本番 AI 評価対象の抽出・件数集計（純関数）。
 * DB VIEW 変更の代わりにアプリ層でも同じ規則を検証できるようにする。
 */

export type AiEvalAccountKind = "real_student" | "verification_account";

export type AiEvalCandidateInput = {
  submissionId: string;
  studentUserId: string;
  milestoneId: string;
  submittedAt: string;
  /** profiles.exclude_from_assessment */
  excludeFromAssessment: boolean;
  /** role === 'student' && is_active */
  isActiveStudent: boolean;
  /** withdrawn / rejected late 等で評価不可なら false */
  isEvaluable: boolean;
  hasEvaluableSnapshot: boolean;
};

export type AiEvalSelectionReason =
  | "eligible_real_student_submission"
  | "latest_of_multiple_submissions";

export type AiEvalExclusionReason =
  | "verification_account"
  | "inactive_or_non_student"
  | "not_evaluable_submission"
  | "missing_snapshot"
  | "wrong_milestone"
  | "duplicate_student_superseded"
  | "unsubmitted";

export type AiEvalSelectedTarget = {
  submissionId: string;
  studentUserId: string;
  milestoneId: string;
  submittedAt: string;
  selectionReason: AiEvalSelectionReason;
};

export type AiEvalExclusionTally = Partial<Record<AiEvalExclusionReason, number>>;

export type AiEvalCohortCounts = {
  /** 実学生（検証除外） */
  realStudentCount: number;
  /** 実学生のうち提出済み（候補になり得る提出がある） */
  submittedRealStudentCount: number;
  /** 実学生のうち未提出 */
  unsubmittedRealStudentCount: number;
  /** 検証用学生アカウント数（スタッフは含まない） */
  verificationStudentCount: number;
  /** 本番 AI 評価対象件数 */
  aiEvaluationTargetCount: number;
};

export function classifyAccountKind(excludeFromAssessment: boolean): AiEvalAccountKind {
  return excludeFromAssessment ? "verification_account" : "real_student";
}

/**
 * 同一学生は1件。優先順位は呼び出し側で並べ替え済みであること
 * （VIEW と同じ: approved late → on_time、submission_number desc）。
 */
export function selectProductionAiEvaluationTargets(input: {
  milestoneId: string;
  candidates: AiEvalCandidateInput[];
}): {
  targets: AiEvalSelectedTarget[];
  exclusions: AiEvalExclusionTally;
} {
  const exclusions: AiEvalExclusionTally = {};
  const bump = (reason: AiEvalExclusionReason) => {
    exclusions[reason] = (exclusions[reason] ?? 0) + 1;
  };

  const seenStudent = new Set<string>();
  const targets: AiEvalSelectedTarget[] = [];

  for (const c of input.candidates) {
    if (c.milestoneId !== input.milestoneId) {
      bump("wrong_milestone");
      continue;
    }
    if (!c.isActiveStudent) {
      bump("inactive_or_non_student");
      continue;
    }
    if (c.excludeFromAssessment) {
      bump("verification_account");
      continue;
    }
    if (!c.isEvaluable) {
      bump("not_evaluable_submission");
      continue;
    }
    if (!c.hasEvaluableSnapshot) {
      bump("missing_snapshot");
      continue;
    }
    if (seenStudent.has(c.studentUserId)) {
      bump("duplicate_student_superseded");
      continue;
    }
    seenStudent.add(c.studentUserId);
    targets.push({
      submissionId: c.submissionId,
      studentUserId: c.studentUserId,
      milestoneId: c.milestoneId,
      submittedAt: c.submittedAt,
      selectionReason: "eligible_real_student_submission",
    });
  }

  return { targets, exclusions };
}

export function computeAiEvalCohortCounts(input: {
  students: Array<{
    userId: string;
    excludeFromAssessment: boolean;
    isActiveStudent: boolean;
  }>;
  /** 実学生のうち、対象 milestone で評価可能な提出を持つ userId */
  submittedRealStudentIds: Iterable<string>;
  aiTargetCount: number;
}): AiEvalCohortCounts {
  const real = input.students.filter(
    (s) => s.isActiveStudent && !s.excludeFromAssessment,
  );
  const verification = input.students.filter(
    (s) => s.isActiveStudent && s.excludeFromAssessment,
  );
  const submitted = new Set(input.submittedRealStudentIds);
  let submittedReal = 0;
  for (const s of real) {
    if (submitted.has(s.userId)) submittedReal += 1;
  }
  return {
    realStudentCount: real.length,
    submittedRealStudentCount: submittedReal,
    unsubmittedRealStudentCount: Math.max(0, real.length - submittedReal),
    verificationStudentCount: verification.length,
    aiEvaluationTargetCount: input.aiTargetCount,
  };
}

/** 成功 + 最終失敗 = 対象総数（再試行・重複拒否は別カウント） */
export function assertAiEvalOutcomeTotals(input: {
  targetCount: number;
  successCount: number;
  finalFailureCount: number;
}): { ok: true } | { ok: false; message: string } {
  const sum = input.successCount + input.finalFailureCount;
  if (sum !== input.targetCount) {
    return {
      ok: false,
      message: `成功(${input.successCount})+最終失敗(${input.finalFailureCount})=${sum} が対象(${input.targetCount})と一致しません。`,
    };
  }
  return { ok: true };
}
