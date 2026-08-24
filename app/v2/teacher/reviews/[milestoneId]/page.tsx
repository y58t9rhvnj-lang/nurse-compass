import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  getTeacherMilestoneSubmissionSummary,
  listTeacherStudentSubmissionRows,
} from "@/lib/v2/assessment/teacherReviewRepository";
import TeacherReviewStudentsClient from "@/components/v2/assessment/TeacherReviewStudentsClient";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  evaluationTypeLabel,
  formatSubmissionScopeJa,
  statusLabel,
} from "@/lib/v2/assessment/submissionScope";
import { caseDisplayLabel } from "@/lib/v2/assessment/teacherReviewLabels";

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
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <Link
          href="/v2/teacher/reviews"
          className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:underline"
        >
          ← 課題一覧
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{m.title}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {m.cycleTitle} ・ {caseDisplayLabel(m.caseId)} ・{" "}
          {formatSubmissionScopeJa(m.milestoneType, m.submissionScope)} ・{" "}
          {evaluationTypeLabel(m.evaluationType)} ・ {statusLabel(m.status)}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          提出期限：{formatAssessmentDateTimeJa(m.deadlineAt)} ・ 提出{" "}
          {m.submittedStudentCount}名・未提出 {m.unsubmittedStudentCount}名・
          評価対象 {m.candidateStudentCount}名
        </p>
      </header>
      {listed.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          学生一覧を読み込めませんでした。
        </p>
      ) : (
        <TeacherReviewStudentsClient milestone={m} rows={listed.rows} />
      )}
    </main>
  );
}
