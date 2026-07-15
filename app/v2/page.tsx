import Link from "next/link";
import { getV2SupabaseStatus } from "@/lib/v2/supabase/status";

// 環境変数や到達状況は実行のたびに確認したいので静的化しない。
export const dynamic = "force-dynamic";

function StatusPill({
  state,
  label,
}: {
  state: "ok" | "ng" | "unknown";
  label: string;
}) {
  const styles: Record<typeof state, string> = {
    ok: "bg-emerald-100 text-emerald-800 border-emerald-300",
    ng: "bg-rose-100 text-rose-800 border-rose-300",
    unknown: "bg-slate-100 text-slate-600 border-slate-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[state]}`}
    >
      {label}
    </span>
  );
}

// Phase 1 の暫定「接続確認」画面。
// ログイン／DB保存／RLS／各画面は未実装（Phase 2 以降）。
export default async function V2StatusPage() {
  const status = await getV2SupabaseStatus();

  const publicState = status.configured ? "ok" : "ng";
  const reachableState =
    status.reachable === null ? "unknown" : status.reachable ? "ok" : "ng";

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Compass Version2 β
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          Phase 1 接続確認
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          この画面は Supabase 接続基盤の暫定確認用です。ログイン・データ保存・
          学習ログ・教員画面などは未実装です（Phase 2 以降）。
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <Row
          title="公開環境変数（URL / publishable key）"
          pill={
            <StatusPill
              state={publicState}
              label={status.configured ? "設定済み" : "未設定"}
            />
          }
        >
          {status.configured ? (
            <p className="text-sm text-slate-600">
              ブラウザ用クライアントを構築できる設定が揃っています。
            </p>
          ) : (
            <div className="text-sm text-slate-600">
              <p className="mb-1">未設定の項目:</p>
              <ul className="list-inside list-disc font-mono text-xs text-rose-700">
                {status.missingPublicEnv.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            </div>
          )}
        </Row>

        <Row
          title="service role key（サーバー専用）"
          pill={
            <StatusPill
              state={status.serviceRoleConfigured ? "ok" : "unknown"}
              label={status.serviceRoleConfigured ? "設定済み" : "未設定"}
            />
          }
        >
          <p className="text-sm text-slate-600">
            サーバー側でのみ判定（値は画面に表示しません）。シードスクリプト用途で
            使用します。通常のデータ取得には使いません。
          </p>
        </Row>

        <Row
          title="Supabase への到達確認"
          pill={
            <StatusPill
              state={reachableState}
              label={
                status.reachable === null
                  ? "未確認"
                  : status.reachable
                    ? "到達 OK"
                    : "到達 NG"
              }
            />
          }
        >
          <p className="text-sm text-slate-600">{status.reachableDetail}</p>
        </Row>

        <Row title="内部Authドメイン（V2_AUTH_EMAIL_DOMAIN）" pill={null}>
          <p className="font-mono text-sm text-slate-700">
            {status.authEmailDomain}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            個人ID→内部Auth識別子の変換にのみ使用します（学生画面・URL・
            学習ログには表示しません）。
          </p>
        </Row>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">セットアップ手順</p>
        <p className="mt-1">
          Supabase プロジェクト作成と環境変数設定の手順は{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
            docs/version2/SUPABASE_SETUP.md
          </code>{" "}
          を参照してください。
        </p>
      </div>

      <div className="mt-6">
        <Link
          href="/"
          className="text-sm font-medium text-sky-700 underline underline-offset-4"
        >
          ← Version1（/）へ戻る
        </Link>
      </div>
    </main>
  );
}

function Row({
  title,
  pill,
  children,
}: {
  title: string;
  pill: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {pill}
      </div>
      {children}
    </div>
  );
}
