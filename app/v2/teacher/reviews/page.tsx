import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  listActiveStudentsInOrg,
  listTeacherReviewMilestones,
} from "@/lib/v2/assessment/teacherReviewRepository";
import TeacherReviewMilestonesClient from "@/components/v2/assessment/TeacherReviewMilestonesClient";

export const dynamic = "force-dynamic";

export default async function TeacherReviewsPage() {
  const profile = await requireRole("teacher", "admin");
  const supabase = await createServerSupabaseClient();
  const [listed, students] = await Promise.all([
    listTeacherReviewMilestones(supabase, profile.organizationId),
    listActiveStudentsInOrg(supabase, profile.organizationId),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <Link
          href="/v2/teacher"
          className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:underline"
        >
          ← 教員ホーム
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">提出・評価</h1>
        <p className="mt-1 text-sm text-slate-600">
          課題ごとの提出状況を確認し、評価対象の提出物を開きます。
        </p>
      </header>
      {listed.error || students.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          課題一覧を読み込めませんでした。
        </p>
      ) : (
        <TeacherReviewMilestonesClient
          milestones={listed.rows}
          activeStudentTotal={students.rows.length}
        />
      )}
    </main>
  );
}
