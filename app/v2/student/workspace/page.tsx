import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { getForm2 } from "@/lib/v2/notebook/form2Repository";
import { rowToForm2Snapshot } from "@/lib/v2/notebook/form2Mapper";
import { listActiveCards } from "@/lib/v2/notebook/informationCardsRepository";
import { rowToInformationCard } from "@/lib/v2/notebook/informationCardMapper";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { InformationCard } from "@/lib/information/informationCard";
import { PATIENTS } from "@/lib/wardData";
import PatientWorkspace from "@/components/v2/workspace/PatientWorkspace";

export const dynamic = "force-dynamic";

// 受け持ち対象（患者A / 教育ケース SP-001）を固定で扱う。
const PATIENT_ID = "A";

// Patient Workspace（V2・Supabase 接続）。
// 初期ロードは Server Action ではなく Repository を Server Component から直接利用する。
// 保存処理のみ Server Action（Evidence: informationCards / Form2: form2）を使う。
export default async function StudentWorkspacePage() {
  const profile = await requireRole("student");

  const patient = PATIENTS[PATIENT_ID];
  const caseId = caseIdForPatient(PATIENT_ID);

  let initialForm2: Form2Snapshot | null = null;
  let initialEvidence: InformationCard[] = [];

  if (patient && caseId) {
    const supabase = await createServerSupabaseClient();

    const { row } = await getForm2(supabase, profile.id, caseId);
    if (row) initialForm2 = rowToForm2Snapshot(row, PATIENT_ID);

    const { rows } = await listActiveCards(supabase, profile.id, caseId);
    initialEvidence = rows.map((r) => rowToInformationCard(r, PATIENT_ID));
  }

  if (!patient) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-[14px] text-[#6E6E73]">
        受け持ち対象が見つかりませんでした。
      </div>
    );
  }

  return (
    <PatientWorkspace
      patient={patient}
      userId={profile.id}
      initialEvidence={initialEvidence}
      initialForm2={initialForm2}
    />
  );
}
