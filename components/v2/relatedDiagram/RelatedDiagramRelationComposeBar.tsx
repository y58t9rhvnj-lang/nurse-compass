"use client";

import {
  STUDENT_CONNECTION_RELATION_LABELS,
  type StudentConnectionRelation,
} from "@/lib/v2/relatedDiagram/cardConnectionCreate";
import { EDITOR_TOUCH_TARGET_PX } from "@/lib/v2/relatedDiagram/editorUiState";

function isolateSinglePointer(event: {
  pointerType?: string;
  isPrimary?: boolean;
  stopPropagation(): void;
}) {
  if (event.pointerType === "touch" && event.isPrimary === false) return;
  event.stopPropagation();
}

export default function RelatedDiagramRelationComposeBar({
  sourceTitle,
  targetTitle,
  onChooseRelation,
  onCancel,
}: {
  sourceTitle: string;
  targetTitle: string;
  onChooseRelation: (relation: StudentConnectionRelation) => void;
  onCancel: () => void;
}) {
  return (
    <div
      data-rd-relation-compose
      data-rd-context-kind="relation_compose"
      className="min-w-[240px] px-1 pb-0.5 pt-0.5"
      onPointerDown={isolateSinglePointer}
      onPointerMove={isolateSinglePointer}
      onPointerUp={isolateSinglePointer}
    >
      <p
        data-rd-relation-pair
        className="line-clamp-2 min-w-0 text-[13px] leading-snug text-[#1D1D1F]"
        title={`${sourceTitle} → ${targetTitle}`}
      >
        「{sourceTitle}」→「{targetTitle}」
      </p>
      <p className="mt-1 text-[12px] text-[#6E6E73]">この関係は？</p>
      <div
        data-rd-relation-segments
        className="mt-2 flex overflow-hidden rounded-xl bg-[#EFEFF2]"
      >
        {(
          Object.entries(STUDENT_CONNECTION_RELATION_LABELS) as Array<
            [StudentConnectionRelation, string]
          >
        ).map(([relation, label]) => (
          <button
            key={relation}
            type="button"
            data-rd-relation-choice={relation}
            aria-label={label}
            onClick={() => onChooseRelation(relation)}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center px-2 text-[14px] text-[#1D1D1F]"
            style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        data-rd-relation-cancel
        aria-label="キャンセル"
        onClick={onCancel}
        className="mt-1 inline-flex min-h-[44px] w-full items-center justify-center text-[13px] text-[#6E6E73]"
        style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
      >
        キャンセル
      </button>
    </div>
  );
}
