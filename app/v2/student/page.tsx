import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { getForm2 } from "@/lib/v2/notebook/form2Repository";
import { rowToForm2Snapshot } from "@/lib/v2/notebook/form2Mapper";
import { getForm3 } from "@/lib/v2/notebook/form3Repository";
import { rowToForm3Snapshot } from "@/lib/v2/notebook/form3Mapper";
import { getPatientUnderstanding } from "@/lib/v2/notebook/patientUnderstandingRepository";
import { rowToPatientUnderstanding } from "@/lib/v2/notebook/patientUnderstandingMapper";
import { listActiveCards } from "@/lib/v2/notebook/informationCardsRepository";
import { rowToInformationCard } from "@/lib/v2/notebook/informationCardMapper";
import { listActiveNotes } from "@/lib/v2/notebook/studentNotesRepository";
import { rowToStudentNoteRecord } from "@/lib/v2/notebook/studentNoteMapper";
import type { Form2Snapshot, Form3Snapshot } from "@/lib/v2/notebook/types";
import type { StudentNoteRecord } from "@/lib/v2/notebook/studentNoteMapper";
import type { InformationCard } from "@/lib/information/informationCard";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

// 学生の正式導線（V2）。認証必須（未認証は proxy が /v2/login へ誘導）。
// Day5: 様式3 Snapshot と「私が捉えた患者さん」を SSR で注入（参照専用手がかり用）。
const FIXED_PATIENT_ID = "A";

export default async function StudentHomePage() {
  const profile = await requireRole("student");

  const caseId = caseIdForPatient(FIXED_PATIENT_ID);
  let initialForm2: Form2Snapshot | null = null;
  let initialForm3: Form3Snapshot | null = null;
  let initialPatientOverviewText = "";
  let initialEvidence: InformationCard[] = [];
  let initialNotes: StudentNoteRecord[] = [];
  if (caseId) {
    const supabase = await createServerSupabaseClient();
    const { row } = await getForm2(supabase, profile.id, caseId);
    if (row) initialForm2 = rowToForm2Snapshot(row, FIXED_PATIENT_ID);

    const { row: form3Row } = await getForm3(supabase, profile.id, caseId);
    if (form3Row) {
      initialForm3 = rowToForm3Snapshot(form3Row, FIXED_PATIENT_ID);
    }

    const { row: understandingRow } = await getPatientUnderstanding(
      supabase,
      profile.id,
      caseId,
    );
    if (understandingRow) {
      initialPatientOverviewText =
        rowToPatientUnderstanding(understandingRow).overviewText;
    }

    const { rows } = await listActiveCards(supabase, profile.id, caseId);
    initialEvidence = rows.map((r) => rowToInformationCard(r, FIXED_PATIENT_ID));

    const { rows: noteRows } = await listActiveNotes(supabase, profile.id, caseId);
    initialNotes = noteRows.map(rowToStudentNoteRecord);
  }

  return (
    <AppShell
      mode="v2"
      userId={profile.id}
      identity={{
        name: profile.displayName,
        subtitle: profile.studentNumber
          ? `学籍番号 ${profile.studentNumber}`
          : `学生 · ${profile.loginId}`,
      }}
      fixedPatientId={FIXED_PATIENT_ID}
      inspectorEnabled
      initialForm2={initialForm2}
      initialForm3={initialForm3}
      initialPatientOverviewText={initialPatientOverviewText}
      initialEvidence={initialEvidence}
      initialNotes={initialNotes}
    />
  );
}
