"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { changePasswordAction } from "@/app/v2/actions/changePassword";
import {
  PASSWORD_MIN_LENGTH,
  validateNewPassword,
} from "@/lib/v2/auth/passwordPolicy";

// 新パスワードを2回入力して変更する。成功後は /v2 へ遷移し role 別画面へ振り分け。
// サーバー側でも同じ要件を再検証するため、ここでの検証は入力補助（UX）目的。
export default function ChangePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const local = validateNewPassword(password, confirm);
    if (!local.ok) {
      setError(local.message);
      return;
    }

    setSubmitting(true);
    try {
      const res = await changePasswordAction(password, confirm);
      if (res.ok) {
        // role 振り分けはサーバー(/v2)側で行う。
        window.location.assign("/v2");
        return;
      }
      setError(res.message);
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
          htmlFor="new-password"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          新しいパスワード
        </label>
        <div className="relative">
          <input
            id="new-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-3 pr-12 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            required
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "パスワードを隠す" : "パスワードを表示"}
            aria-pressed={show}
            className={`absolute inset-y-0 right-0 flex h-full min-w-[44px] items-center justify-center rounded-r-lg px-3 outline-none transition focus-visible:ring-2 focus-visible:ring-sky-200 ${
              show ? "text-sky-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {show ? (
              <EyeOff className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="confirm-password"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          新しいパスワード（確認）
        </label>
        <input
          id="confirm-password"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />
      </div>

      <p className="text-xs text-slate-500">
        {PASSWORD_MIN_LENGTH}文字以上で、英字と数字をそれぞれ1文字以上含めてください。
      </p>

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
        {submitting ? "変更中..." : "パスワードを変更"}
      </button>
    </form>
  );
}
