"use client";

import { useState } from "react";
import { EDITOR_TOOLBAR_HEIGHT_PX } from "@/lib/v2/relatedDiagram/editorUiState";

function ToolbarSep() {
  return (
    <span
      data-rd-toolbar-sep
      aria-hidden
      className="mx-1 hidden h-6 w-px shrink-0 bg-[#E5E5EA] min-[1280px]:block"
    />
  );
}

export default function RelatedDiagramEditorToolbar({
  percent,
  onReset100,
  onFit,
  onPrint,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  title,
  caseLabel,
  form3Open,
  onOpenForm3,
  onAddCard,
  addCardOpen = false,
  devTitle,
}: {
  percent: number;
  onReset100: () => void;
  onFit: () => void;
  onPrint: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  title: string;
  caseLabel: string;
  form3Open: boolean;
  onOpenForm3: () => void;
  onAddCard: () => void;
  addCardOpen?: boolean;
  devTitle: string;
}) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  const addCard = () => {
    onAddCard();
    setOverflowOpen(false);
  };

  return (
    <header
      data-rd-toolbar
      data-rd-editor-toolbar
      className="rd-no-print relative z-40 w-full min-w-0 shrink-0 border-b border-[#E5E5EA] bg-white"
    >
      <div
        data-rd-toolbar-row
        className="flex w-full min-w-0 max-w-full flex-nowrap items-center gap-2 overflow-hidden px-3 max-[1279px]:gap-1 max-[1279px]:px-2"
        style={{ height: EDITOR_TOOLBAR_HEIGHT_PX }}
      >
        <div
          data-rd-toolbar-left
          className="flex shrink-0 items-center gap-2"
        >
        <button
          type="button"
          data-rd-form3-open
          aria-label="様式3"
          aria-expanded={form3Open}
          onClick={onOpenForm3}
          className="inline-flex h-[44px] min-h-[44px] shrink-0 items-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F] max-[1279px]:px-2"
        >
          様式3
        </button>
        <button
          type="button"
          data-rd-add-card
          aria-label="カードを追加"
          aria-expanded={addCardOpen}
          aria-haspopup="dialog"
          onClick={addCard}
          className="hidden h-[44px] min-h-[44px] shrink-0 items-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F] max-[1279px]:px-2 min-[900px]:inline-flex"
        >
          ＋カード
        </button>
        <ToolbarSep />
        <div data-rd-history-group className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            data-rd-undo
            aria-label="一手戻る"
            disabled={!canUndo}
            onClick={onUndo}
            className="h-[44px] min-h-[44px] min-w-[44px] rounded-lg border border-[#E5E5EA] bg-white text-[16px] text-[#1D1D1F] disabled:opacity-40"
          >
            ↶
          </button>
          <button
            type="button"
            data-rd-redo
            aria-label="一手進む"
            disabled={!canRedo}
            onClick={onRedo}
            className="h-[44px] min-h-[44px] min-w-[44px] rounded-lg border border-[#E5E5EA] bg-white text-[16px] text-[#1D1D1F] disabled:opacity-40"
          >
            ↷
          </button>
        </div>
        </div>
        <div data-rd-toolbar-title className="min-w-0 flex-1 overflow-hidden">
          <h1 className="truncate text-[15px] font-semibold leading-tight text-[#1D1D1F]">
            {title}
            <span className="ml-2 font-normal text-[#6E6E73]">{caseLabel}</span>
          </h1>
        </div>
        <div
          data-rd-toolbar-right
          className="flex shrink-0 items-center gap-2"
        >
        <span
          data-rd-dev-badge
          title={devTitle}
          className="hidden shrink-0 rounded bg-[#F2F2F7] px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-[#6E6E73] min-[1280px]:inline"
        >
          DEV
        </span>
        <ToolbarSep />
        <div
          data-rd-zoom-group
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[#F2F2F7] px-1"
        >
          <span
            data-rd-zoom-percent
            className="px-1 tabular-nums text-[13px] font-medium text-[#1D1D1F]"
            aria-live="polite"
            aria-label={`現在倍率 ${percent}%`}
          >
            {percent}%
          </span>
          <button
            type="button"
            data-rd-zoom-100
            aria-label="実際の100%表示"
            onClick={onReset100}
            className="h-[44px] min-h-[44px] rounded-lg px-3 text-[13px] text-[#1D1D1F] max-[1279px]:px-2"
          >
            100%
          </button>
          <button
            type="button"
            data-rd-zoom-fit
            aria-label="A3全体を画面に合わせる"
            onClick={onFit}
            className="h-[44px] min-h-[44px] rounded-lg bg-[#0A5FCC] px-3 text-[13px] font-medium text-white max-[1279px]:px-2"
          >
            全体表示
          </button>
        </div>
        <button
          type="button"
          data-rd-print
          onClick={onPrint}
          className="hidden h-[44px] min-h-[44px] shrink-0 items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#1D1D1F] max-[1279px]:px-2 min-[900px]:inline-flex"
        >
          印刷
        </button>
        <div className="relative shrink-0 min-[900px]:hidden">
          <button
            type="button"
            data-rd-toolbar-overflow
            aria-label="その他の操作"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((open) => !open)}
            className="inline-flex h-[44px] min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E5E5EA] text-[16px] text-[#1D1D1F]"
          >
            ⋯
          </button>
          {overflowOpen ? (
            <div
              data-rd-toolbar-overflow-menu
              className="absolute right-0 top-[48px] z-50 min-w-[160px] rounded-lg border border-[#E5E5EA] bg-white p-1 shadow-lg"
            >
              <button
                type="button"
                data-rd-add-card
                aria-label="カードを追加"
                aria-expanded={addCardOpen}
                className="flex min-h-[44px] w-full items-center rounded-md px-3 text-left text-[14px] text-[#1D1D1F]"
                onClick={addCard}
              >
                ＋カード
              </button>
              <button
                type="button"
                className="flex min-h-[44px] w-full items-center rounded-md px-3 text-left text-[14px] text-[#1D1D1F]"
                onClick={() => {
                  onPrint();
                  setOverflowOpen(false);
                }}
              >
                印刷
              </button>
            </div>
          ) : null}
        </div>
        </div>
      </div>
    </header>
  );
}
