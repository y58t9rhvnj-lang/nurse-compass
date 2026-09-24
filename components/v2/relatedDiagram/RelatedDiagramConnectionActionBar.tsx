"use client";

import {
  STUDENT_CONNECTION_RELATION_LABELS,
  isStudentConnectionRelation,
  type StudentConnectionRelation,
} from "@/lib/v2/relatedDiagram/cardConnectionCreate";
import {
  PROTECTED_CONNECTION_NOTICE,
  connectionHasManageActions,
  type ConnectionPermissions,
} from "@/lib/v2/relatedDiagram/cardConnectionManage";
import { EDITOR_TOUCH_TARGET_PX } from "@/lib/v2/relatedDiagram/editorUiState";
import type { RelatedDiagramConnectionRelationType } from "@/lib/v2/relatedDiagram/types";

function isolateSinglePointer(event: {
  pointerType?: string;
  isPrimary?: boolean;
  stopPropagation(): void;
}) {
  if (event.pointerType === "touch" && event.isPrimary === false) return;
  event.stopPropagation();
}

export default function RelatedDiagramConnectionActionBar({
  relation,
  permissions,
  onChangeRelation,
  onReverse,
  onDelete,
  onResetAuto,
  onBeginRouteTrace,
}: {
  relation: RelatedDiagramConnectionRelationType;
  permissions: ConnectionPermissions;
  onChangeRelation?: (relation: StudentConnectionRelation) => void;
  onReverse?: () => void;
  onDelete?: () => void;
  onResetAuto?: () => void;
  onBeginRouteTrace?: () => void;
}) {
  const showRelation =
    permissions.relationEditable && isStudentConnectionRelation(relation);
  const protectedNotice =
    !connectionHasManageActions(permissions) &&
    !onResetAuto &&
    !onBeginRouteTrace;

  return (
    <div
      data-rd-connection-action-bar
      data-rd-connection-protected={protectedNotice ? "true" : "false"}
      data-rd-connection-relation-editable={
        permissions.relationEditable ? "true" : "false"
      }
      data-rd-connection-reversible={permissions.reversible ? "true" : "false"}
      data-rd-connection-deletable={permissions.deletable ? "true" : "false"}
      className="rd-no-print min-w-[240px] px-1 pb-0.5 pt-0.5"
      onPointerDown={isolateSinglePointer}
      onPointerMove={isolateSinglePointer}
      onPointerUp={isolateSinglePointer}
    >
      {protectedNotice ? (
        <p
          data-rd-connection-protected-notice
          className="px-2 py-2 text-[13px] leading-snug text-[#6E6E73]"
        >
          {PROTECTED_CONNECTION_NOTICE}
        </p>
      ) : null}
      {showRelation ? (
        <>
          <p className="text-[12px] text-[#6E6E73]">関係</p>
          <div
            data-rd-connection-relation-segments
            className="mt-2 flex overflow-hidden rounded-xl bg-[#EFEFF2]"
          >
            {(
              Object.entries(STUDENT_CONNECTION_RELATION_LABELS) as Array<
                [StudentConnectionRelation, string]
              >
            ).map(([value, label]) => {
              const selected = value === relation;
              return (
                <button
                  key={value}
                  type="button"
                  data-rd-connection-relation-choice={value}
                  data-rd-connection-relation-selected={
                    selected ? "true" : "false"
                  }
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => onChangeRelation?.(value)}
                  className={`inline-flex min-h-[44px] flex-1 items-center justify-center px-2 text-[14px] ${
                    selected
                      ? "bg-white font-medium text-[#1D1D1F]"
                      : "text-[#1D1D1F]"
                  }`}
                  style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
      {onBeginRouteTrace ? (
        <button
          type="button"
          data-rd-connection-action="trace-route"
          aria-label="ルートを描く"
          onClick={() => onBeginRouteTrace()}
          className="mt-1 inline-flex min-h-[44px] w-full items-center justify-center text-[14px] text-[#1D1D1F]"
          style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
        >
          ルートを描く
        </button>
      ) : null}
      {permissions.reversible ? (
        <button
          type="button"
          data-rd-connection-action="reverse"
          aria-label="向きを反転"
          onClick={() => onReverse?.()}
          className="mt-1 inline-flex min-h-[44px] w-full items-center justify-center text-[14px] text-[#1D1D1F]"
          style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
        >
          向きを反転
        </button>
      ) : null}
      {onResetAuto ? (
        <button
          type="button"
          data-rd-connection-action="reset-auto"
          aria-label="自動に戻す"
          onClick={() => onResetAuto()}
          className="mt-1 inline-flex min-h-[44px] w-full items-center justify-center text-[14px] text-[#1D1D1F]"
          style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
        >
          自動に戻す
        </button>
      ) : null}
      {permissions.deletable ? (
        <button
          type="button"
          data-rd-connection-action="delete"
          aria-label="削除"
          onClick={() => onDelete?.()}
          className="inline-flex min-h-[44px] w-full items-center justify-center text-[14px] text-[#C41E3A]"
          style={{ minHeight: EDITOR_TOUCH_TARGET_PX }}
        >
          削除
        </button>
      ) : null}
    </div>
  );
}
