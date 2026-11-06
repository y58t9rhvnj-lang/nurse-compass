/**
 * 学生提出画面の最小修正回帰（本番 0137950 起点）。
 * related_diagram / 未知種別で workspaceTarget.label が落ちないこと、
 * 未対応課題を提出・バッジ対象から外すこと、取得失敗を空データと混ぜないこと。
 *
 * Run: npx tsx lib/v2/assessment/studentSubmissionDisplay.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatSubmissionScopeJa,
  milestoneTypeLabel,
  defaultScopeForType,
} from "./submissionScope";
import {
  isEmptySubmissionsCopy,
  isSupportedStudentSubmissionType,
  studentSubmissionWorkspaceTarget,
  studentTaskLoadErrorMessage,
} from "./studentSubmissionDisplay";
import { buildStudentSubmissionTasks } from "./studentSubmissionTasks";
import type { AssessmentMilestoneRow } from "./types";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`ok - ${name}`);
  } catch (e) {
    console.error(`FAIL - ${name}`);
    throw e;
  }
}

function src(rel: string): string {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

function milestone(
  type: string,
  overrides: Partial<AssessmentMilestoneRow> = {},
): AssessmentMilestoneRow {
  return {
    id: "m1",
    assessmentCycleId: "c1",
    organizationId: "o1",
    title: "課題",
    description: null,
    milestoneType: type as AssessmentMilestoneRow["milestoneType"],
    sequenceNumber: 1,
    opensAt: null,
    deadlineAt: "2026-12-01T00:00:00.000Z",
    closesAt: null,
    submissionScope: defaultScopeForType("form2"),
    evaluationType: "formative",
    status: "open",
    createdBy: "t1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("本番 HEAD 相当の switch は related_diagram で label 参照が落ちる", () => {
  function headWorkspaceTarget(type: string): { label: string } | undefined {
    switch (type) {
      case "form2":
        return { label: "様式2を確認する" };
      case "form3_progress":
      case "form3_complete":
        return { label: "様式3を確認する" };
      case "final":
      case "custom":
        return { label: "様式2を確認する" };
    }
  }
  assert.throws(() => {
    const target = headWorkspaceTarget("related_diagram");
    void target!.label;
  }, TypeError);
});

test("related_diagram は一覧用に label を持ち、確認先は使えない", () => {
  const target = studentSubmissionWorkspaceTarget("related_diagram");
  assert.equal(typeof target.label, "string");
  assert.ok(target.label.length > 0);
  assert.equal(target.available, false);
  assert.equal(target.view, null);
  assert.equal(target.label, "準備中");
  assert.equal(isSupportedStudentSubmissionType("related_diagram"), false);
});

test("未知 milestone_type でも undefined.label にならず提出不可", () => {
  for (const type of [undefined, null, "", "unknown_future_type"]) {
    const target = studentSubmissionWorkspaceTarget(type);
    assert.equal(target.available, false);
    assert.equal(target.view, null);
    assert.equal(target.label, "準備中");
  }
});

test("既知種別の確認先と提出可否は維持する", () => {
  assert.equal(studentSubmissionWorkspaceTarget("form2").available, true);
  assert.equal(
    studentSubmissionWorkspaceTarget("form2").label,
    "様式2を確認する",
  );
  assert.equal(studentSubmissionWorkspaceTarget("form3_complete").view, "form3");
  assert.equal(isSupportedStudentSubmissionType("form2"), true);
  assert.equal(isSupportedStudentSubmissionType("form3_progress"), true);
  assert.equal(isSupportedStudentSubmissionType("custom"), true);
});

test("related_diagram 課題は一覧に出るが canSubmit もバッジも対象外", () => {
  const { tasks, pendingBadgeCount } = buildStudentSubmissionTasks({
    milestones: [
      { milestone: milestone("related_diagram"), cycleTitle: "C", caseId: "SP-001" },
      { milestone: milestone("form2", { id: "m2", sequenceNumber: 2 }), cycleTitle: "C", caseId: "SP-001" },
    ],
    submissions: [],
    serverNow: "2026-06-01T00:00:00.000Z",
  });
  const rd = tasks.find((t) => String(t.milestoneType) === "related_diagram");
  const form2 = tasks.find((t) => t.milestoneType === "form2");
  assert.ok(rd);
  assert.ok(form2);
  assert.equal(rd?.canSubmit, false);
  assert.equal(form2?.canSubmit, true);
  assert.equal(pendingBadgeCount, 1);
});

test("未知種別も未提出としてバッジに数えない", () => {
  const { tasks, pendingBadgeCount } = buildStudentSubmissionTasks({
    milestones: [
      {
        milestone: milestone("future_type"),
        cycleTitle: "C",
        caseId: "SP-001",
      },
    ],
    submissions: [],
    serverNow: "2026-06-01T00:00:00.000Z",
  });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]?.canSubmit, false);
  assert.equal(pendingBadgeCount, 0);
});

test("関連図・未知種別のラベルは undefined を返さない", () => {
  assert.equal(milestoneTypeLabel("related_diagram"), "関連図");
  assert.equal(milestoneTypeLabel("not-a-type"), "提出課題");
  assert.equal(formatSubmissionScopeJa("related_diagram", null), "準備中");
  assert.equal(formatSubmissionScopeJa("not-a-type", null), "準備中");
  assert.equal(
    formatSubmissionScopeJa("form2", defaultScopeForType("form2")),
    "様式2・患者理解",
  );
});

test("取得失敗メッセージは課題なし・未提出と区別する", () => {
  const unauthorized = studentTaskLoadErrorMessage("unauthorized");
  const dbError = studentTaskLoadErrorMessage("db_error");
  assert.equal(isEmptySubmissionsCopy(unauthorized), false);
  assert.equal(isEmptySubmissionsCopy(dbError), false);
  assert.match(unauthorized, /ログイン/);
  assert.match(dbError, /読み込めませんでした/);
});

test("提出画面は関連図評価 API に依存せず、準備中と再試行がある", () => {
  const workspace = src(
    "../../../components/v2/assessment/StudentSubmissionsWorkspace.tsx",
  );
  const action = src("../../../app/v2/actions/assessmentSubmission.ts");
  assert.equal(workspace.includes("relatedDiagram"), false);
  assert.equal(workspace.includes("/v2/student/related-diagram?milestone="), false);
  assert.equal(workspace.includes("関連図を開いて提出"), false);
  assert.match(workspace, /準備中/);
  assert.match(workspace, /再試行/);
  assert.match(workspace, /現在、表示できる提出課題はありません/);
  assert.equal(action.includes("relatedDiagramSubmission"), false);
  assert.equal(action.includes("listOwnRelatedDiagramSubmissionsForCase"), false);
  assert.match(action, /\[v2-student-tasks\]/);
});

console.log(`\n${passed} passed`);
