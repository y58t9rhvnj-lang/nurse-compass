import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { getTeacherStudentSubmissionDetailAction } from "@/app/v2/actions/assessmentReviews";
import TeacherReviewStudentDetailClient from "@/components/v2/assessment/TeacherReviewStudentDetailClient";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ milestoneId: string; studentId: string }>;
};

export default async function TeacherReviewStudentPage({ params }: Props) {
  const { milestoneId, studentId } = await params;
  await requireRole("teacher", "admin");

  const detail = await getTeacherStudentSubmissionDetailAction({
    milestoneId,
    studentId,
  });

  if (!detail.ok) {
    if (detail.kind === "not_found") notFound();
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-rose-800">提出情報を読み込めませんでした。</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Suspense
        fallback={
          <p className="text-sm text-slate-500">読み込み中…</p>
        }
      >
        <TeacherReviewStudentDetailClient
          milestoneId={milestoneId}
          studentId={studentId}
          initial={{
            milestone: detail.milestone,
            student: detail.student,
            history: detail.history,
            candidateSubmissionId: detail.candidateSubmissionId,
            viewingSubmissionId: detail.viewingSubmissionId,
            isViewingCandidate: detail.isViewingCandidate,
            readModel: detail.readModel,
          }}
        />
      </Suspense>
    </main>
  );
}
