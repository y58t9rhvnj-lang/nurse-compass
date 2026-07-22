import { requireRole } from "@/lib/v2/auth/currentUser";
import LogoutButton from "@/components/v2/LogoutButton";

export const dynamic = "force-dynamic";

// Admin ホーム（D-3B の最小プレースホルダ）。
// role='admin' のみ着地できる（requireRole によりサーバー側で判定）。
// ダッシュボード・学生管理・CSV 一括登録・監査ログは後続スプリント（D-3C 以降）で実装する。
export default async function AdminHomePage() {
  const profile = await requireRole("admin");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Compass Version2 · 管理
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            管理ホーム
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {profile.displayName}（{profile.loginId} ・admin）
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-700">管理者としてログインしました。</p>
        <p className="mt-3 text-sm text-slate-500">
          学生管理・CSV 一括登録・ダッシュボードは、次のフェーズ（D-3C 以降）で
          追加されます。
        </p>
      </section>
    </main>
  );
}
