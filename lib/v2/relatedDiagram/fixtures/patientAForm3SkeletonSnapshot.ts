/**
 * DEV ONLY — READ ONLY SNAPSHOT — DO NOT WRITE BACK
 *
 * Patient A Form3 payload captured for Related Diagram skeleton visualization.
 * Source: login_id 99999991 × case_id SP-001, schemaVersion 2, DB version 34,
 * saved 2026-09-20. Not a production semantic graph. Never persist to
 * form3_records or related_diagram_records.
 */

import type { Form3Judgment, Form3PatternKey } from "@/lib/form3/form3Types";
import type {
  Form3AssessmentCardStatus,
  Form3InformationCardStatus,
  Form3InformationSourceType,
  Form3SoType,
} from "@/lib/form3/v2/form3V2Types";
import raw from "./patientAForm3Skeleton.dev.snapshot.json";

export const PATIENT_A_FORM3_SKELETON_SNAPSHOT_KIND =
  "patient_a_form3_skeleton_dev_only" as const;

export type PatientAForm3SkeletonInformation = {
  id: string;
  content: string;
  soType: Form3SoType | null;
  sourceType: Form3InformationSourceType;
  patternKeys: Form3PatternKey[];
  order: number;
  status: Form3InformationCardStatus;
  createdAt: string;
  updatedAt: string;
};

export type PatientAForm3SkeletonAssessment = {
  id: string;
  interpretation: string;
  classification: Form3Judgment | null;
  evidenceInformationIds: string[];
  needMoreInformation: string;
  patternKey: Form3PatternKey | null;
  order: number;
  status: Form3AssessmentCardStatus;
  createdAt: string;
  updatedAt: string;
};

export type PatientAForm3SkeletonSnapshot = {
  _devOnly: true;
  _readOnlySnapshot: true;
  _doNotWriteBack: true;
  source: {
    loginId: string;
    caseId: string;
    schemaVersion: number;
    dbVersion: number;
    updatedAt: string;
    capturedAt: string;
  };
  schemaVersion: number;
  patientId: string;
  updatedAt: string;
  informationCards: PatientAForm3SkeletonInformation[];
  assessmentCards: PatientAForm3SkeletonAssessment[];
};

export const PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT =
  raw as PatientAForm3SkeletonSnapshot;

export function clonePatientAForm3SkeletonSnapshot(
  snapshot: PatientAForm3SkeletonSnapshot = PATIENT_A_FORM3_SKELETON_DEV_SNAPSHOT,
): PatientAForm3SkeletonSnapshot {
  return structuredClone(snapshot);
}
