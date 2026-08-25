import { notFound } from "next/navigation";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  getTeacherMilestoneSubmissionSummary,
  listTeacherStudentSubmissionRows,
} from "@/lib/v2/assessment/teacherReviewRepository";
import TeacherReviewStudentsClient from "@/components/v2/assessment/TeacherReviewStudentsClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ milestoneId: string }>;
};

export default async function TeacherReviewMilestonePage({ params }: Props) {
  const { milestoneId } = await params;
  const profile = await requireRole("teacher", "admin");
  const supabase = await createServerSupabaseClient();

  const summary = await getTeacherMilestoneSubmissionSummary(
    supabase,
    profile.organizationId,
    milestoneId,
  );
  if (summary.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-rose-800">課題情報を読み込めませんでした。</p>
      </main>
    );
  }
  if (!summary.row) notFound();

  const listed = await listTeacherStudentSubmissionRows(
    supabase,
    profile.organizationId,
    milestoneId,
  );
  const m = summary.row;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      {listed.error ? (
        <p className="m-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          学生一覧を読み込めませんでした。
        </p>
      ) : (
        <TeacherReviewStudentsClient milestone={m} rows={listed.rows} />
      )}
    </main>
  );
}
