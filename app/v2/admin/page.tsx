import { getCurrentProfile } from "@/lib/v2/auth/currentUser";
import LogoutButton from "@/components/v2/LogoutButton";

export const dynamic = "force-dynamic";

// Admin ホーム（D-3C 時点の最小プレースホルダ）。
// role 判定は app/v2/admin/layout.tsx の requireRole("admin") に集約済み。
// ここでは表示用にプロフィールのみ取得する（重複した role 判定は行わない）。
// 学生/教員一覧・登録フォーム・CSV・パスワードリセット・監査ログ一覧・
// ダッシュボード指標は、後続スプリントで実装する（本ページには置かない）。
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

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-700">管理者機能は準備中です。</p>
      </section>
    </main>
  );
}
