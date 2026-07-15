import type { NextRequest } from "next/server";
import { updateV2Session } from "@/lib/v2/supabase/proxy";

// Next.js 16 の proxy（旧 middleware）。
//
// 対象は Version2 (/v2 配下) のみ。matcher により Version1 の「/」や
// 静的ファイル・画像・_next 等には一切影響しない。
//
// Phase 1 ではセッション Cookie の更新のみを行う（認証リダイレクトは Phase 2）。
export async function proxy(request: NextRequest) {
  return updateV2Session(request);
}

export const config = {
  // /v2 と /v2 配下すべて。静的アセット(_next/*, public/*)は /v2 配下ではないため
  // ここには一致せず、Version1 のパフォーマンスにも影響しない。
  matcher: ["/v2", "/v2/:path*"],
};
