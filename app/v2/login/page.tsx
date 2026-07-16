import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { getV2SupabaseStatus } from "@/lib/v2/supabase/status";
import LoginForm from "./LoginForm";

// ログイン画面（公開ルート）。
// 認証基盤が未設定のうちはフォームを出さず、セットアップ状況の診断を表示する
//（アカウント作成前でも設定の不足を確認できるようにするため）。
export const dynamic = "force-dynamic";

export default async function V2LoginPage() {
  const configured = isSupabaseConfigured();
  const status = configured ? null : await getV2SupabaseStatus();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Compass Version2 β
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">ログイン</h1>
        <p className="mt-2 text-sm text-slate-600">
          個人IDとパスワードでログインしてください。
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {configured ? (
          <LoginForm />
        ) : (
          <div className="space-y-3 text-sm text-slate-600">
            <p className="font-semibold text-rose-700">認証基盤が未設定です</p>
            <p>
              Supabase の環境変数が設定されていないため、まだログインできません。
              以下が未設定です:
            </p>
            <ul className="list-inside list-disc font-mono text-xs text-rose-700">
              {status?.missingPublicEnv.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
            <p>
              設定手順は{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                docs/version2/SUPABASE_SETUP.md
              </code>{" "}
              を参照してください。
            </p>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Compass は学習支援システムです。学生の学習過程を支えることを目的としています。
      </p>

      <div className="mt-4 text-center">
        <Link
          href="/"
          className="text-sm font-medium text-sky-700 underline underline-offset-4"
        >
          Version1（/）へ
        </Link>
      </div>
    </main>
  );
}
