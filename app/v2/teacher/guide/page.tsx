import { requireRole } from "@/lib/v2/auth/currentUser";
import ManualViewer from "@/components/v2/manual/ManualViewer";
import { chaptersForAudience } from "@/lib/v2/manual/catalog";

export const dynamic = "force-dynamic";

export default async function TeacherGuidePage() {
  await requireRole("teacher", "admin");
  return (
    <ManualViewer
      audience="teacher"
      chapters={chaptersForAudience("teacher")}
      backHref="/v2/teacher"
      backLabel="← 教員ホーム"
    />
  );
}
