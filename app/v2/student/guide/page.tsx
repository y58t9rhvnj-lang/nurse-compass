import { requireRole } from "@/lib/v2/auth/currentUser";
import ManualViewer from "@/components/v2/manual/ManualViewer";
import { chaptersForAudience } from "@/lib/v2/manual/catalog";

export const dynamic = "force-dynamic";

export default async function StudentGuidePage() {
  await requireRole("student");
  return (
    <ManualViewer
      audience="student"
      chapters={chaptersForAudience("student")}
      backHref="/v2/student"
      backLabel="← 病棟ホーム"
    />
  );
}
