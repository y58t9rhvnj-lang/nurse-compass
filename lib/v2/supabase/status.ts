import "server-only";

import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
  missingPublicSupabaseEnv,
} from "@/lib/v2/env";
import {
  getAuthEmailDomain,
  isServiceRoleConfigured,
} from "@/lib/v2/env.server";

// Phase 1 の暫定接続確認に使う診断情報。
// 秘密鍵の値は一切含めず、真偽値・不足キー名・到達可否のみを返す。
export type V2SupabaseStatus = {
  configured: boolean;
  missingPublicEnv: string[];
  serviceRoleConfigured: boolean;
  authEmailDomain: string;
  // 未設定で確認していない場合は null（＝接続成功を装わない）。
  reachable: boolean | null;
  reachableDetail: string;
};

export async function getV2SupabaseStatus(): Promise<V2SupabaseStatus> {
  const configured = isSupabaseConfigured();
  const serviceRoleConfigured = isServiceRoleConfigured();
  const authEmailDomain = getAuthEmailDomain();

  if (!configured) {
    return {
      configured: false,
      missingPublicEnv: missingPublicSupabaseEnv(),
      serviceRoleConfigured,
      authEmailDomain,
      reachable: null,
      reachableDetail:
        "公開環境変数が未設定のため、接続確認は行っていません。",
    };
  }

  // 実際に Auth ヘルスエンドポイントへ到達できるかを確認する（成功を装わない）。
  let reachable = false;
  let reachableDetail = "";
  try {
    const url = getSupabaseUrl()!;
    const key = getSupabasePublishableKey()!;
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: key },
      cache: "no-store",
    });
    reachable = res.ok;
    reachableDetail = res.ok
      ? `Auth ヘルスチェック成功（HTTP ${res.status}）`
      : `Auth ヘルスチェック失敗（HTTP ${res.status}）。URL とキーを確認してください。`;
  } catch {
    reachable = false;
    reachableDetail =
      "Supabase へ到達できませんでした（URL・ネットワーク・プロジェクト状態を確認してください）。";
  }

  return {
    configured: true,
    missingPublicEnv: [],
    serviceRoleConfigured,
    authEmailDomain,
    reachable,
    reachableDetail,
  };
}
