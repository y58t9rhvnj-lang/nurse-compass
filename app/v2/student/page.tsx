import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import LogoutButton from "@/components/v2/LogoutButton";

export const dynamic = "force-dynamic";

// 学生ホーム（Phase 2 のプレースホルダ）。
// 情報整理ノート保存・様式2保存・学習ログ等は Phase 3 以降で実装。
export default async function StudentHomePage() {
  const profile = await requireRole("student");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Compass Version2 β
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {profile.displayName} さん
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            学生ホーム（{profile.loginId}）
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-700">
          ログインに成功しました。あなた専用の学習スペースです。
        </p>
        <p className="mt-3 text-sm text-slate-500">
          入力内容は自動的に保存され、別の端末からも同じ内容を続けて編集できます。
        </p>
      </section>

      <section className="mt-6">
        <Link
          href="/v2/student/form2"
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-sky-400 hover:shadow"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              精神様式2 受け持ち対象記録
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              受け持ち対象の情報を整理して記入します。自動保存されます。
            </p>
          </div>
          <span className="text-sm font-medium text-sky-600">開く →</span>
        </Link>
      </section>
    </main>
  );
}
