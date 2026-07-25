import Link from "next/link";
import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import LogoutButton from "@/components/v2/LogoutButton";

export const dynamic = "force-dynamic";

// Admin ホーム。
// role 判定は app/v2/admin/layout.tsx の requireRole("admin") に集約済み。
// ここでは表示用にプロフィールのみ取得する（重複した role 判定は行わない）。
// 実装済みの学生管理機能への導線のみを置く。未実装機能のリンクは追加しない。
// スクロールは app/v2/admin/layout.tsx の単一コンテナに委ねる（本ページでは追加しない）。
export default async function AdminHomePage() {
  const profile = await getCurrentProfile();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Compass Version2 · 管理
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            管理者ホーム
          </h1>
          {profile ? (
            <p className="mt-1 text-sm text-slate-500">
              {profile.displayName}（{profile.loginId} ・admin）
            </p>
          ) : null}
        </div>
        <LogoutButton />
      </header>

      <section aria-labelledby="admin-menu-heading" className="space-y-4">
        <h2
          id="admin-menu-heading"
          className="text-sm font-semibold text-slate-500"
        >
          学生管理
        </h2>

        {/* 主導線：学生管理（最も分かりやすく強調） */}
        <Link
          href="/v2/admin/students"
          className="group flex min-h-[88px] flex-col justify-center rounded-xl border border-sky-200 bg-sky-50 p-6 shadow-sm transition hover:border-sky-400 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <span className="flex items-center gap-2 text-lg font-bold text-sky-900">
            学生管理
            <span
              aria-hidden="true"
              className="text-sky-500 transition group-hover:translate-x-0.5"
            >
              →
            </span>
          </span>
          <span className="mt-1 text-sm text-sky-800/80">
            学生一覧の確認、氏名修正、利用停止、パスワード初期化
          </span>
        </Link>

        {/* 副導線：登録系（狭い画面では縦並び、広い画面では2列） */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/v2/admin/students/new"
            className="group flex min-h-[88px] flex-col justify-center rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
              学生を1名登録
              <span
                aria-hidden="true"
                className="text-slate-400 transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
            <span className="mt-1 text-sm text-slate-500">
              学生アカウントを個別に登録
            </span>
          </Link>

          <Link
            href="/v2/admin/students/import"
            className="group flex min-h-[88px] flex-col justify-center rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-sky-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <span className="flex items-center gap-2 text-base font-semibold text-slate-900">
              CSV一括登録
              <span
                aria-hidden="true"
                className="text-slate-400 transition group-hover:translate-x-0.5"
              >
                →
              </span>
            </span>
            <span className="mt-1 text-sm text-slate-500">
              CSVファイルから学生をまとめて登録
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
