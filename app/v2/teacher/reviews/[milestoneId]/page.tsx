import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  logAssessmentDiag,
  supabaseErrFields,
  throwAssessmentDiagError,
} from "@/lib/v2/assessment/assessmentDiagnostics";
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

  logAssessmentDiag({
    op: "teacherReviewMilestonePage.summary",
    phase: "start",
    organizationId: profile.organizationId,
    role: profile.role,
    milestoneId,
  });

  const summary = await getTeacherMilestoneSubmissionSummary(
    supabase,
    profile.organizationId,
    milestoneId,
  );
  if (summary.error) {
    throwAssessmentDiagError({
      op: "teacherReviewMilestonePage.summary",
      organizationId: profile.organizationId,
      role: profile.role,
      milestoneId,
      ...supabaseErrFields(summary.error),
      message: `milestone summary failed (${summary.error.code ?? "no_code"})`,
    });
  }
  if (!summary.row) {
    logAssessmentDiag({
      op: "teacherReviewMilestonePage.summary",
      phase: "fail",
      organizationId: profile.organizationId,
      role: profile.role,
      milestoneId,
      detail: "row_missing",
    });
    notFound();
  }

  logAssessmentDiag({
    op: "teacherReviewMilestonePage.summary",
    phase: "success",
    organizationId: profile.organizationId,
    role: profile.role,
    milestoneId,
  });

  const listed = await listTeacherStudentSubmissionRows(
    supabase,
    profile.organizationId,
    milestoneId,
  );
  if (listed.error) {
    throwAssessmentDiagError({
      op: "teacherReviewMilestonePage.students",
      organizationId: profile.organizationId,
      role: profile.role,
      milestoneId,
      ...supabaseErrFields(listed.error),
      message: `student submission rows failed (${listed.error.code ?? "no_code"})`,
    });
  }

  const m = summary.row;

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-slate-50">
      <Suspense
        fallback={
          <div className="p-4 text-sm text-slate-500">読み込み中…</div>
        }
      >
        <TeacherReviewStudentsClient milestone={m} rows={listed.rows} />
      </Suspense>
    </main>
  );
}
