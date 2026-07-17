import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { getForm2 } from "@/lib/v2/notebook/form2Repository";
import { rowToForm2Snapshot } from "@/lib/v2/notebook/form2Mapper";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import Form2SupabaseWorkspace from "@/components/v2/form2/Form2SupabaseWorkspace";
import { PATIENTS } from "@/lib/wardData";

export const dynamic = "force-dynamic";

// 受け持ち対象（患者A / 教育ケース SP-001）を固定で扱う。
const PATIENT_ID = "A";

// 精神様式2（V2・Supabase 接続）。
// 初期ロードは Server Action ではなく Repository を Server Component から直接利用する。
// 保存処理のみ Server Action（saveForm2Action）を使う。
export default async function StudentForm2Page() {
  const profile = await requireRole("student");

  const caseId = caseIdForPatient(PATIENT_ID);
  let initial: Form2Snapshot | null = null;
  if (caseId) {
    const supabase = await createServerSupabaseClient();
    const { row } = await getForm2(supabase, profile.id, caseId);
    if (row) initial = rowToForm2Snapshot(row, PATIENT_ID);
  }

  const patientName = PATIENTS[PATIENT_ID]?.name ?? "受け持ち対象";

  return (
    <Form2SupabaseWorkspace
      patientId={PATIENT_ID}
      patientName={patientName}
      userId={profile.id}
      initial={initial}
    />
  );
}
