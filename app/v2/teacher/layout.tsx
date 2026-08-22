import { requireRole } from "@/lib/v2/auth/currentUser";

export const dynamic = "force-dynamic";

/**
 * /v2/teacher 配下の教員・管理者ガード。
 * 未認証・学生は requireRole によりログインまたは /v2 へ振り分け。
 */
export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("teacher", "admin");
  return (
    <div className="h-dvh overflow-y-auto overscroll-contain bg-slate-50">
      {children}
    </div>
  );
}
