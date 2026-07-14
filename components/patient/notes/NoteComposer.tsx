"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";

// 新規メモ入力。自由記述のみ（カテゴリ分類は今回対象外）。
// Compass の問いから誘導された場合は、文脈バナーを表示し textarea をフォーカスする。
// 問い文は本文にプリフィルせず、学生が自分の言葉で記述できるようにする。
export default function NoteComposer({
  onSubmit,
  contextQuestion,
  contextToken,
  onClearContext,
}: {
  onSubmit: (text: string) => void;
  contextQuestion?: string | null;
  contextToken?: number;
  onClearContext?: () => void;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSubmit = text.trim().length > 0;

  useEffect(() => {
    // 問い選択（token 変化）時に textarea をフォーカス。
    // スクロールは NoteZone 側が担うため preventScroll で競合を避ける。
    if (contextToken === undefined) return;
    textareaRef.current?.focus({ preventScroll: true });
  }, [contextToken]);

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(text);
    setText("");
    onClearContext?.();
  };

  return (
    <div className="rounded-2xl border border-[#EBEBF0] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {contextQuestion && (
        <div className="mb-2 flex items-start gap-2 rounded-xl border border-[#E4DAF7] bg-[#F7F2FF] px-3 py-2">
          <Sparkles
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#AF52DE]"
            strokeWidth={2}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-[#AF52DE]">
              この問いについて
            </p>
            <p className="text-[12px] leading-relaxed text-[#4A3A66]">
              {contextQuestion}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClearContext?.()}
            aria-label="問いの文脈を解除"
            className="-my-2 -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[#AF52DE] hover:bg-[#EFE3FB]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // ⌘/Ctrl + Enter で保存
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="この人について気づいたこと・疑問に思ったことを残しましょう"
        className="w-full resize-none rounded-xl bg-[#F7F7F9] px-3 py-2.5 text-[13px] leading-relaxed text-[#1D1D1F] placeholder:text-[#AEAEB5] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/30"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-[#C7C7CC]">⌘ + Enter で保存</span>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={[
            "flex min-h-[44px] items-center gap-1 rounded-xl px-4 py-2 text-[13px] font-semibold transition",
            canSubmit
              ? "bg-[#0A84FF] text-white hover:bg-[#0A6CD6]"
              : "cursor-not-allowed bg-[#E5E5EA] text-[#AEAEB5]",
          ].join(" ")}
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          メモを追加
        </button>
      </div>
    </div>
  );
}
