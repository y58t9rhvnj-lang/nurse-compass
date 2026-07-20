"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// 個人ID＋パスワードのログインフォーム。
// 送信は公開 Route Handler(/v2/api/auth/login)へ。成功したら /v2 へ遷移し、
// /v2 側で role に応じた画面へ振り分ける。仮想メールはここでは一切扱わない。
export default function LoginForm() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/v2/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginId, password }),
      });
      if (res.ok) {
        // role 振り分けはサーバー(/v2)側で行う。
        window.location.assign("/v2");
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(data?.error ?? "ログインに失敗しました。");
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="loginId"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          個人ID
        </label>
        <input
          id="loginId"
          type="text"
          autoComplete="username"
          inputMode="text"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="例: S001"
          required
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          パスワード
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-3 pr-12 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
            aria-pressed={showPassword}
            aria-controls="password"
            className={`absolute inset-y-0 right-0 flex h-full min-w-[44px] items-center justify-center rounded-r-lg px-3 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-200 ${
              showPassword
                ? "text-sky-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "サインイン中..." : "ログイン"}
      </button>
    </form>
  );
}
