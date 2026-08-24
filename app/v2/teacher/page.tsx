import Link from "next/link";
import { requireRole } from "@/lib/v2/auth/currentUser";
import LogoutButton from "@/components/v2/LogoutButton";

export const dynamic = "force-dynamic";

// 教員ホーム（Phase 2 のプレースホルダ）。admin も teacher 相当でここへ着地。
// 学生一覧・ログ確認・Teaching Guide は Phase 4 以降で実装。
export default async function TeacherHomePage() {
  const profile = await requireRole("teacher", "admin");

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Compass Version2 β
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {profile.displayName} 先生
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            教員ホーム（{profile.loginId}
            {profile.role === "admin" ? " ・admin" : ""}）
          </p>
        </div>
        <LogoutButton />
      </header>

      {/* 形成評価の位置づけを明記（自動採点・順位付け等は行わない思想） */}
      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        この画面は、学生の学習過程を把握し、途中の助言に活用するためのものです。
        成績評価は最終成果物および所定の評価基準に基づいて行います。
      </div>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          講義用学生画面
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          プロジェクター投影用に、学生と同じ Compass
          画面を開けます。通常操作とホワイトボードで説明でき、内容は端末内のみで学生データには保存されません。
        </p>
        <Link
          href="/v2/teacher/lecture"
          className="mt-4 inline-flex items-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
        >
          講義用学生画面を開く
        </Link>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          提出課題・期限設定
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          講義の進行に合わせて、複数の提出課題と期限を設定します。
        </p>
        <Link
          href="/v2/teacher/assessments"
          className="mt-4 inline-flex items-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          提出課題・期限設定を開く
        </Link>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">提出・評価</h2>
        <p className="mt-2 text-sm text-slate-600">
          学生の提出状況を確認し、評価対象の提出物を開きます
        </p>
        <Link
          href="/v2/teacher/reviews"
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
        >
          提出・評価を開く
        </Link>
      </section>

      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Gold Standard（読み取り専用）
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          現時点で最も妥当な患者理解と、思考の更新過程を確認できます。完成答案の提示ではありません。
        </p>
        <Link
          href="/v2/teacher/gold-standard"
          className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Gold Standard を開く
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-700">ログインに成功しました。</p>
        <p className="mt-3 text-sm text-slate-500">
          学生一覧・提出レビュー・フィードバックは Version 2.2
          の後続 Sprint で追加します。
        </p>
      </section>
    </main>
  );
}
