import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/v2/env";

// Version2 のセッション更新＋認証リダイレクト（proxy から呼ばれる）。
//
// リクエストとレスポンスの Cookie を橋渡ししてアクセストークンを更新し、
// 未認証で保護ルートへ来た場合は /v2/login へ送る（optimistic なガード）。
// role による厳密な認可は各サーバーコンポーネント側（requireRole 等）で行う。
//
// 公開ルート（未認証でも通す）:
//   - /v2/login            … ログイン画面
//   - /v2/api/auth/*       … ログイン/ログアウトの Route Handler
// 静的ファイル・画像・_next 等は proxy の matcher（/v2 のみ）に一致しないため対象外。

function isPublicV2Path(pathname: string): boolean {
  return (
    pathname === "/v2/login" ||
    pathname.startsWith("/v2/login/") ||
    pathname.startsWith("/v2/api/auth")
  );
}

export async function updateV2Session(
  request: NextRequest,
): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // 未設定時はリダイレクトしない（/v2/login の未設定診断を表示できるようにする）。
  // 保護ルートへ来ても素通しし、ページ側が /v2/login へ誘導する。
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

  // getClaims() は JWT をローカル検証しつつ、必要ならトークンを更新して
  // setAll 経由で Cookie に書き戻す。認可判断に getSession() の user は使わない。
  let isAuthed = false;
  try {
    const { data } = await supabase.auth.getClaims();
    isAuthed = typeof data?.claims?.sub === "string";
  } catch {
    // ネットワーク不通等では未認証扱いで継続（保護ルートは login へ誘導）。
    isAuthed = false;
  }

  const isPublic = isPublicV2Path(pathname);

  // 未認証で保護ルート → /v2/login へ。
  if (!isAuthed && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/v2/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 認証済みでログイン画面 → /v2 へ（role 振り分けはページ側）。
  if (isAuthed && pathname === "/v2/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/v2";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
