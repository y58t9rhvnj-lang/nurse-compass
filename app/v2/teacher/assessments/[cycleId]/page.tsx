import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import {
  logAssessmentDiag,
  supabaseErrFields,
  throwAssessmentDiagError,
} from "@/lib/v2/assessment/assessmentDiagnostics";
import { listMilestonesForCycle } from "@/lib/v2/assessment/assessmentRepository";
import TeacherAssessmentMilestonesClient from "@/components/v2/assessment/TeacherAssessmentMilestonesClient";
import type { AssessmentCycleRow } from "@/lib/v2/assessment/types";

export const dynamic = "force-dynamic";

export default async function TeacherAssessmentCycleDetailPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const { cycleId } = await params;
  const profile = await requireRole("teacher", "admin");
  const supabase = await createServerSupabaseClient();

  logAssessmentDiag({
    op: "teacherAssessmentCycleDetail.getCycle",
    phase: "start",
    organizationId: profile.organizationId,
    role: profile.role,
    cycleId,
  });

  const { data: cycle, error } = await supabase
    .from("assessment_cycles")
    .select(
      "id, organization_id, case_id, title, description, status, deadline_at, created_at, updated_at",
    )
    .eq("id", cycleId)
    .maybeSingle();

  if (error) {
    throwAssessmentDiagError({
      op: "teacherAssessmentCycleDetail.getCycle",
      organizationId: profile.organizationId,
      role: profile.role,
      cycleId,
      ...supabaseErrFields(error),
      message: `assessment_cycles lookup failed (${error.code ?? "no_code"})`,
    });
  }
  if (!cycle) {
    logAssessmentDiag({
      op: "teacherAssessmentCycleDetail.getCycle",
      phase: "fail",
      organizationId: profile.organizationId,
      role: profile.role,
      cycleId,
      detail: "row_missing",
    });
    notFound();
  }

  const row = cycle as Record<string, unknown>;
  // Security: treat other-org cycles as missing.
  if (String(row.organization_id) !== profile.organizationId) {
    logAssessmentDiag({
      op: "teacherAssessmentCycleDetail.getCycle",
      phase: "fail",
      organizationId: profile.organizationId,
      role: profile.role,
      cycleId,
      detail: "org_mismatch",
    });
    notFound();
  }

  logAssessmentDiag({
    op: "teacherAssessmentCycleDetail.getCycle",
    phase: "success",
    organizationId: profile.organizationId,
    role: profile.role,
    cycleId,
  });

  const cycleMapped: AssessmentCycleRow = {
    id: String(row.id),
    organizationId: String(row.organization_id),
    caseId: String(row.case_id),
    title: String(row.title),
    description: (row.description as string | null) ?? null,
    status: row.status as AssessmentCycleRow["status"],
    deadlineAt: String(row.deadline_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };

  const listed = await listMilestonesForCycle(supabase, cycleId);
  if (listed.error) {
    throwAssessmentDiagError({
      op: "teacherAssessmentCycleDetail.listMilestones",
      organizationId: profile.organizationId,
      role: profile.role,
      cycleId,
      ...supabaseErrFields(listed.error),
      message: `assessment_milestones list failed (${listed.error.code ?? "no_code"})`,
    });
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <TeacherAssessmentMilestonesClient
        cycle={cycleMapped}
        initialMilestones={listed.rows}
      />
      <p className="mt-8">
        <Link href="/v2/teacher/assessments" className="text-sm text-slate-500 hover:underline">
          課題グループ一覧へ戻る
        </Link>
      </p>
    </main>
  );
}
