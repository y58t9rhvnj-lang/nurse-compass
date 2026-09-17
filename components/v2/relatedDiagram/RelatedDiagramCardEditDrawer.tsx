"use client";

import { useEffect, useRef } from "react";
import type { CardEditMode } from "@/lib/v2/relatedDiagram/cardActionCapabilities";
import type { CardEditDraft } from "@/lib/v2/relatedDiagram/cardEdit";
import type { RelatedDiagramCardState } from "@/lib/v2/relatedDiagram/types";
import RelatedDiagramEditorDrawerShell from "./RelatedDiagramEditorDrawerShell";

function isolate(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

export default function RelatedDiagramCardEditDrawer({
  editMode,
  draft,
  canSave,
  onChangeText,
  onChangeState,
  onCancel,
  onSave,
}: {
  editMode: CardEditMode;
  draft: CardEditDraft;
  canSave: boolean;
  onChangeText: (text: string) => void;
  onChangeState: (state: RelatedDiagramCardState) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const showState = editMode === "card_text_and_state";
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  return (
    <RelatedDiagramEditorDrawerShell
      label="カードを編集"
      testId="card-edit"
      onClose={onCancel}
      header={
        <h2 className="truncate text-[16px] font-semibold text-[#1D1D1F]">
          カードを編集
        </h2>
      }
      footer={
        <>
          <button
            type="button"
            data-rd-card-edit-cancel
            onClick={onCancel}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F]"
          >
            キャンセル
          </button>
          <button
            type="button"
            data-rd-card-edit-save
            disabled={!canSave}
            onClick={onSave}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0A5FCC] px-3 text-[14px] font-medium text-white disabled:bg-[#C7C7CC]"
          >
            変更を保存
          </button>
        </>
      }
    >
      <div
        data-rd-card-edit-drawer
        className="px-3 py-3"
        onPointerDown={isolate}
        onPointerMove={isolate}
        onPointerUp={isolate}
      >
        <label
          htmlFor="rd-card-edit-text"
          className="mb-1 block text-[13px] text-[#6E6E73]"
        >
          カードに表示する内容
        </label>
        <textarea
          id="rd-card-edit-text"
          ref={textRef}
          data-rd-card-edit-text
          value={draft.text}
          onChange={(event) => onChangeText(event.target.value)}
          onPointerDown={isolate}
          onPointerMove={isolate}
          onPointerUp={isolate}
          rows={6}
          enterKeyHint="done"
          autoComplete="off"
          className="w-full resize-y rounded-lg border border-[#E5E5EA] px-3 py-3 leading-relaxed text-[#1D1D1F]"
          style={{
            fontSize: 16,
            minHeight: 120,
            userSelect: "text",
            WebkitUserSelect: "text",
            touchAction: "auto",
          }}
        />
        {showState ? (
          <section className="mt-4">
            <p className="mb-2 text-[13px] text-[#6E6E73]">状態</p>
            <div className="flex gap-2">
              <button
                type="button"
                data-rd-card-edit-state="current"
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
                data-rd-card-edit-state="potential"
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
        ) : null}
      </div>
    </RelatedDiagramEditorDrawerShell>
  );
}
