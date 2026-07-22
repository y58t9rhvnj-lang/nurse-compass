"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, Check } from "lucide-react";
import {
  createStudentAction,
  type CreateStudentResult,
} from "@/app/v2/admin/students/actions";
import {
  validateDisplayName,
  validateStudentNumber,
} from "@/lib/v2/admin/studentInput";

type SuccessState = {
  studentId: string;
  loginId: string;
  displayName: string;
  initialPassword: string;
  auditWarning: boolean;
};

export default function NewStudentForm() {
  const [studentNumber, setStudentNumber] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 初期パスワードは React state 内でのみ一時保持（localStorage/sessionStorage 不可）。
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // 二重送信防止
    setError(null);

    const numberCheck = validateStudentNumber(studentNumber);
    if (!numberCheck.ok) {
      setError(numberCheck.message);
      return;
    }
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.ok) {
      setError(nameCheck.message);
      return;
    }

    setSubmitting(true);
    try {
      const res: CreateStudentResult = await createStudentAction({
        studentNumber: numberCheck.value,
        displayName: nameCheck.value,
      });
      if (res.ok) {
        setSuccess({
          studentId: res.studentId,
          loginId: res.loginId,
          displayName: res.displayName,
          initialPassword: res.initialPassword,
          auditWarning: res.auditWarning,
        });
        return;
      }
      setError(res.message);
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCopy() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success.initialPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボード不可の環境では何もしない（手入力で対応）。
    }
  }

  // 登録成功: 初期パスワードを一度だけ表示する。再読み込みで state は消える。
  if (success) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          学生アカウントを登録しました。初期パスワードは
          <strong>この画面でのみ表示されます</strong>。学生へ安全に伝えてください。
        </div>

        {success.auditWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            登録は完了しましたが、監査記録の保存に失敗しました。必要に応じて管理者へ連絡してください。
          </div>
        ) : null}

        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">学籍番号</dt>
            <dd className="font-mono text-slate-900">{success.loginId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500">氏名</dt>
            <dd className="text-slate-900">{success.displayName}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">初期パスワード</dt>
            <dd className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-1 font-mono text-slate-900">
                {success.initialPassword}
              </span>
              <button
                type="button"
                onClick={onCopy}
                aria-label="初期パスワードをコピー"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden="true" /> コピー済み
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden="true" /> コピー
                  </>
                )}
              </button>
            </dd>
          </div>
        </dl>

        <p className="text-xs text-slate-500">
          学生は初回ログイン後、必ずパスワードの変更を求められます。
        </p>

        <div className="flex gap-3">
          <Link
            href={`/v2/admin/students/${success.studentId}?created=1`}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            学生詳細へ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="studentNumber"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          学籍番号（半角数字8桁）
        </label>
        <input
          id="studentNumber"
          type="text"
          inputMode="numeric"
          value={studentNumber}
          onChange={(e) => setStudentNumber(e.target.value)}
          maxLength={8}
          placeholder="例: 12345678"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />
      </div>

      <div>
        <label
          htmlFor="displayName"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          氏名
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={100}
          placeholder="例: 山田 花子"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          required
        />
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
        {submitting ? "登録中..." : "この内容で登録"}
      </button>
    </form>
  );
}
