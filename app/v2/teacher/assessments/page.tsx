import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { listCyclesForOrg } from "@/lib/v2/assessment/assessmentRepository";
import TeacherAssessmentCyclesClient from "@/components/v2/assessment/TeacherAssessmentCyclesClient";

export const dynamic = "force-dynamic";

export default async function TeacherAssessmentsPage() {
  const profile = await requireRole("teacher", "admin");
  const supabase = await createServerSupabaseClient();
  const listed = await listCyclesForOrg(supabase, profile.organizationId);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-6">
        <Link href="/v2/teacher" className="text-sm text-slate-500 hover:underline">
          ← 教員ホーム
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          提出課題・期限設定
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          講義・課題グループ（Assessment Cycle）を選び、複数の提出マイルストーンと期限を管理します。
        </p>
      </header>
      <TeacherAssessmentCyclesClient initialCycles={listed.rows} />
    </main>
  );
}
