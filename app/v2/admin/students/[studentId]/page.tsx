import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminProfile } from "@/lib/v2/auth/currentUser";
import { getStudentDetail } from "@/lib/v2/admin/studentRepository";
import StudentManagementNav from "@/components/v2/admin/StudentManagementNav";
import StudentDetailManager from "./StudentDetailManager";

export const dynamic = "force-dynamic";

// role 判定は app/v2/admin/layout.tsx に集約済み。
// 組織境界 / role=student は getStudentDetail 側で担保し、満たさなければ 404。
// 「存在しない」と「他組織」は区別せず notFound() を返す。
export default async function AdminStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { studentId } = await params;
  const sp = await searchParams;
  const created = (Array.isArray(sp.created) ? sp.created[0] : sp.created) === "1";

  // service role クエリ前に、サーバー側で Admin 本人を確定する（認可境界）。
  const profile = await requireAdminProfile();

  const student = await getStudentDetail({
    organizationId: profile.organizationId,
    studentId,
  });
  if (!student) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <StudentManagementNav />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link
          href="/v2/admin/students"
          className="text-sky-700 hover:underline"
        >
          ← 学生一覧へ戻る
        </Link>
      </div>

      {created ? (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          学生アカウントの登録が完了しました。
        </div>
      ) : null}

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {student.displayName}
        </h1>
        <p className="mt-1 font-mono text-sm text-slate-500">
          {student.studentNumber ?? student.loginId}
        </p>
      </header>

      <StudentDetailManager
        student={student}
        isSelf={student.id === profile.id}
      />
    </main>
  );
}
