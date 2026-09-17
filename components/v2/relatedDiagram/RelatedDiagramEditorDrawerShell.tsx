"use client";

import type { ReactNode } from "react";
import { EDITOR_DRAWER_WIDTH } from "@/lib/v2/relatedDiagram/editorUiState";

function isolate(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

export default function RelatedDiagramEditorDrawerShell({
  label,
  header,
  footer,
  children,
  onClose,
  testId,
}: {
  label: string;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  testId?: string;
}) {
  return (
    <aside
      data-rd-editor-drawer
      data-rd-editor-drawer-id={testId}
      aria-label={label}
      className="absolute inset-y-0 right-0 z-50 flex flex-col border-l border-[#E5E5EA] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
      style={{
        width: EDITOR_DRAWER_WIDTH,
        touchAction: "pan-y",
        overscrollBehavior: "contain",
      }}
      onPointerDown={isolate}
      onPointerMove={isolate}
      onPointerUp={isolate}
      onWheel={isolate}
    >
      <div
        data-rd-editor-drawer-header
        className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-[#E5E5EA] px-3"
      >
        <div className="min-w-0 flex-1">{header}</div>
        {onClose ? (
          <button
            type="button"
            data-rd-editor-drawer-close
            aria-label={`${label}を閉じる`}
            onClick={onClose}
            className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg border border-[#E5E5EA] text-[18px] text-[#1D1D1F]"
          >
            ×
          </button>
        ) : null}
      </div>
      <div
        data-rd-editor-drawer-body
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
      >
        {children}
      </div>
      {footer ? (
        <div
          data-rd-editor-drawer-footer
          className="flex shrink-0 gap-2 border-t border-[#E5E5EA] px-3 py-2"
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
