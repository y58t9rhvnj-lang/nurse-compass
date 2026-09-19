"use client";

import type { DirectCardCreateType } from "@/lib/v2/relatedDiagram/cardDirectCreate";
import { EDITOR_TOUCH_TARGET_PX } from "@/lib/v2/relatedDiagram/editorUiState";
import type { ScreenRect } from "@/lib/v2/relatedDiagram/actionPopoverPlacement";
import RelatedDiagramActionPopover from "./RelatedDiagramActionPopover";

export default function RelatedDiagramCardTypeChooser({
  anchor,
  viewport,
  onDismiss,
  onChoose,
}: {
  anchor: ScreenRect;
  viewport: ScreenRect;
  onDismiss: () => void;
  onChoose: (type: DirectCardCreateType) => void;
}) {
  return (
    <RelatedDiagramActionPopover
      kind="card_type"
      anchor={anchor}
      viewport={viewport}
      estimatedSize={{ width: 220, height: 148 }}
      onDismiss={onDismiss}
    >
      <div data-rd-card-type-chooser className="min-w-[196px] px-1 py-1">
        <p className="px-2 pb-1 pt-0.5 text-[13px] text-[#6E6E73]">
          追加するカード
        </p>
        <button
          type="button"
          data-rd-card-type="understanding"
          aria-label="気づき・理解"
          onClick={() => onChoose("understanding")}
          className="flex w-full items-center rounded-xl px-3 text-left text-[14px] text-[#1D1D1F]"
          style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
        >
          気づき・理解
        </button>
        <button
          type="button"
          data-rd-card-type="nursing_problem"
          aria-label="看護問題"
          onClick={() => onChoose("nursing_problem")}
          className="flex w-full items-center rounded-xl px-3 text-left text-[14px] text-[#1D1D1F]"
          style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
        >
          看護問題
        </button>
      </div>
    </RelatedDiagramActionPopover>
  );
}
