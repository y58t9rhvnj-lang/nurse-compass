import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import { getForm3 } from "@/lib/v2/notebook/form3Repository";
import {
  STUDENT_RELATED_DIAGRAM_FORM3_PATIENT_ID,
  studentForm3ReadModelFromRecord,
} from "@/lib/v2/relatedDiagram/studentForm3RelatedDiagramBoundary";
import RelatedDiagramStudentEditor from "@/components/v2/relatedDiagram/RelatedDiagramStudentEditor";

/**
 * Production Student Editor.
 * Same auth as /v2/student: /v2 proxy → requireRole("student") →
 * getCurrentProfile() → user-scoped Supabase / RLS.
 * Form3 drawer: getForm3(current user, SP-001) → student read model.
 * Persistence contract is unchanged:
 * empty record → Initial Knowledge V1 seed; existing record → restore.
 */
export const dynamic = "force-dynamic";

export default async function StudentRelatedDiagramPage() {
  const profile = await requireRole("student");
  const caseId = caseIdForPatient(STUDENT_RELATED_DIAGRAM_FORM3_PATIENT_ID);
  let form3Model = studentForm3ReadModelFromRecord({ row: null });
  if (caseId) {
    const supabase = await createServerSupabaseClient();
    const { row, error } = await getForm3(supabase, profile.id, caseId);
    if (!error) {
      form3Model = studentForm3ReadModelFromRecord({ row });
    }
  }
  return <RelatedDiagramStudentEditor form3Model={form3Model} />;
}
