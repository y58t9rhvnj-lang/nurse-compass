import NurseCompassLogo from "@/components/v2/brand/NurseCompassLogo";
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
    <main className="flex min-h-full w-full flex-col items-center justify-center bg-[#F2F4F7] px-6 py-12">
      {/* 全体を画面中央に配置。ロゴはフォームより一回り大きく主役に据える
          （フォーム自体の幅・余白は据え置き＝カードは max-w-sm のまま）。 */}
      <div className="flex w-full max-w-md flex-col items-center">
        {/* ブランドブロック（ロゴ＝名称＋サブタイトル＋Powered by AIMS を内包）。
            ロゴは透過PNGで背景に自然に馴染ませ、影/枠線/背景色は付けない。 */}
        <div className="mb-9 flex w-full flex-col items-center text-center">
          {/* 幅 ~392px を基準に、狭幅では w-full で縮小しアスペクト比を維持（PC/iPad/スマホ対応）。 */}
          <NurseCompassLogo
            variant="vertical"
            size={289}
            priority
            className="h-auto w-full max-w-[392px]"
          />
        </div>

        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
      </div>
    </main>
  );
}
