import Link from "next/link";
import NewStudentForm from "./NewStudentForm";

export const dynamic = "force-dynamic";

// role 判定は app/v2/admin/layout.tsx に集約済み。
export default function NewStudentPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-2">
        <Link
          href="/v2/admin/students"
          className="text-sm text-sky-700 hover:underline"
        >
          ← 学生一覧
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">学生を登録</h1>
        <p className="mt-1 text-sm text-slate-500">
          学籍番号と氏名を入力してください。初期パスワードは自動で発行されます。
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <NewStudentForm />
      </div>
    </main>
  );
}
