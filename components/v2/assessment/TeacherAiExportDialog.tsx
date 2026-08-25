"use client";

import { useState, useTransition } from "react";
import {
  exportMilestoneAiDataAction,
  exportSubmissionAiDataAction,
  previewMilestoneAiExportAction,
  previewSubmissionAiExportAction,
  type AiExportPreviewResult,
} from "@/app/v2/actions/assessmentAiExport";

type Mode =
  | { kind: "milestone"; milestoneId: string }
  | {
      kind: "submission";
      milestoneId: string;
      studentId: string;
      submissionId: string;
    };

type Props = {
  mode: Mode;
  buttonLabel?: string;
  className?: string;
};

function downloadText(filename: string, contentType: string, body: string) {
  const blob = new Blob([body], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TeacherAiExportDialog({
  mode,
  buttonLabel = "AI解析用エクスポート",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"json" | "jsonl">("json");
  const [preview, setPreview] = useState<
    Extract<AiExportPreviewResult, { ok: true }> | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [auditWarn, setAuditWarn] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openDialog = () => {
    setError(null);
    setAuditWarn(null);
    setPreview(null);
    setOpen(true);
    startTransition(async () => {
      const res =
        mode.kind === "milestone"
          ? await previewMilestoneAiExportAction(mode.milestoneId)
          : await previewSubmissionAiExportAction(mode);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setPreview(res);
      setFormat(res.recordCount > 1 ? "jsonl" : "json");
    });
  };

  const onConfirm = () => {
    if (!preview || preview.recordCount < 1) return;
    setError(null);
    setAuditWarn(null);
    startTransition(async () => {
      const res =
        mode.kind === "milestone"
          ? await exportMilestoneAiDataAction({
              milestoneId: mode.milestoneId,
              format,
            })
          : await exportSubmissionAiDataAction({
              ...mode,
              format,
            });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      downloadText(res.filename, res.contentType, res.body);
      if (!res.auditLogged) {
        setAuditWarn(
          "ファイルはダウンロードしましたが、監査ログの記録に失敗しました（service role 設定を確認してください）。",
        );
      } else {
        setOpen(false);
      }
    });
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
            aria-labelledby="ai-export-title"
            className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl sm:p-5"
          >
            <h2
              id="ai-export-title"
              className="text-base font-semibold text-slate-900"
            >
              AI解析用データのエクスポート
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              氏名・ログインID・組織ID・ユーザーIDは含めません。課題・提出の実IDは匿名IDへ変換します。講義名・課題名は「課題N」「評価時点N」に置換します。
            </p>

            {pending && !preview && !error ? (
              <p className="mt-4 text-sm text-slate-500">確認情報を読み込み中…</p>
            ) : null}

            {error ? (
              <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            ) : null}

            {preview ? (
              <div className="mt-4 space-y-3 text-sm text-slate-800">
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {preview.freeTextWarning}
                </p>

                <dl className="space-y-1 rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <dt className="inline text-slate-500">対象（内部確認）：</dt>
                    <dd className="inline">
                      {preview.cycleTitle} / {preview.milestoneTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">
                      出力上の講義・課題グループ：
                    </dt>
                    <dd className="inline font-medium">
                      {preview.exportCycleTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">出力上の課題名：</dt>
                    <dd className="inline font-medium">
                      {preview.exportMilestoneTitle}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">件数：</dt>
                    <dd className="inline font-semibold">
                      {preview.recordCount} 件
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-slate-500">schema_version：</dt>
                    <dd className="inline">{preview.schemaVersion}</dd>
                  </div>
                </dl>

                <div>
                  <p className="font-medium text-slate-900">含まれる項目</p>
                  {preview.includedArtifacts.length === 0 ? (
                    <p className="mt-1 text-slate-500">
                      （評価対象提出にエクスポート可能な項目がありません）
                    </p>
                  ) : (
                    <ul className="mt-1 list-inside list-disc text-slate-700">
                      {preview.includedArtifacts.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <fieldset className="space-y-2">
                  <legend className="font-medium text-slate-900">出力形式</legend>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name="ai-export-format"
                      checked={format === "json"}
                      onChange={() => setFormat("json")}
                    />
                    <span>1ファイル JSON（複数件は配列）</span>
                  </label>
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="radio"
                      name="ai-export-format"
                      checked={format === "jsonl"}
                      onChange={() => setFormat("jsonl")}
                    />
                    <span>JSONL（1行＝1提出）</span>
                  </label>
                </fieldset>
              </div>
            ) : null}

            {auditWarn ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                {auditWarn}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                disabled={
                  pending || !preview || preview.recordCount < 1
                }
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
                onClick={onConfirm}
              >
                {pending ? "処理中…" : "確認してダウンロード"}
              </button>
              <button
                type="button"
                className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 text-sm font-medium text-slate-800"
                onClick={() => setOpen(false)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
