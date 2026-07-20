import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { getForm2 } from "@/lib/v2/notebook/form2Repository";
import { rowToForm2Snapshot } from "@/lib/v2/notebook/form2Mapper";
import { listActiveCards } from "@/lib/v2/notebook/informationCardsRepository";
import { rowToInformationCard } from "@/lib/v2/notebook/informationCardMapper";
import { listActiveNotes } from "@/lib/v2/notebook/studentNotesRepository";
import { rowToStudentNoteRecord } from "@/lib/v2/notebook/studentNoteMapper";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { StudentNoteRecord } from "@/lib/v2/notebook/studentNoteMapper";
import type { InformationCard } from "@/lib/information/informationCard";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

// 学生の正式導線（V2）。認証必須（未認証は proxy が /v2/login へ誘導）。
// 共通 AppShell を mode="v2" で描画し、V1 と同じサイドバー・電子カルテ・会話を
// 認証済み学生向けに再利用する。受け持ちは患者A（教育ケース SP-001）固定。
// 様式2 は Supabase 接続版（初期データは Repository を Server Component から直接取得）。
const FIXED_PATIENT_ID = "A";

export default async function StudentHomePage() {
  const profile = await requireRole("student");

  // 様式2 の初期スナップショットを取得する。
  //   ・case_id はクライアント申告を信用せず、サーバ側の固定表から解決する。
  //   ・取得は Repository を直接使用（保存のみ Server Action）。RLS により本人の1件のみ。
  // 思考ワークスペース左ペインの初期 Evidence も同じ Repository から取得する
  //   （様式2 と同一 case_id・同一 Supabase データ。新規テーブル・別 repository は作らない）。
  const caseId = caseIdForPatient(FIXED_PATIENT_ID);
  let initialForm2: Form2Snapshot | null = null;
  let initialEvidence: InformationCard[] = [];
  // Compassメモ（student_notes）の初期データ。受け持ち患者の有効メモのみ（.is('deleted_at', null)）。
  // patient / case scope はサーバ側で保証（profile.id ＋ サーバ解決の case_id、加えて RLS）。
  // 取得失敗・DB未設定・未認証時は空配列で継続（initialForm2 / initialEvidence と同じ扱い）。
  let initialNotes: StudentNoteRecord[] = [];
  if (caseId) {
    const supabase = await createServerSupabaseClient();
    const { row } = await getForm2(supabase, profile.id, caseId);
    if (row) initialForm2 = rowToForm2Snapshot(row, FIXED_PATIENT_ID);

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
      initialEvidence={initialEvidence}
      initialNotes={initialNotes}
    />
  );
}
