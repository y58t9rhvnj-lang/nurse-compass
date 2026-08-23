import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getForm2 } from "@/lib/v2/notebook/form2Repository";
import { getForm3 } from "@/lib/v2/notebook/form3Repository";
import { listActiveCards } from "@/lib/v2/notebook/informationCardsRepository";
import { listLinksForCase } from "@/lib/v2/notebook/form2EvidenceLinksRepository";
import { listForm2FieldReflections } from "@/lib/v2/notebook/form2FieldReflectionRepository";
import { getPatientUnderstanding } from "@/lib/v2/notebook/patientUnderstandingRepository";
import {
  ASSESSMENT_SNAPSHOT_SCHEMA_VERSION,
  type AssessmentSnapshotSourceVersions,
  type AssessmentSubmissionSnapshot,
} from "./types";

export type BuiltAssessmentSnapshot = {
  snapshot: AssessmentSubmissionSnapshot;
  sourceVersions: AssessmentSnapshotSourceVersions;
  schemaVersion: typeof ASSESSMENT_SNAPSHOT_SCHEMA_VERSION;
};

/**
 * 作業用 head から評価用スナップショットを構築する。
 * studentRef / submittedAt / assessmentCycle は RPC 側で上書き確定する。
 */
export async function buildAssessmentSnapshot(params: {
  supabase: SupabaseClient;
  userId: string;
  caseId: string;
  patientId: string;
}): Promise<
  | { ok: true; data: BuiltAssessmentSnapshot }
  | { ok: false; message: string }
> {
  const { supabase, userId, caseId, patientId } = params;

  const [form2, form3, cards, links, reflections, understanding] =
    await Promise.all([
      getForm2(supabase, userId, caseId),
      getForm3(supabase, userId, caseId),
      listActiveCards(supabase, userId, caseId),
      listLinksForCase(supabase, userId, caseId),
      listForm2FieldReflections(supabase, userId, caseId),
      getPatientUnderstanding(supabase, userId, caseId),
    ]);

  if (form2.error || form3.error || cards.error || links.error || reflections.error || understanding.error) {
    return { ok: false, message: "failed to load submission sources" };
  }

  const sourceVersions: AssessmentSnapshotSourceVersions = {
    form2: form2.row?.version ?? null,
    form3: form3.row?.version ?? null,
    patientUnderstanding: understanding.row?.updated_at ?? null,
  };

  const snapshot: AssessmentSubmissionSnapshot = {
    schemaVersion: ASSESSMENT_SNAPSHOT_SCHEMA_VERSION,
    assessmentCycle: {
      id: "",
      title: "",
      deadlineAt: "",
    },
    studentRef: userId,
    caseId,
    submittedAt: "",
    form2: form2.row?.payload ?? null,
    form3: form3.row?.payload ?? null,
    informationCards: cards.rows ?? [],
    form2EvidenceLinks: links.rows ?? [],
    fieldReflections: reflections.rows ?? [],
    patientUnderstanding: understanding.row
      ? {
          patientId,
          overviewText: understanding.row.overview_text,
          updatedAt: understanding.row.updated_at,
        }
      : { patientId, overviewText: "", updatedAt: null },
    sourceVersions,
  };

  return {
    ok: true,
    data: {
      snapshot,
      sourceVersions,
      schemaVersion: ASSESSMENT_SNAPSHOT_SCHEMA_VERSION,
    },
  };
}
