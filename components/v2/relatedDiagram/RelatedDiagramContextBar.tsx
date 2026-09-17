"use client";

import type { ContextBarModel } from "@/lib/v2/relatedDiagram/editorContextBar";
import { EDITOR_CONTEXT_BAR_HEIGHT_PX } from "@/lib/v2/relatedDiagram/editorUiState";

function isolate(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

function ContextButton({
  action,
  label,
  disabled,
  pressed,
  danger,
  title,
  description,
  onClick,
}: {
  action: string;
  label: string;
  disabled?: boolean;
  pressed?: boolean;
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
      aria-disabled={disabled === true}
      aria-pressed={pressed}
      aria-description={description}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-[44px] min-h-[44px] shrink-0 items-center rounded-lg border px-3 text-[13px] ${
        danger
          ? "border-[#C41E3A] text-[#C41E3A]"
          : "border-[#E5E5EA] text-[#1D1D1F]"
      } disabled:opacity-40`}
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

  return (
    <div
      data-rd-context-bar
      data-rd-context-kind={model.kind}
      data-rd-card-action-bar={model.kind === "card" ? "true" : undefined}
      className="flex shrink-0 flex-nowrap items-center gap-2 overflow-hidden border-b border-[#E5E5EA] bg-white px-3"
      style={{ height: EDITOR_CONTEXT_BAR_HEIGHT_PX }}
      onPointerDown={isolate}
      onPointerMove={isolate}
      onPointerUp={isolate}
    >
      {model.kind === "connecting" ? (
        <>
          <p
            data-rd-connect-source
            className="min-w-0 flex-1 text-[13px] text-[#1D1D1F]"
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
            ｜ 接続先のカードをタップ
          </span>
          <ContextButton
            action="connect-cancel"
            label="キャンセル"
            onClick={() => onCancelConnect?.()}
          />
        </>
      ) : model.kind === "connection" ? (
        <p className="min-w-0 flex-1 truncate text-[13px] text-[#1D1D1F]">
          選択：接続
        </p>
      ) : (
        <>
          <p
            data-rd-context-title
            className="min-w-0 flex-1 truncate text-[13px] text-[#1D1D1F]"
            title={model.title}
          >
            <span className="text-[#6E6E73]">選択：</span>
            {model.title}
          </p>
          <ContextButton
            action="edit"
            label="編集"
            disabled={!model.capabilities.canEdit}
            title={model.editDisabledReason ?? undefined}
            description={model.editDisabledReason ?? undefined}
            onClick={() => onEdit?.()}
          />
          <ContextButton
            action="connect"
            label="つなぐ"
            onClick={() => onConnect?.()}
          />
          <ContextButton
            action="delete"
            label="削除"
            danger
            onClick={() => onDelete?.()}
          />
          {model.canOpenSource ? (
            <ContextButton
              action="source"
              label="元データ"
              onClick={() => onOpenSource?.()}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
