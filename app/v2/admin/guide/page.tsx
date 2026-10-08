import { requireRole } from "@/lib/v2/auth/currentUser";
import ManualViewer from "@/components/v2/manual/ManualViewer";
import { chaptersForAudience } from "@/lib/v2/manual/catalog";

export const dynamic = "force-dynamic";

export default async function AdminGuidePage() {
  await requireRole("admin");
  return (
    <ManualViewer
      audience="admin"
      chapters={chaptersForAudience("admin")}
      backHref="/v2/admin"
      backLabel="← 管理者ホーム"
    />
  );
}
