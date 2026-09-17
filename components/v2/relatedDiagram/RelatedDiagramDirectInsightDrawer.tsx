"use client";

import { useEffect, useRef } from "react";
import type { DirectInsightComposeDraft } from "@/lib/v2/relatedDiagram/cardDirectInsight";
import type { RelatedDiagramCardState } from "@/lib/v2/relatedDiagram/types";
import RelatedDiagramEditorDrawerShell from "./RelatedDiagramEditorDrawerShell";

function isolate(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

export default function RelatedDiagramDirectInsightDrawer({
  draft,
  canAdd,
  onChangeText,
  onChangeState,
  onCancel,
  onAdd,
}: {
  draft: DirectInsightComposeDraft;
  canAdd: boolean;
  onChangeText: (text: string) => void;
  onChangeState: (state: RelatedDiagramCardState) => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  return (
    <RelatedDiagramEditorDrawerShell
      label="新しい気づきを追加"
      testId="direct-insight"
      onClose={onCancel}
      header={
        <h2 className="truncate text-[16px] font-semibold text-[#1D1D1F]">
          新しい気づきを追加
        </h2>
      }
      footer={
        <>
          <button
            type="button"
            data-rd-insight-cancel
            onClick={onCancel}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F]"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-rd-insight-add
            disabled={!canAdd}
            onClick={onAdd}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0A5FCC] px-3 text-[14px] font-medium text-white disabled:bg-[#C7C7CC]"
          >
            関連図に追加
          </button>
        </>
      }
    >
      <div
        data-rd-insight-compose
        className="px-3 py-3"
        onPointerDown={isolate}
        onPointerMove={isolate}
        onPointerUp={isolate}
      >
        <p className="mb-3 text-[13px] text-[#6E6E73]">
          関連図での新しい気づき
        </p>
        <label
          htmlFor="rd-insight-text"
          className="mb-1 block text-[13px] text-[#6E6E73]"
        >
          カードに表示する内容
        </label>
        <textarea
          id="rd-insight-text"
          ref={textRef}
          data-rd-insight-text
          value={draft.text}
          onChange={(event) => onChangeText(event.target.value)}
          onPointerDown={isolate}
          onPointerMove={isolate}
          onPointerUp={isolate}
          rows={6}
          enterKeyHint="done"
          autoComplete="off"
          autoFocus
          className="w-full resize-y rounded-lg border border-[#E5E5EA] px-3 py-3 leading-relaxed text-[#1D1D1F]"
          style={{
            fontSize: 16,
            minHeight: 120,
            userSelect: "text",
            WebkitUserSelect: "text",
            touchAction: "auto",
          }}
        />
        <section className="mt-4">
          <p className="mb-2 text-[13px] text-[#6E6E73]">状態</p>
          <div className="flex gap-2">
            <button
              type="button"
              data-rd-insight-state="current"
              aria-pressed={draft.state === "current"}
              onClick={() => onChangeState("current")}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-[14px] ${
                draft.state === "current"
                  ? "bg-[#1D1D1F] font-medium text-white"
                  : "border border-[#E5E5EA] text-[#1D1D1F]"
              }`}
            >
              顕在
            </button>
            <button
              type="button"
              data-rd-insight-state="potential"
              aria-pressed={draft.state === "potential"}
              onClick={() => onChangeState("potential")}
              className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-[14px] ${
                draft.state === "potential"
                  ? "bg-[#1D1D1F] font-medium text-white"
                  : "border border-[#E5E5EA] text-[#1D1D1F]"
              }`}
            >
              潜在
            </button>
          </div>
        </section>
      </div>
    </RelatedDiagramEditorDrawerShell>
  );
}
