"use client";

import { useState } from "react";
import {
  importBatchAiResultsAction,
  previewBatchAiImportAction,
} from "@/app/v2/actions/assessmentAiEvaluationBatch";

type Props = {
  buttonLabel?: string;
  className?: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function TeacherAiBatchImportDialog({
  buttonLabel = "一括AI結果 Import",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [zipBase64, setZipBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    canExecute: boolean;
    manifestCount: number;
    fileCount: number;
    missing: string[];
    extra: string[];
    counts: {
      valid: number;
      warning: number;
      invalid: number;
      duplicateHint: number;
      expired: number;
      error: number;
    };
    issues: Array<{ message: string }>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  /** async Server Action 用。startTransition(async) だと pending が張り付くことがある */
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFileName(null);
    setZipBase64(null);
    setPreview(null);
    setError(null);
    setResultMsg(null);
    setConfirmChecked(false);
  };

  const onFile = (file: File | null) => {
    reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setError("ZIP ファイルを選択してください。");
      return;
    }
    setFileName(file.name);
    setBusy(true);
    void (async () => {
      try {
        const b64 = await fileToBase64(file);
        setZipBase64(b64);
        const res = await previewBatchAiImportAction({
          zipBase64: b64,
          fileName: file.name,
        });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setPreview({
          canExecute: res.preview.canExecute,
          manifestCount: res.preview.manifestCount,
          fileCount: res.preview.fileCount,
          missing: res.preview.missing,
          extra: res.preview.extra,
          counts: res.preview.counts,
          issues: res.preview.issues,
        });
      } catch {
        setError("ZIP の読み込みに失敗しました。");
      } finally {
        setBusy(false);
      }
    })();
  };

  const onConfirm = () => {
    if (!zipBase64 || !preview?.canExecute || !confirmChecked) return;
    setError(null);
    setResultMsg(null);
    setBusy(true);
    void (async () => {
      try {
        const res = await importBatchAiResultsAction({
          zipBase64,
          fileName: fileName ?? undefined,
        });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setResultMsg(
          `取込完了: 成功 ${res.summary.success} / 失敗 ${res.summary.failed}（全${res.summary.total}件）`,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <button
        type="button"
        className={
          className ??
          "ml-2 flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
        }
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {buttonLabel}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-5"
          >
            <h2 className="text-lg font-semibold text-slate-900">
              一括 AI 結果 Import（Preview）
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              manifest.json 必須。results/&#123;evaluation_request_id&#125;.json
            </p>
            <label className="mt-3 block text-sm text-slate-700">
              ZIP ファイル
              <input
                type="file"
                accept=".zip,application/zip"
                className="mt-1 block w-full text-sm"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {busy && !preview && !error ? (
              <p className="mt-3 text-sm text-slate-600">確認中…</p>
            ) : null}
            {error ? (
              <p className="mt-3 text-sm text-rose-700">{error}</p>
            ) : null}
            {preview ? (
              <div className="mt-3 space-y-1 text-sm text-slate-800">
                <p>
                  manifest件数: {preview.manifestCount} / 実ファイル:{" "}
                  {preview.fileCount}
                </p>
                <p>有効: {preview.counts.valid} 件</p>
                <p>警告: {preview.counts.warning} 件</p>
                <p>無効: {preview.counts.invalid} 件</p>
                <p>期限切れ: {preview.counts.expired} 件</p>
                <p>重複ヒント: {preview.counts.duplicateHint} 件</p>
                {preview.missing.length > 0 ? (
                  <p className="text-rose-700">
                    不足: {preview.missing.length} 件
                  </p>
                ) : null}
                {preview.extra.length > 0 ? (
                  <p className="text-rose-700">
                    余分: {preview.extra.length} 件
                  </p>
                ) : null}
                {!preview.canExecute ? (
                  <p className="font-medium text-rose-700">
                    manifest と実ファイルが一致しないため実行できません。
                  </p>
                ) : (
                  <label className="mt-2 flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmChecked}
                      onChange={(e) => setConfirmChecked(e.target.checked)}
                      className="mt-1"
                    />
                    Preview 内容を確認し、部分成功を許容して取込ます。
                  </label>
                )}
              </div>
            ) : null}
            {resultMsg ? (
              <p className="mt-3 text-sm text-emerald-800">{resultMsg}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                閉じる
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white disabled:opacity-40"
                disabled={
                  busy ||
                  !preview?.canExecute ||
                  !confirmChecked ||
                  !zipBase64
                }
                onClick={onConfirm}
              >
                {busy ? "取込中…" : "取込実行"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
