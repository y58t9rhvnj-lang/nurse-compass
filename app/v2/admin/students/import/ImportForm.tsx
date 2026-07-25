"use client";

import { useState } from "react";
import Link from "next/link";
import {
  importStudentCsvAction,
  previewStudentCsvAction,
  type ImportStudentCsvResult,
  type PreviewStudentCsvResult,
} from "./actions";
import type {
  StudentCsvImportCounts,
  StudentCsvPreviewCounts,
  StudentCsvRow,
  StudentCsvRowStatus,
} from "@/lib/v2/admin/studentCsvTypes";

type Phase = "idle" | "previewed" | "done";

function statusLabel(status: StudentCsvRowStatus): string {
  switch (status) {
    case "registerable":
      return "登録可能";
    case "registered":
      return "登録成功";
    case "already_registered":
      return "登録済み";
    case "duplicate_in_csv":
      return "CSV内重複";
    case "validation_error":
      return "形式エラー";
    case "auth_create_failed":
      return "登録失敗（認証）";
    case "profile_create_failed":
      return "登録失敗（保存）";
    case "compensation_failed":
      return "登録失敗（重大）";
  }
}

function statusClass(status: StudentCsvRowStatus): string {
  switch (status) {
    case "registerable":
    case "registered":
      return "bg-emerald-50 text-emerald-700";
    case "already_registered":
    case "duplicate_in_csv":
      return "bg-slate-100 text-slate-600";
    case "validation_error":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-rose-50 text-rose-700";
  }
}

function RowList({ rows }: { rows: StudentCsvRow[] }) {
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {rows.map((r) => (
        <li
          key={`${r.rowNumber}-${r.loginId}`}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
        >
          <span className="w-10 shrink-0 text-xs text-slate-400">
            {r.rowNumber}
          </span>
          <span className="w-24 shrink-0 font-mono text-slate-700">
            {r.loginId || "—"}
          </span>
          <span className="min-w-[8rem] flex-1 text-slate-900">
            {r.displayName || "—"}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(
              r.status,
            )}`}
          >
            {statusLabel(r.status)}
          </span>
          {r.message ? (
            <span className="w-full text-xs text-slate-500 sm:w-auto">
              {r.message}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read_failed"));
    reader.readAsText(file, "UTF-8");
  });
}

export default function ImportForm() {
  const [fileName, setFileName] = useState<string>("");
  // CSV 本文はプレビュー/登録の再検証で使うため state に保持（初期パスワードは保持しない）。
  const [csvText, setCsvText] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previewRows, setPreviewRows] = useState<StudentCsvRow[]>([]);
  const [previewCounts, setPreviewCounts] =
    useState<StudentCsvPreviewCounts | null>(null);

  const [resultRows, setResultRows] = useState<StudentCsvRow[]>([]);
  const [resultCounts, setResultCounts] =
    useState<StudentCsvImportCounts | null>(null);
  const [auditWarning, setAuditWarning] = useState(false);

  // 完了後に「続けてCSV登録」する場合、フォームを初期状態へ戻す。
  function onStartOver() {
    setFileName("");
    setCsvText("");
    setError(null);
    setPreviewRows([]);
    setPreviewCounts(null);
    setResultRows([]);
    setResultCounts(null);
    setAuditWarning(false);
    setPhase("idle");
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setPhase("idle");
    setPreviewRows([]);
    setPreviewCounts(null);
    setResultRows([]);
    setResultCounts(null);
    const file = e.target.files?.[0];
    if (!file) {
      setFileName("");
      setCsvText("");
      return;
    }
    setFileName(file.name);
    try {
      const text = await readFileAsText(file);
      setCsvText(text);
    } catch {
      setCsvText("");
      setError("ファイルを読み込めませんでした。");
    }
  }

  async function onPreview() {
    if (busy || !csvText) return;
    setBusy(true);
    setError(null);
    try {
      const res: PreviewStudentCsvResult =
        await previewStudentCsvAction(csvText);
      if (res.ok) {
        setPreviewRows(res.rows);
        setPreviewCounts(res.counts);
        setPhase("previewed");
      } else {
        setError(res.message);
      }
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (busy || !csvText) return;
    setBusy(true);
    setError(null);
    try {
      const res: ImportStudentCsvResult = await importStudentCsvAction(csvText);
      if (res.ok) {
        setResultRows(res.rows);
        setResultCounts(res.counts);
        setAuditWarning(res.auditWarning);
        setPhase("done");
      } else {
        setError(res.message);
      }
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setBusy(false);
    }
  }

  // 完了画面
  if (phase === "done" && resultCounts) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">一括登録が完了しました。</p>
          <p className="mt-1">初期パスワードは「P＋学籍番号」です。</p>
          <p>学生は初回ログイン時にパスワードの変更が必要です。</p>
        </div>

        {auditWarning ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            登録は完了しましたが、監査記録の一部保存に失敗しました。必要に応じて管理者へ連絡してください。
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <Stat label="対象" value={resultCounts.requestedCount} />
          <Stat label="登録成功" value={resultCounts.successCount} />
          <Stat label="登録済み・重複" value={resultCounts.skippedCount} />
          <Stat label="入力エラー" value={resultCounts.validationErrorCount} />
          <Stat label="登録失敗" value={resultCounts.failedCount} />
        </dl>

        <RowList rows={resultRows} />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/v2/admin/students"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            学生一覧を確認
          </Link>
          <button
            type="button"
            onClick={onStartOver}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            続けてCSV登録
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">
          CSVファイル（.csv）
        </label>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          disabled={busy}
          className="mt-2 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-900 disabled:opacity-60"
        />
        {fileName ? (
          <p className="mt-2 text-xs text-slate-500">選択中: {fileName}</p>
        ) : null}

        <div className="mt-4">
          <button
            type="button"
            onClick={onPreview}
            disabled={busy || !csvText}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && phase !== "previewed" ? "確認中..." : "内容を確認"}
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

      {phase === "previewed" && previewCounts ? (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <Stat label="対象" value={previewCounts.requestedCount} />
            <Stat label="登録可能" value={previewCounts.registerableCount} />
            <Stat label="CSV内重複" value={previewCounts.duplicateInCsvCount} />
            <Stat label="登録済み" value={previewCounts.alreadyRegisteredCount} />
            <Stat label="形式エラー" value={previewCounts.validationErrorCount} />
          </dl>

          {/* 登録アクションは一覧の「上」に置き、長いプレビュー行に隠れないようにする。
              登録可能件数 > 0 の場合は必ず表示する（0件のときのみ無効化＋案内）。 */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={onImport}
              disabled={busy || previewCounts.registerableCount === 0}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "登録中..."
                : `登録可能な学生を一括登録（${previewCounts.registerableCount}件）`}
            </button>
            {previewCounts.registerableCount === 0 ? (
              <span className="text-sm text-slate-500">
                登録可能な学生がいません。
              </span>
            ) : null}
          </div>

          <RowList rows={previewRows} />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-bold text-slate-900">{value}</dd>
    </div>
  );
}
