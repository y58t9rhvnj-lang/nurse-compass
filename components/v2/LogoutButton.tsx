"use client";

import { useState } from "react";

// ログアウト用ボタン。公開 Route Handler へ POST し、成功後 /v2/login へ。
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/v2/api/auth/logout", { method: "POST" });
    } catch {
      // 失敗しても遷移は試みる。
    } finally {
      window.location.assign("/v2/login");
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
