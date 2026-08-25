"use client";

import { useState, useTransition } from "react";
import {
  importAiEvaluationResultAction,
  previewAiEvaluationImportAction,
  type AiEvaluationImportPreview,
} from "@/app/v2/actions/assessmentAiEvaluationImport";

type Props = {
  buttonLabel?: string;
  className?: string;
};

function statusLabel(s: AiEvaluationImportPreview["validationStatus"]): string {
  if (s === "ok") return "有効";
  if (s === "warning") return "警告あり";
  return "無効";
}

export default function TeacherAiEvaluationImportDialog({
  buttonLabel = "AI評価結果を取込",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiEvaluationImportPreview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setFileName(null);
    setJsonText(null);
    setPreview(null);
    setError(null);
    setResultMsg(null);
    setConfirmChecked(false);
  };

  const openDialog = () => {
    reset();
    setOpen(true);
  };

  const onFile = (file: File | null) => {
    setError(null);
    setPreview(null);
    setResultMsg(null);
    setConfirmChecked(false);
    if (!file) {
      setFileName(null);
      setJsonText(null);
      return;
    }
    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("初期版は .json ファイル1件のみです（JSONL は次Sprint）。");
      setFileName(null);
      setJsonText(null);
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setJsonText(text);
      startTransition(async () => {
        const res = await previewAiEvaluationImportAction({
          fileName: file.name,
          jsonText: text,
        });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setPreview(res.preview);
      });
    };
    reader.onerror = () => {
      setError("ファイルを読み取れませんでした。");
    };
    reader.readAsText(file, "utf-8");
  };

  const onImport = () => {
    if (!jsonText || !fileName || !preview || !confirmChecked) return;
    setError(null);
    startTransition(async () => {
      const res = await importAiEvaluationResultAction({
        fileName,
        jsonText,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setResultMsg(
        `取込完了: staging=${res.stagingId} / 状態=${res.reviewStatus} / 検証=${res.validationStatus}` +
          (res.supersededCount > 0
            ? ` / 旧候補 ${res.supersededCount} 件を superseded`
            : ""),
      );
      if (!res.auditLogged) {
        setError(
          "取込は保存されましたが、監査ログの記録に失敗しました（service role を確認してください）。",
        );
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
            aria-labelledby="ai-eval-import-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-5"
          >
            <h2
              id="ai-eval-import-title"
              className="text-base font-semibold text-slate-900"
            >
              AI評価結果の取込
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              1ファイル = 1 result（JSON）。採用・review 反映はこの画面では行いません。
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-800">
                JSON ファイル
                <input
                  type="file"
                  accept="application/json,.json"
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {fileName ? (
                <p className="text-sm text-slate-700">
                  ファイル: <span className="font-medium">{fileName}</span>
                  （件数: 1）
                </p>
              ) : null}

              {preview ? (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p>
                    検証結果:{" "}
                    <span className="font-semibold">
                      {statusLabel(preview.validationStatus)}
                    </span>
                    {" / "}
                    取込後状態:{" "}
                    <span className="font-semibold">{preview.reviewStatus}</span>
                  </p>
                  <p className="break-all text-xs text-slate-600">
                    evaluation_request_id:{" "}
                    {preview.evaluationRequestId ?? "（なし）"}
                  </p>
                  <p className="text-xs text-slate-600">
                    request:{" "}
                    {preview.requestFound
                      ? preview.requestExpired
                        ? "見つかりました（期限切れ）"
                        : "見つかりました"
                      : "見つかりません"}
                  </p>
                  {preview.errors.length > 0 ? (
                    <div>
                      <p className="font-medium text-rose-800">無効理由</p>
                      <ul className="mt-1 list-disc pl-5 text-rose-900">
                        {preview.errors.map((e) => (
                          <li key={`${e.code}-${e.path ?? ""}`}>
                            [{e.code}] {e.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {preview.versionWarnings.length > 0 ? (
                    <div>
                      <p className="font-medium text-amber-900">version 警告</p>
                      <ul className="mt-1 list-disc pl-5 text-amber-950">
                        {preview.versionWarnings.map((w) => (
                          <li key={`${w.code}-${w.payload_hash}`}>
                            [{w.code}] {w.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {preview.piiWarnings.length > 0 ? (
                    <div>
                      <p className="font-medium text-amber-900">PII 警告</p>
                      <ul className="mt-1 list-disc pl-5 text-amber-950">
                        {preview.piiWarnings.map((w) => (
                          <li key={`${w.code}-${w.payload_hash}`}>
                            [{w.code}] {w.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {preview ? (
                <label className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                  />
                  <span>
                    内容を確認し、staging へ取り込みます（assessment_reviews
                    へは反映しません）。
                  </span>
                </label>
              ) : null}

              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                  {error}
                </p>
              ) : null}
              {resultMsg ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                  {resultMsg}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={pending}
              >
                閉じる
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                disabled={
                  pending ||
                  !preview ||
                  !confirmChecked ||
                  !jsonText ||
                  !!resultMsg
                }
                onClick={onImport}
              >
                {pending ? "処理中…" : "取り込む"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
