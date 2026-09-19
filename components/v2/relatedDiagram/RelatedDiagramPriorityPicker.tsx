"use client";

import { EDITOR_TOUCH_TARGET_PX } from "@/lib/v2/relatedDiagram/editorUiState";
import type { NursingProblemPriorityPickerOption } from "@/lib/v2/relatedDiagram/nursingProblemPriorityUi";

function isolateSinglePointer(event: {
  pointerType?: string;
  isPrimary?: boolean;
  stopPropagation(): void;
}) {
  if (event.pointerType === "touch" && event.isPrimary === false) return;
  event.stopPropagation();
}

export default function RelatedDiagramPriorityPicker({
  options,
  onSelect,
}: {
  options: NursingProblemPriorityPickerOption[];
  onSelect: (priority: number | null) => void;
}) {
  return (
    <div
      data-rd-priority-picker
      className="rd-no-print flex w-[200px] flex-col"
      onPointerDown={isolateSinglePointer}
      onPointerMove={isolateSinglePointer}
      onPointerUp={isolateSinglePointer}
    >
      <p className="px-3 py-1 text-[12px] text-[#6E6E73]">優先順位</p>
      <div
        data-rd-priority-picker-scroll
        className="min-h-0 max-h-[min(320px,calc(100dvh-48px))] overflow-y-auto overscroll-contain"
      >
        {options.map((option) => (
          <button
            key={option.priority ?? "unset"}
            type="button"
            data-rd-priority-option={
              option.priority == null ? "unset" : String(option.priority)
            }
            data-rd-priority-selected={option.selected ? "true" : undefined}
            aria-pressed={option.selected}
            aria-label={option.label}
            className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 text-left text-[13px] text-[#1D1D1F]"
            style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
            onClick={() => onSelect(option.priority)}
          >
            <span
              data-rd-priority-check
              className="inline-flex w-4 shrink-0 text-[#0A5FCC]"
              aria-hidden
            >
              {option.selected ? "✓" : ""}
            </span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
