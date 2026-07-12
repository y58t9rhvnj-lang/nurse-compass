"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatDataTimestamp } from "@/lib/organization/informationDisplay";

export type CollectionDialogMode = "add" | "edit";

// 共通収集ダイアログ。患者発言・一時メモの収集、および収集データの内容修正で共用する。
//   - 元データ（originalText）は常に読み取り専用で確認できる。
//   - 「保存する内容（content）」だけを編集し、空文字では確定できない。
//   - 出典（sourceLabel）と日時は表示のみ（変更不可）。
// iPad Safari でソフトウェアキーボード表示時も操作できるよう、
// 縦スクロール可能・フッター（操作ボタン）が本文と一緒にスクロールする構成にする。
export default function CollectionDialog({
  open,
  mode = "add",
  originalText,
  initialContent,
  sourceLabel,
  timestamp,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  mode?: CollectionDialogMode;
  originalText: string;
  initialContent: string;
  sourceLabel: string;
  timestamp?: string | null;
  onCancel: () => void;
  onConfirm: (content: string) => void;
}) {
  // 初期値は mount 時に確定する。呼び出し側は対象ごとに key を変えて remount し、
  // 開き直しのたびに確実に初期値へ戻るようにする（effect での setState を避ける）。
  const [content, setContent] = useState(initialContent);
  // 二重送信防止（連打・キーボード確定の重複を防ぐ）。
  const submittingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const originalId = useId();

  // 開いたらテキストエリアへフォーカス（編集をすぐ始められる）。
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const handleConfirm = useCallback(() => {
    if (submittingRef.current) return;
    const trimmed = content.trim();
    if (trimmed === "") return;
    submittingRef.current = true;
    onConfirm(trimmed);
  }, [content, onConfirm]);

  // Esc でキャンセル。
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const canConfirm = content.trim() !== "";
  const ts = formatDataTimestamp(timestamp);
  const title = mode === "edit" ? "収集データを修正" : "収集データへ追加";
  const confirmLabel = mode === "edit" ? "保存" : "追加";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 p-3 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        // 背景タップで閉じる（内容は保存しない）。パネル内クリックは無視。
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="my-auto flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        {/* ヘッダー（固定） */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#EFEFF2] px-5 py-3.5">
          <h2 id={titleId} className="text-[15px] font-bold text-[#1D1D1F]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-[#8E8E93] transition hover:bg-[#F2F2F5]"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>

        {/* 本文（縦スクロール） */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* セクション1：元データ（読み取り専用） */}
          <section>
            <label
              htmlFor={originalId}
              className="mb-1.5 block text-[12px] font-semibold text-[#6E6E73]"
            >
              元データ
            </label>
            <div
              id={originalId}
              className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-[#EBEBF0] bg-[#F7F7F9] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#3A3A3C]"
            >
              {originalText}
            </div>
          </section>

          {/* セクション2：保存する内容（編集可能） */}
          <section>
            <label
              htmlFor={`${titleId}-content`}
              className="mb-1.5 block text-[12px] font-semibold text-[#6E6E73]"
            >
              保存する内容
            </label>
            <textarea
              id={`${titleId}-content`}
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="収集データとして残す内容を入力してください"
              className="w-full resize-none rounded-2xl border border-[#E5E5EA] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1D1D1F] outline-none transition focus:border-[#0A84FF] focus:ring-2 focus:ring-[#0A84FF]/20"
            />
            <p className="mt-1 text-[11px] text-[#AEAEB5]">
              元データは変更されません。必要なら短く整えられます。
            </p>
          </section>

          {/* セクション3：出典（表示のみ） */}
          <section>
            <h3 className="mb-1.5 text-[12px] font-semibold text-[#6E6E73]">
              出典
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#3A3A3C]">
              <span className="inline-flex items-center rounded-full bg-[#EAF3FF] px-2.5 py-0.5 font-medium text-[#0A6CD6]">
                {sourceLabel}
              </span>
              {ts && <span className="text-[#8E8E93]">{ts}</span>}
            </div>
          </section>
        </div>

        {/* フッター（操作） */}
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#EFEFF2] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex min-h-[44px] items-center rounded-full px-5 text-[13px] font-medium text-[#6E6E73] transition hover:bg-[#F2F2F5]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={[
              "flex min-h-[44px] items-center rounded-full px-6 text-[13px] font-semibold transition",
              canConfirm
                ? "bg-[#0A84FF] text-white hover:bg-[#0A6CD6]"
                : "cursor-not-allowed bg-[#E5E5EA] text-[#AEAEB5]",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
