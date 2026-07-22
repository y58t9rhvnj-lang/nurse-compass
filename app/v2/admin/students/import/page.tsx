import Link from "next/link";
import { requireAdminProfile } from "@/lib/v2/auth/currentUser";
import ImportForm from "./ImportForm";

export const dynamic = "force-dynamic";

export default async function ImportStudentsPage() {
  // service role を使う action の前段として、ページ側でも Admin を確定する。
  await requireAdminProfile();

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

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CSV一括登録</h1>
        <p className="mt-1 text-sm text-slate-500">
          学籍番号と氏名の CSV から、学生アカウントをまとめて登録します。
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-800">CSV形式</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>1行目はヘッダー：<code className="rounded bg-slate-100 px-1">login_id,display_name</code></li>
          <li>login_id：半角数字8桁の学籍番号</li>
          <li>display_name：氏名（前後空白は除去・最大100文字）</li>
          <li>文字コードは UTF-8（BOM付き可）。Excel の「CSV UTF-8」で保存したファイルが利用できます。</li>
          <li>一度に登録できるのは最大100件です。</li>
        </ul>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700">{`login_id,display_name
12345678,山田 花子
12345679,佐藤 太郎`}</pre>
      </section>

      <ImportForm />
    </main>
  );
}
