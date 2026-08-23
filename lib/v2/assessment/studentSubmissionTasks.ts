import type {
  AssessmentSubmissionListItem,
  StudentSubmissionTask,
  StudentSubmissionTaskBucket,
} from "./types";
import type { AssessmentMilestoneRow } from "./types";

export function classifyStudentSubmissionBucket(input: {
  status: AssessmentMilestoneRow["status"];
  opensAt: string | null;
  deadlineAt: string;
  serverNow: string;
  hasSubmission: boolean;
}): StudentSubmissionTaskBucket {
  const now = new Date(input.serverNow).getTime();
  const opens = input.opensAt ? new Date(input.opensAt).getTime() : null;
  const deadline = new Date(input.deadlineAt).getTime();

  if (input.status === "archived") return "archived";
  if (input.status === "closed") return "closed";
  if (input.status === "draft") return "closed"; // should be filtered earlier

  // open
  if (opens !== null && now < opens) return "not_yet_open";
  if (!input.hasSubmission) {
    // 未提出: 期限前後どちらも open_unsubmitted（表示順で期限後セクションに振り分け）
    if (now >= deadline) return "open_late";
    return "open_unsubmitted";
  }
  // 提出済み
  if (now >= deadline) return "open_late";
  return "open_submitted";
}

/** 表示セクション順 */
export const STUDENT_TASK_BUCKET_ORDER: StudentSubmissionTaskBucket[] = [
  "open_unsubmitted",
  "open_submitted",
  "open_late",
  "not_yet_open",
  "closed",
  "archived",
];

export function studentTaskSectionTitle(
  bucket: StudentSubmissionTaskBucket,
): string {
  switch (bucket) {
    case "open_unsubmitted":
      return "受付中・未提出";
    case "open_submitted":
      return "受付中・提出済み";
    case "open_late":
      return "期限後・受付中";
    case "not_yet_open":
      return "受付開始前";
    case "closed":
      return "受付終了";
    case "archived":
      return "過去の提出課題";
  }
}

export function canSubmitStudentTask(bucket: StudentSubmissionTaskBucket): boolean {
  return (
    bucket === "open_unsubmitted" ||
    bucket === "open_submitted" ||
    bucket === "open_late"
  );
}

export function buildStudentSubmissionTasks(input: {
  milestones: Array<{
    milestone: AssessmentMilestoneRow;
    cycleTitle: string;
    caseId: string;
  }>;
  submissions: AssessmentSubmissionListItem[];
  serverNow: string;
}): { tasks: StudentSubmissionTask[]; pendingBadgeCount: number } {
  const byMilestone = new Map<string, AssessmentSubmissionListItem[]>();
  for (const s of input.submissions) {
    const list = byMilestone.get(s.assessmentMilestoneId) ?? [];
    list.push(s);
    byMilestone.set(s.assessmentMilestoneId, list);
  }

  const tasks: StudentSubmissionTask[] = input.milestones.map(
    ({ milestone, cycleTitle, caseId }) => {
      const list = (byMilestone.get(milestone.id) ?? []).slice().sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
      );
      const latest = list[0] ?? null;
      const bucket = classifyStudentSubmissionBucket({
        status: milestone.status,
        opensAt: milestone.opensAt,
        deadlineAt: milestone.deadlineAt,
        serverNow: input.serverNow,
        hasSubmission: list.length > 0,
      });
      // open_late は未提出・提出済みの両方を含む。未提出はバッジ対象。
      return {
        milestoneId: milestone.id,
        cycleId: milestone.assessmentCycleId,
        cycleTitle,
        caseId,
        title: milestone.title,
        description: milestone.description,
        milestoneType: milestone.milestoneType,
        evaluationType: milestone.evaluationType,
        submissionScope: milestone.submissionScope,
        opensAt: milestone.opensAt,
        deadlineAt: milestone.deadlineAt,
        status: milestone.status,
        sequenceNumber: milestone.sequenceNumber,
        serverNow: input.serverNow,
        bucket,
        canSubmit: canSubmitStudentTask(bucket),
        latestSubmission: latest,
        submissionCount: list.length,
        submissions: list,
      };
    },
  );

  // 並び: セクション順 → sequence
  tasks.sort((a, b) => {
    const ai = STUDENT_TASK_BUCKET_ORDER.indexOf(a.bucket);
    const bi = STUDENT_TASK_BUCKET_ORDER.indexOf(b.bucket);
    if (ai !== bi) return ai - bi;
    return a.sequenceNumber - b.sequenceNumber;
  });

  const pendingBadgeCount = tasks.filter((t) => {
    if (t.status !== "open") return false;
    const opensOk =
      !t.opensAt || new Date(t.serverNow).getTime() >= new Date(t.opensAt).getTime();
    if (!opensOk) return false;
    return t.submissionCount === 0;
  }).length;

  return { tasks, pendingBadgeCount };
}
