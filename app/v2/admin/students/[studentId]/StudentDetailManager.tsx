"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminStudentDetail } from "@/lib/v2/admin/studentTypes";
import { validateDisplayName } from "@/lib/v2/admin/studentInput";
import {
  updateStudentNameAction,
  setStudentActiveAction,
  resetStudentPasswordAction,
  type StudentAdminActionResult,
} from "./actions";

type Feedback = { kind: "success" | "error" | "warn"; text: string };

const RESET_CONFIRM =
  "この学生のパスワードを初期状態へ戻します。次回ログイン時にパスワード変更が必要になります。実行しますか？";

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-full text-sm font-medium text-slate-500 sm:w-40">
        {label}
      </dt>
      <dd className="w-full text-sm text-slate-900">{children}</dd>
    </div>
  );
}

export default function StudentDetailManager({
  student,
  isSelf,
}: {
  student: AdminStudentDetail;
  isSelf: boolean;
}) {
  const router = useRouter();

  // 表示に用いる可変状態（操作成功時に自分で更新し、router.refresh() で再検証する）。
  const [displayName, setDisplayName] = useState(student.displayName);
  const [nameInput, setNameInput] = useState(student.displayName);
  const [isActive, setIsActive] = useState(student.isActive);
  const [mustChange, setMustChange] = useState(student.mustChangePassword);
  const [passwordChangedAt, setPasswordChangedAt] = useState(
    student.passwordChangedAt,
  );

  const [savingName, setSavingName] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const busy = savingName || togglingActive || resetting;
  const nameDirty = nameInput.trim() !== displayName;

  function applyResultFeedback(
    result: StudentAdminActionResult,
    successText: string,
  ): boolean {
    if (result.ok) {
      setFeedback({
        kind: result.auditWarning ? "warn" : "success",
        text: result.auditWarning
          ? `${successText}（監査記録の保存に失敗しました。管理者へ連絡してください。）`
          : successText,
      });
      return true;
    }
    setFeedback({ kind: "error", text: result.message });
    return false;
  }

  async function onSaveName() {
    if (busy) return; // 二重送信防止
    setFeedback(null);
    const check = validateDisplayName(nameInput);
    if (!check.ok) {
      setFeedback({ kind: "error", text: check.message });
      return;
    }
    setSavingName(true);
    try {
      const result = await updateStudentNameAction(student.id, check.value);
      if (applyResultFeedback(result, "氏名を保存しました。") && result.ok) {
        setDisplayName(check.value);
        setNameInput(check.value);
        router.refresh();
      }
    } catch {
      setFeedback({
        kind: "error",
        text: "通信に失敗しました。ネットワークを確認してください。",
      });
    } finally {
      setSavingName(false);
    }
  }

  async function onToggleActive() {
    if (busy) return;
    setFeedback(null);
    const next = !isActive;
    const confirmText = next
      ? "この学生の利用を再開します。よろしいですか？"
      : "この学生を利用停止にします。停止中はログインできなくなります。よろしいですか？";
    if (!window.confirm(confirmText)) return;
    setTogglingActive(true);
    try {
      const result = await setStudentActiveAction(student.id, next);
      const successText = next
        ? "この学生の利用を再開しました。"
        : "この学生を利用停止にしました。";
      if (applyResultFeedback(result, successText) && result.ok) {
        setIsActive(next);
        router.refresh();
      }
    } catch {
      setFeedback({
        kind: "error",
        text: "通信に失敗しました。ネットワークを確認してください。",
      });
    } finally {
      setTogglingActive(false);
    }
  }

  async function onResetPassword() {
    if (busy) return;
    setFeedback(null);
    if (!window.confirm(RESET_CONFIRM)) return;
    setResetting(true);
    try {
      const result = await resetStudentPasswordAction(student.id);
      if (
        applyResultFeedback(
          result,
          "初期パスワードへリセットしました。次回ログイン時にパスワード変更が必要です。",
        ) &&
        result.ok
      ) {
        setMustChange(true);
        setPasswordChangedAt(null);
        router.refresh();
      }
    } catch {
      setFeedback({
        kind: "error",
        text: "通信に失敗しました。ネットワークを確認してください。",
      });
    } finally {
      setResetting(false);
    }
  }

  const feedbackClass =
    feedback?.kind === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : feedback?.kind === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          role="status"
          className={`rounded-xl border p-4 text-sm ${feedbackClass}`}
        >
          {feedback.text}
        </div>
      ) : null}

      {/* 基本情報 */}
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-2">
        <h2 className="border-b border-slate-100 py-3 text-sm font-bold text-slate-800">
          基本情報
        </h2>
        <dl>
          <InfoRow label="学籍番号">
            <span className="font-mono">
              {student.studentNumber ?? student.loginId}
            </span>
            <span className="ml-2 text-xs text-slate-400">
              （変更できません）
            </span>
          </InfoRow>

          <InfoRow label="氏名">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={100}
                disabled={busy}
                aria-label="氏名"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:opacity-60 sm:max-w-xs"
              />
              <button
                type="button"
                onClick={onSaveName}
                disabled={busy || !nameDirty}
                className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingName ? "保存中..." : "氏名を保存"}
              </button>
            </div>
          </InfoRow>

          <InfoRow label="状態">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                isActive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {isActive ? "有効" : "利用停止中"}
            </span>
          </InfoRow>

          <InfoRow label="初回パスワード変更">
            {mustChange ? "未完了" : "完了"}
          </InfoRow>
        </dl>
      </section>

      {/* 補足の読み取り専用情報 */}
      <section className="rounded-xl border border-slate-200 bg-white px-5 py-2">
        <dl>
          <InfoRow label="role">{student.role}</InfoRow>
          <InfoRow label="所属">{student.organizationName ?? "-"}</InfoRow>
          <InfoRow label="パスワード変更日時">
            {formatDateTime(passwordChangedAt)}
          </InfoRow>
          <InfoRow label="作成日時">
            {formatDateTime(student.createdAt)}
          </InfoRow>
          <InfoRow label="更新日時">
            {formatDateTime(student.updatedAt)}
          </InfoRow>
        </dl>
      </section>

      {/* アカウント操作 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-bold text-slate-800">アカウント操作</h2>
        <p className="mb-4 text-xs text-slate-500">
          氏名の保存は上の「基本情報」から行えます。
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onResetPassword}
            disabled={busy || isSelf}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {resetting ? "初期化中..." : "初期パスワードへリセット"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          初期パスワードは「P＋学籍番号」です。実行後、学生は次回ログイン時にパスワード変更を求められます。
        </p>
      </section>

      {/* 危険操作（通常操作と視覚的に分離） */}
      <section className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
        <h2 className="mb-1 text-sm font-bold text-rose-800">危険操作</h2>
        <p className="mb-4 text-xs text-rose-700/80">
          利用停止中はこの学生はログインできません。学習データ（様式2・Evidence・ノート等）は削除されません。
        </p>

        <button
          type="button"
          onClick={onToggleActive}
          disabled={busy || isSelf}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
            isActive
              ? "bg-rose-600 hover:bg-rose-700"
              : "bg-emerald-600 hover:bg-emerald-700"
          }`}
        >
          {togglingActive
            ? "処理中..."
            : isActive
              ? "この学生を利用停止"
              : "この学生の利用を再開"}
        </button>

        {isSelf ? (
          <p className="mt-2 text-xs text-rose-700">
            自分自身のアカウントには実行できません。
          </p>
        ) : null}
      </section>

      {/* 学籍番号変更・完全削除に関する注意 */}
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        学籍番号の変更および完全削除は、関連データ保護のため現在は管理者画面から実行できません。
      </p>
    </div>
  );
}
