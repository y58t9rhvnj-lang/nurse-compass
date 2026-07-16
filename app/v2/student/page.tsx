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
          情報整理ノートや様式2の保存機能は、次のフェーズ（Phase 3 以降）で
          追加されます。ここで積み重ねた学びは、あなたの患者理解が形づくられて
          いく過程として大切に扱われます。
        </p>
      </section>
    </main>
  );
}
