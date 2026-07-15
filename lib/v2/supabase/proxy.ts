import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/v2/env";

// Version2 のセッション更新処理（proxy から呼ばれる基盤）。
//
// リクエストとレスポンスの Cookie を橋渡しして、期限が近いアクセストークンを
// 更新し、更新後の Cookie をレスポンスへ書き戻す。
//
// 【Phase 1 の範囲】ここでは「セッション Cookie の更新」だけを行う。
// 認証リダイレクト（未ログインを /v2/login へ送る等）は Phase 2 で追加する。
// そのため現段階では /v2/login を含む全 /v2 で素通し（リダイレクトなし）。
export async function updateV2Session(
  request: NextRequest,
): Promise<NextResponse> {
  // 未設定時は何もしない（V1・V2 とも素通し）。接続成功を装わない。
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    getSupabaseUrl()!,
    getSupabasePublishableKey()!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims() は JWT をローカル検証（JWKS キャッシュ）しつつ、必要なら
  // トークンを更新して setAll 経由で Cookie に書き戻す。
  // 未ログイン時は claims=null を返すだけで副作用はない。
  // 認可判断には getSession() の user ではなく getClaims()/getUser() を使う方針。
  try {
    await supabase.auth.getClaims();
  } catch {
    // ネットワーク不通等でも proxy は継続し、画面表示を妨げない。
  }

  return response;
}
