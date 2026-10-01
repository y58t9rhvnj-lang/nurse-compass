import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import TeacherAnnouncementDetailClient from "@/components/v2/announcements/TeacherAnnouncementDetailClient";

export const dynamic = "force-dynamic";

export default async function TeacherAnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("teacher", "admin");
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <Link
          href="/v2/teacher/announcements"
          className="text-sm text-slate-500 hover:underline"
        >
          ← お知らせ一覧
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">お知らせの管理</h1>
      </header>
      <TeacherAnnouncementDetailClient id={id} />
    </main>
  );
}
