import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminProfile } from "@/lib/v2/auth/currentUser";
import { getStudentDetail } from "@/lib/v2/admin/studentRepository";

export const dynamic = "force-dynamic";

// role 判定は app/v2/admin/layout.tsx に集約済み。
// 組織境界 / role=student は getStudentDetail 側で担保し、満たさなければ 404。
// 「存在しない」と「他組織」は区別せず notFound() を返す。
function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-full text-sm font-medium text-slate-500 sm:w-48">
        {label}
      </dt>
      <dd className="text-sm text-slate-900">{children}</dd>
    </div>
  );
}

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
      <div className="mb-2">
        <Link
          href="/v2/admin/students"
          className="text-sm text-sky-700 hover:underline"
        >
          ← 学生一覧
        </Link>
      </div>

      {created ? (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          学生アカウントの登録が完了しました。
        </div>
      ) : null}

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{student.displayName}</h1>
        <p className="mt-1 font-mono text-sm text-slate-500">
          {student.studentNumber ?? student.loginId}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-2">
        <dl>
          <Row label="学籍番号">
            <span className="font-mono">
              {student.studentNumber ?? student.loginId}
            </span>
          </Row>
          <Row label="氏名">{student.displayName}</Row>
          <Row label="role">{student.role}</Row>
          <Row label="所属">{student.organizationName ?? "-"}</Row>
          <Row label="アカウント状態">
            {student.isActive ? "有効" : "無効"}
          </Row>
          <Row label="初回パスワード変更">
            {student.mustChangePassword ? "未完了" : "完了"}
          </Row>
          <Row label="パスワード変更日時">
            {formatDateTime(student.passwordChangedAt)}
          </Row>
          <Row label="作成日時">{formatDateTime(student.createdAt)}</Row>
          <Row label="更新日時">{formatDateTime(student.updatedAt)}</Row>
        </dl>
      </section>
    </main>
  );
}
