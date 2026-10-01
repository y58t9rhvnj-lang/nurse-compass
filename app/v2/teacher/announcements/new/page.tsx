import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import TeacherAnnouncementEditor from "@/components/v2/announcements/TeacherAnnouncementEditor";

export const dynamic = "force-dynamic";

export default async function NewTeacherAnnouncementPage() {
  await requireRole("teacher", "admin");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <Link
          href="/v2/teacher/announcements"
          className="text-sm text-slate-500 hover:underline"
        >
          ← お知らせ一覧
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">下書きを作成</h1>
      </header>
      <TeacherAnnouncementEditor initial={null} />
    </main>
  );
}
