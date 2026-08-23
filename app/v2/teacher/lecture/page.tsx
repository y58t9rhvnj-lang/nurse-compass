import { requireRole } from "@/lib/v2/auth/currentUser";
import LectureDemoShell from "@/components/v2/lecture/LectureDemoShell";

export const dynamic = "force-dynamic";

/**
 * Version 2.2 Sprint 1 — 講義用学生画面。
 * teacher / admin のみ（layout の requireRole と二重ガード）。
 * /v2/student の権限制御は変更しない。実在学生への impersonation なし。
 */
export default async function TeacherLecturePage() {
  await requireRole("teacher", "admin");
  return <LectureDemoShell />;
}
