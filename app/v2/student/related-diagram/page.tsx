import { requireRole } from "@/lib/v2/auth/currentUser";
import RelatedDiagramStudentEditor from "@/components/v2/relatedDiagram/RelatedDiagramStudentEditor";

/**
 * Production Student Editor.
 * Same auth as /v2/student: /v2 proxy → requireRole("student") →
 * getCurrentProfile() → user-scoped Supabase / RLS.
 * Reuses the proven Student Editor. Persistence contract is unchanged:
 * empty record → Initial Knowledge V1 seed; existing record → restore.
 */
export const dynamic = "force-dynamic";

export default async function StudentRelatedDiagramPage() {
  await requireRole("student");
  return <RelatedDiagramStudentEditor />;
}
