"use client";

import { useState } from "react";
import {
  exportBatchAiPackagesAction,
  previewBatchAiExportAction,
} from "@/app/v2/actions/assessmentAiEvaluationBatch";

type Props = {
  milestoneId: string;
  /** 選択中の提出 ID（空なら評価対象すべて） */
  submissionIds?: string[];
  buttonLabel?: string;
  className?: string;
};

function downloadBase64Zip(filename: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherAiBatchExportDialog({
  milestoneId,
  submissionIds,
  buttonLabel = "一括AI Package Export",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    targetCount: number;
    unsubmittedHint: number | null;
    skippedSnapshot: number;
    generateCount: number;
    freeTextWarning: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** async Server Action 用。startTransition(async) だと pending が張り付くことがある */
  const [busy, setBusy] = useState(false);

  const openDialog = () => {
    setError(null);
    setPreview(null);
    setOpen(true);
    setBusy(true);
    void (async () => {
      try {
        const res = await previewBatchAiExportAction({
          milestoneId,
          submissionIds:
            submissionIds && submissionIds.length > 0 ? submissionIds : null,
        });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setPreview({
          targetCount: res.preview.targetCount,
          unsubmittedHint: res.preview.unsubmittedHint,
          skippedSnapshot: res.preview.skippedSnapshot,
          generateCount: res.preview.generateCount,
          freeTextWarning: res.preview.freeTextWarning,
        });
      } finally {
        setBusy(false);
      }
    })();
  };

  const onConfirm = () => {
    if (!preview || preview.generateCount < 1) return;
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        const res = await exportBatchAiPackagesAction({
          milestoneId,
          submissionIds:
            submissionIds && submissionIds.length > 0 ? submissionIds : null,
        });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        downloadBase64Zip(res.result.filename, res.result.bodyBase64);
        setOpen(false);
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
          "flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
        }
        onClick={openDialog}
      >
        {buttonLabel}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl"
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-slate-900">
                一括 AI Package Export（Preview）
              </h2>
              {busy && !preview && !error ? (
                <p className="mt-3 text-sm text-slate-600">確認中…</p>
              ) : null}
              {error ? (
                <p className="mt-3 break-words text-sm text-rose-700">{error}</p>
              ) : null}
              {preview ? (
                <div className="mt-3 space-y-2 break-words text-sm text-slate-800">
                  <p>対象（評価候補提出）: {preview.targetCount} 件</p>
                  <p>snapshotなし（スキップ）: {preview.skippedSnapshot} 件</p>
                  <p className="font-medium">
                    生成予定 Package: {preview.generateCount} 件
                  </p>
                  <p className="text-xs text-amber-900">
                    {preview.freeTextWarning}
                  </p>
                  <p className="text-xs text-slate-500">
                    ZIP には manifest.json・README.txt・packages/*.json
                    （正式 AiEvaluationPackage）が含まれます。
                  </p>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white p-4 sm:px-5">
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
                disabled={busy || !preview || preview.generateCount < 1}
                onClick={onConfirm}
              >
                {busy
                  ? preview
                    ? "生成中…"
                    : "確認中…"
                  : "ZIPをダウンロード"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
