import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";

// ログアウト Route Handler（公開ルート）。セッション Cookie を破棄する。
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
