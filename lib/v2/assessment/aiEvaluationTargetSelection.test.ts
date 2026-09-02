import assert from "node:assert/strict";
import {
  assertAiEvalOutcomeTotals,
  computeAiEvalCohortCounts,
  selectProductionAiEvaluationTargets,
  type AiEvalCandidateInput,
} from "./aiEvaluationTargetSelection";
import {
  assertEvaluationRequestInTargetList,
  assertTargetListIntegrity,
  buildAiEvalFixedTargetList,
  parseAiEvalFixedTargetList,
} from "./aiEvaluationTargetList";

function cand(
  partial: Partial<AiEvalCandidateInput> &
    Pick<AiEvalCandidateInput, "submissionId" | "studentUserId">,
): AiEvalCandidateInput {
  return {
    milestoneId: "ms-1",
    submittedAt: "2026-08-26T00:00:00.000Z",
    excludeFromAssessment: false,
    isActiveStudent: true,
    isEvaluable: true,
    hasEvaluableSnapshot: true,
    ...partial,
  };
}

// 実学生68・未提出1 → AI候補67
{
  const students = Array.from({ length: 68 }, (_, i) => ({
    userId: `real-${i}`,
    excludeFromAssessment: false,
    isActiveStudent: true,
  }));
  const verification = Array.from({ length: 6 }, (_, i) => ({
    userId: `verify-${i}`,
    excludeFromAssessment: true,
    isActiveStudent: true,
  }));
  const submittedReal = students.slice(0, 67).map((s) => s.userId);
  const candidates: AiEvalCandidateInput[] = [
    ...submittedReal.map((id, i) =>
      cand({ submissionId: `sub-r-${i}`, studentUserId: id }),
    ),
    cand({
      submissionId: "sub-v-0",
      studentUserId: "verify-0",
      excludeFromAssessment: true,
    }),
  ];
  const { targets, exclusions } = selectProductionAiEvaluationTargets({
    milestoneId: "ms-1",
    candidates,
  });
  assert.equal(targets.length, 67);
  assert.equal(exclusions.verification_account, 1);
  const counts = computeAiEvalCohortCounts({
    students: [...students, ...verification],
    submittedRealStudentIds: submittedReal,
    aiTargetCount: targets.length,
  });
  assert.equal(counts.realStudentCount, 68);
  assert.equal(counts.submittedRealStudentCount, 67);
  assert.equal(counts.unsubmittedRealStudentCount, 1);
  assert.equal(counts.verificationStudentCount, 6);
  assert.equal(counts.aiEvaluationTargetCount, 67);
  // 未提出は candidate 入力に無い → AI候補に含まれない
  assert.ok(!targets.some((t) => t.studentUserId === "real-67"));
}

// 検証用は本番候補から除外、受入テスト用フラグはログイン可否を変えない（属性のみ）
{
  const { targets, exclusions } = selectProductionAiEvaluationTargets({
    milestoneId: "ms-1",
    candidates: [
      cand({ submissionId: "s1", studentUserId: "u1" }),
      cand({
        submissionId: "s2",
        studentUserId: "u2",
        excludeFromAssessment: true,
      }),
    ],
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].studentUserId, "u1");
  assert.equal(exclusions.verification_account, 1);
  // 検証用アカウントは exclude フラグがあっても isActiveStudent のまま利用可能、という契約
  assert.equal(
    cand({
      submissionId: "s2",
      studentUserId: "u2",
      excludeFromAssessment: true,
      isActiveStudent: true,
    }).isActiveStudent,
    true,
  );
}

// 同一学生の複数提出から1件だけ
{
  const { targets, exclusions } = selectProductionAiEvaluationTargets({
    milestoneId: "ms-1",
    candidates: [
      cand({
        submissionId: "newer",
        studentUserId: "u1",
        submittedAt: "2026-08-27T00:00:00.000Z",
      }),
      cand({
        submissionId: "older",
        studentUserId: "u1",
        submittedAt: "2026-08-20T00:00:00.000Z",
      }),
    ],
  });
  assert.equal(targets.length, 1);
  assert.equal(targets[0].submissionId, "newer");
  assert.equal(exclusions.duplicate_student_superseded, 1);
}

// 対象 milestone 以外除外
{
  const { targets, exclusions } = selectProductionAiEvaluationTargets({
    milestoneId: "ms-1",
    candidates: [
      cand({ submissionId: "ok", studentUserId: "u1", milestoneId: "ms-1" }),
      cand({ submissionId: "ng", studentUserId: "u2", milestoneId: "ms-other" }),
    ],
  });
  assert.equal(targets.length, 1);
  assert.equal(exclusions.wrong_milestone, 1);
}

// Export 件数 = 固定対象リスト件数、Import はリスト外拒否、欠落・重複なし
{
  const selected = Array.from({ length: 67 }, (_, i) => ({
    submissionId: `sub-${i}`,
    studentUserId: `stu-${i}`,
    milestoneId: "ms-1",
    submittedAt: "2026-08-26T00:00:00.000Z",
    selectionReason: "eligible_real_student_submission" as const,
  }));
  const evalMap = new Map(
    selected.map((s, i) => [s.submissionId, `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`]),
  );
  const list = buildAiEvalFixedTargetList({
    milestoneId: "ms-1",
    generatedAt: "2026-08-29T00:00:00.000Z",
    idSecret: "test-secret",
    organizationId: "org-1",
    selected,
    evaluationRequestIdsBySubmissionId: evalMap,
    exclusions: { verification_account: 1, unsubmitted: 1 },
  });
  assert.equal(list.target_count, 67);
  assert.equal(list.targets.length, 67);
  const integrity = assertTargetListIntegrity(list);
  assert.equal(integrity.ok, true);
  assert.equal(integrity.duplicateEvaluationRequestIds.length, 0);
  assert.equal(integrity.duplicateSubmissionIds.length, 0);

  const exportCount = 67;
  assert.equal(exportCount, list.target_count);

  const parsed = parseAiEvalFixedTargetList(list);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("parse failed");
  const inside = assertEvaluationRequestInTargetList(
    parsed.list,
    list.targets[0].evaluation_request_id,
  );
  assert.equal(inside.ok, true);
  const outside = assertEvaluationRequestInTargetList(
    parsed.list,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(outside.ok, false);

  // candidate / Export / 評価 / Import 予定件数の一致
  const pipeline = {
    candidate: 67,
    fixedList: list.target_count,
    export: exportCount,
    llmInput: exportCount,
    validation: exportCount,
    importPlanned: list.target_count,
  };
  assert.ok(
    new Set(Object.values(pipeline)).size === 1,
    "pipeline counts must match",
  );

  const outcome = assertAiEvalOutcomeTotals({
    targetCount: 67,
    successCount: 60,
    finalFailureCount: 7,
  });
  assert.equal(outcome.ok, true);
  const badOutcome = assertAiEvalOutcomeTotals({
    targetCount: 67,
    successCount: 60,
    finalFailureCount: 6,
  });
  assert.equal(badOutcome.ok, false);
}

console.log("aiEvaluationTargetSelection.test.ts: all assertions passed");
