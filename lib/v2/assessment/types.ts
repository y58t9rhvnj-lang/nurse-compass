// Compass Version 2.2 Sprint 3A — 課題提出・マイルストーン型

import type { Form3PatternKey } from "@/lib/form3/form3Types";

export type AssessmentTimingStatus = "on_time" | "late";
export type AssessmentLateReviewStatus = "pending" | "approved" | "rejected";

export type AssessmentMilestoneType =
  | "form2"
  | "form3_progress"
  | "form3_complete"
  | "final"
  | "custom";

export type AssessmentEvaluationType = "formative" | "summative";

export type AssessmentMilestoneStatus =
  | "draft"
  | "open"
  | "closed"
  | "archived";

export type AssessmentCycleStatus =
  | "draft"
  | "open"
  | "closed"
  | "archived";

export type Form3Scope =
  | { mode: "all_patterns" }
  | { mode: "selected_patterns"; patternIds: Form3PatternKey[] };

export type AssessmentSubmissionScope = {
  includeForm2: boolean;
  includeForm3: boolean;
  form3Scope?: Form3Scope;
  includeInformationCards: boolean;
  includeEvidenceLinks: boolean;
  includeFieldReflections: boolean;
  includePatientUnderstanding: boolean;
};

export const ASSESSMENT_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type AssessmentSnapshotSourceVersions = {
  form2: number | null;
  form3: number | null;
  patientUnderstanding: string | null;
};

export type AssessmentSubmissionSnapshot = {
  schemaVersion: number;
  assessmentCycle: {
    id: string;
    title: string;
    deadlineAt: string;
  };
  assessmentMilestone?: {
    id: string;
    title: string;
    milestoneType: string;
    evaluationType: string;
    deadlineAt: string;
    submissionScope: AssessmentSubmissionScope;
  };
  studentRef: string;
  caseId: string;
  submittedAt: string;
  form2: unknown;
  form3: unknown;
  informationCards: unknown[];
  form2EvidenceLinks: unknown[];
  fieldReflections: unknown[];
  patientUnderstanding: unknown;
  sourceVersions: AssessmentSnapshotSourceVersions;
};

export type OpenAssessmentMilestoneItem = {
  milestoneId: string;
  milestoneTitle: string;
  description: string | null;
  milestoneType: AssessmentMilestoneType;
  evaluationType: AssessmentEvaluationType;
  sequenceNumber: number;
  opensAt: string | null;
  deadlineAt: string;
  submissionScope: AssessmentSubmissionScope;
  status: AssessmentMilestoneStatus;
  cycleId: string;
  cycleTitle: string;
  caseId: string;
  /** DB から再取得した最新提出（未提出なら null） */
  latestSubmission?: AssessmentSubmissionListItem | null;
  submissionCount?: number;
};

export type AssessmentSubmitPreview = {
  assessmentMilestoneId: string;
  assessmentCycleId: string;
  cycleTitle: string;
  milestoneTitle: string;
  milestoneType: AssessmentMilestoneType;
  evaluationType: AssessmentEvaluationType;
  submissionScope: AssessmentSubmissionScope;
  deadlineAt: string;
  serverNow: string;
  wouldBeLate: boolean;
};

export type AssessmentSubmitSuccess = {
  submissionId: string;
  submissionNumber: number;
  submittedAt: string;
  timingStatus: AssessmentTimingStatus;
  lateReviewStatus: AssessmentLateReviewStatus | null;
  assessmentCycleId: string;
  assessmentMilestoneId: string;
  deadlineAt: string;
  idempotent?: boolean;
};

export type AssessmentSubmissionListItem = {
  id: string;
  submissionNumber: number;
  submittedAt: string;
  timingStatus: AssessmentTimingStatus;
  lateReviewStatus: AssessmentLateReviewStatus | null;
  isEvaluationCandidate: boolean;
  assessmentMilestoneId: string;
  milestoneTitle: string | null;
  cycleTitle: string | null;
  evaluationType: AssessmentEvaluationType | null;
};

export type AssessmentSubmitErrorKind =
  | "unauthorized"
  | "validation"
  | "not_found"
  | "not_open"
  | "no_open_cycle"
  | "ambiguous_cycle"
  | "duplicate"
  | "not_configured"
  | "lecture_blocked"
  | "db_error";

export type AssessmentSubmitPreviewResult =
  | { ok: true; data: AssessmentSubmitPreview }
  | { ok: false; kind: AssessmentSubmitErrorKind; message: string };

export type AssessmentSubmitResult =
  | { ok: true; data: AssessmentSubmitSuccess }
  | { ok: false; kind: AssessmentSubmitErrorKind; message: string };

export type AssessmentOpenMilestonesResult =
  | { ok: true; items: OpenAssessmentMilestoneItem[]; serverNow: string }
  | { ok: false; kind: AssessmentSubmitErrorKind; message: string };

/** 学生提出画面の1課題（表示用。開発用語は UI で使わない） */
export type StudentSubmissionTaskBucket =
  | "open_unsubmitted"
  | "open_submitted"
  | "open_late"
  | "not_yet_open"
  | "closed"
  | "archived";

export type StudentSubmissionTask = {
  milestoneId: string;
  cycleId: string;
  cycleTitle: string;
  caseId: string;
  title: string;
  description: string | null;
  milestoneType: AssessmentMilestoneType;
  evaluationType: AssessmentEvaluationType;
  submissionScope: AssessmentSubmissionScope;
  opensAt: string | null;
  deadlineAt: string;
  status: AssessmentMilestoneStatus;
  sequenceNumber: number;
  serverNow: string;
  bucket: StudentSubmissionTaskBucket;
  canSubmit: boolean;
  latestSubmission: AssessmentSubmissionListItem | null;
  submissionCount: number;
  submissions: AssessmentSubmissionListItem[];
};

export type StudentSubmissionTasksResult =
  | {
      ok: true;
      tasks: StudentSubmissionTask[];
      pendingBadgeCount: number;
      serverNow: string;
    }
  | { ok: false; kind: AssessmentSubmitErrorKind; message: string };

export type AssessmentSubmissionListResult =
  | {
      ok: true;
      items: AssessmentSubmissionListItem[];
      evaluationCandidateIds: string[];
    }
  | { ok: false; kind: AssessmentSubmitErrorKind; message: string };

export type AssessmentCycleRow = {
  id: string;
  organizationId: string;
  caseId: string;
  title: string;
  description?: string | null;
  status: AssessmentCycleStatus;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AssessmentMilestoneRow = {
  id: string;
  assessmentCycleId: string;
  organizationId: string;
  title: string;
  description: string | null;
  milestoneType: AssessmentMilestoneType;
  sequenceNumber: number;
  opensAt: string | null;
  deadlineAt: string;
  closesAt: string | null;
  submissionScope: AssessmentSubmissionScope;
  evaluationType: AssessmentEvaluationType;
  status: AssessmentMilestoneStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
};
