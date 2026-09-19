"use client";

import type { ContextBarModel } from "@/lib/v2/relatedDiagram/editorContextBar";
import { visibleContextActions } from "@/lib/v2/relatedDiagram/editorContextBar";
import { EDITOR_TOUCH_TARGET_PX } from "@/lib/v2/relatedDiagram/editorUiState";

function isolateSinglePointer(event: {
  pointerType?: string;
  isPrimary?: boolean;
  stopPropagation(): void;
}) {
  if (event.pointerType === "touch" && event.isPrimary === false) return;
  event.stopPropagation();
}

function ContextButton({
  action,
  label,
  danger,
  title,
  description,
  onClick,
}: {
  action: string;
  label: string;
  danger?: boolean;
  title?: string;
  description?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-rd-context-action={action}
      aria-label={label}
      aria-description={description}
      title={title}
      onClick={onClick}
      className={`inline-flex h-[44px] min-h-[44px] shrink-0 items-center rounded-xl px-3 text-[13px] ${
        danger ? "text-[#C41E3A]" : "text-[#1D1D1F]"
      }`}
      style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
    >
      {label}
    </button>
  );
}

export default function RelatedDiagramContextBar({
  model,
  onEdit,
  onConnect,
  onDelete,
  onOpenSource,
  onCancelConnect,
}: {
  model: ContextBarModel;
  onEdit?: () => void;
  onConnect?: () => void;
  onDelete?: () => void;
  onOpenSource?: () => void;
  onCancelConnect?: () => void;
}) {
  if (model.kind === "none") return null;

  if (model.kind === "connecting") {
    return (
      <div
        data-rd-context-bar
        data-rd-context-kind="connecting"
        data-rd-connecting-hint
        className="pointer-events-auto flex max-w-[min(420px,calc(100vw-24px))] items-center gap-2 rounded-[18px] border border-black/[0.06] bg-white/80 px-3 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-xl"
        onPointerDown={isolateSinglePointer}
        onPointerMove={isolateSinglePointer}
        onPointerUp={isolateSinglePointer}
      >
        <p
          data-rd-connect-source
          className="min-w-0 flex-1 truncate text-[13px] text-[#1D1D1F]"
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={model.sourceTitle}
        >
          <span className="text-[#6E6E73]">接続元：</span>
          {model.sourceTitle}
        </p>
        <span
          data-rd-connect-hint
          className="shrink-0 text-[13px] text-[#6E6E73]"
        >
          接続先のカードを選択
        </span>
        <ContextButton
          action="connect-cancel"
          label="キャンセル"
          onClick={() => onCancelConnect?.()}
        />
      </div>
    );
  }

  if (model.kind === "connection") {
    return (
      <div
        data-rd-context-bar
        data-rd-context-kind="connection"
        className="px-2 text-[13px] text-[#1D1D1F]"
      >
        選択：接続
      </div>
    );
  }

  const actions = visibleContextActions(
    model.capabilities,
    model.canOpenSource,
  );

  return (
    <div
      data-rd-context-bar
      data-rd-context-kind="card"
      data-rd-card-action-bar="true"
      className="flex flex-nowrap items-center gap-0.5"
      onPointerDown={isolateSinglePointer}
      onPointerMove={isolateSinglePointer}
      onPointerUp={isolateSinglePointer}
    >
      {actions.includes("edit") ? (
        <ContextButton
          action="edit"
          label="編集"
          title={model.editDisabledReason ?? undefined}
          description={model.editDisabledReason ?? undefined}
          onClick={() => onEdit?.()}
        />
      ) : null}
      {actions.includes("connect") ? (
        <ContextButton
          action="connect"
          label="つなぐ"
          onClick={() => onConnect?.()}
        />
      ) : null}
      {actions.includes("delete") ? (
        <ContextButton
          action="delete"
          label="削除"
          danger
          onClick={() => onDelete?.()}
        />
      ) : null}
      {model.canOpenSource ? (
        <ContextButton
          action="source"
          label="元データ"
          onClick={() => onOpenSource?.()}
        />
      ) : null}
    </div>
  );
}
