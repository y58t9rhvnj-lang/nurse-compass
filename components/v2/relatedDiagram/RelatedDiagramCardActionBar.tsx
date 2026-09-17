"use client";

import type { CardActionCapabilities } from "@/lib/v2/relatedDiagram/cardActionCapabilities";

function isolateActionBar(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

export default function RelatedDiagramCardActionBar({
  title,
  capabilities,
  connectPending,
  notice,
  onEdit,
  onConnect,
  onDelete,
}: {
  title: string;
  capabilities: CardActionCapabilities;
  connectPending?: boolean;
  notice?: string | null;
  onEdit: () => void;
  onConnect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-rd-card-action-bar
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#E5E5EA] bg-white px-3 py-2"
      onPointerDown={isolateActionBar}
      onPointerMove={isolateActionBar}
      onPointerUp={isolateActionBar}
    >
      <p className="min-w-0 flex-1 truncate text-[13px] text-[#1D1D1F]">
        <span className="text-[#6E6E73]">選択中：</span>
        {title}
      </p>
      <button
        type="button"
        data-rd-card-action="edit"
        aria-label="カードを編集"
        disabled={!capabilities.canEdit}
        onClick={onEdit}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#1D1D1F] disabled:opacity-40"
      >
        編集
      </button>
      <button
        type="button"
        data-rd-card-action="connect"
        aria-label="カードをつなぐ"
        aria-pressed={connectPending === true}
        disabled={!capabilities.canConnect}
        onClick={onConnect}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#1D1D1F] disabled:opacity-40"
      >
        つなぐ
      </button>
      <button
        type="button"
        data-rd-card-action="delete"
        aria-label="カードを削除"
        disabled={!capabilities.canDelete}
        onClick={onDelete}
        className="inline-flex min-h-[44px] items-center rounded-lg border border-[#E5E5EA] px-3 text-[13px] text-[#1D1D1F] disabled:opacity-40"
      >
        削除
      </button>
      {!capabilities.canEdit && capabilities.editMode === "forbidden_original" ? (
        <p
          data-rd-card-action-edit-hint
          className="basis-full text-[12px] text-[#6E6E73]"
        >
          様式3の情報は原文のまま使用します
        </p>
      ) : null}
      {notice ? (
        <p
          data-rd-card-action-notice
          className="basis-full text-[12px] text-[#6E6E73]"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
