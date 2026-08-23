// Compass Version 2.2 Sprint 2 — 課題提出の型定義

export type AssessmentTimingStatus = "on_time" | "late";
export type AssessmentLateReviewStatus = "pending" | "approved" | "rejected";

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

export type AssessmentSubmitPreview = {
  assessmentCycleId: string;
  title: string;
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
};

export type AssessmentSubmitErrorKind =
  | "unauthorized"
  | "validation"
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

export type AssessmentSubmissionListResult =
  | {
      ok: true;
      items: AssessmentSubmissionListItem[];
      evaluationCandidateId: string | null;
      deadlineAt: string | null;
      cycleTitle: string | null;
    }
  | { ok: false; kind: AssessmentSubmitErrorKind; message: string };
