import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import TeacherAnnouncementListClient from "@/components/v2/announcements/TeacherAnnouncementListClient";

export const dynamic = "force-dynamic";

export default async function TeacherAnnouncementsPage() {
  await requireRole("teacher", "admin");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <Link href="/v2/teacher" className="text-sm text-slate-500 hover:underline">
          ← 教員ホーム
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">お知らせ</h1>
      </header>
      <TeacherAnnouncementListClient />
    </main>
  );
}
