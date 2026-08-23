"use client";

/**
 * FormWorkspaceShell — 様式2 / 様式3 共用の集中作業用ワークスペース外枠。
 *
 * C2: ヘッダー + 2ペイン骨格
 * C3: onBack は呼び出し側（患者トップ）。SideNav は触らない（AppShell focusMode）
 * C4: ResizableTwoPane（ユーザー向けレイアウト初期化は設けない）
 */

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import ResizableTwoPane from "@/components/v2/workspace/ResizableTwoPane";
import { useFormWorkspaceWideLayout } from "@/components/v2/workspace/formWorkspaceLayout";

export type { FormWorkspaceKind } from "@/components/v2/workspace/formWorkspaceLayout";
export {
  FORM_WORKSPACE_WIDE_MQ,
  useFormWorkspaceWideLayout,
} from "@/components/v2/workspace/formWorkspaceLayout";

import type { FormWorkspaceKind } from "@/components/v2/workspace/formWorkspaceLayout";

export type FormWorkspaceShellProps = {
  formTitle: string;
  patientName?: string | null;
  onBack?: () => void;
  saveStatus?: ReactNode;
  headerActions?: ReactNode;
  patientReference?: ReactNode;
  patientReferenceSheet?: ReactNode;
  patientReferenceTrigger?: ReactNode;
  workspaceTop?: ReactNode;
  children: ReactNode;
  workspaceKind?: FormWorkspaceKind;
  className?: string;
  patientReferenceLabel?: string;
  workspaceLabel?: string;
};

export default function FormWorkspaceShell({
  formTitle,
  patientName,
  onBack,
  saveStatus,
  headerActions,
  patientReference,
  patientReferenceSheet,
  patientReferenceTrigger,
  workspaceTop,
  children,
  workspaceKind,
  className = "",
  patientReferenceLabel = "患者参照",
  workspaceLabel = "様式作業",
}: FormWorkspaceShellProps) {
  const isWideLayout = useFormWorkspaceWideLayout();

  const workspaceBody = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {workspaceTop ? (
        <div className="no-print shrink-0">{workspaceTop}</div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );

  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#F2F2F7] ${className}`.trim()}
      data-form-workspace-shell=""
      data-workspace-kind={workspaceKind}
      data-focus-mode-candidate={workspaceKind ? "true" : undefined}
    >
      <header
        className="no-print shrink-0 border-b border-[#E5E5EA] bg-white/95 backdrop-blur"
        aria-label="様式ワークスペース"
      >
        <div className="flex min-h-[52px] items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={() => onBack?.()}
            aria-label="戻る"
            className="inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-0.5 rounded-xl px-2 text-[15px] font-semibold text-[#0A6CD6] hover:bg-[#F2F2F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A6CD6]"
          >
            <ChevronLeft className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="pr-1">戻る</span>
          </button>

          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 items-baseline gap-2 overflow-hidden">
              <h1 className="shrink-0 text-[15px] font-semibold tracking-tight text-[#1D1D1F] sm:text-[16px]">
                {formTitle}
              </h1>
              {patientName ? (
                <p
                  className="hidden min-w-0 truncate text-[13px] text-[#6E6E73] sm:block"
                  title={patientName}
                >
                  {patientName}
                </p>
              ) : null}
            </div>
            {patientName ? (
              <p
                className="truncate text-[12px] text-[#6E6E73] sm:hidden"
                title={patientName}
              >
                {patientName}
              </p>
            ) : null}
          </div>

          <div className="flex max-w-[60%] shrink-0 items-center justify-end gap-1.5 overflow-hidden sm:max-w-none sm:gap-2">
            {saveStatus ? (
              <div className="min-w-0 shrink overflow-hidden text-right" aria-live="polite">
                {saveStatus}
              </div>
            ) : null}
            {!isWideLayout && patientReferenceTrigger
              ? patientReferenceTrigger
              : null}
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {headerActions}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {isWideLayout && patientReference != null ? (
        <ResizableTwoPane
          left={patientReference}
          right={workspaceBody}
          leftLabel={patientReferenceLabel}
          rightLabel={workspaceLabel}
        />
      ) : (
        <section
          aria-label={workspaceLabel}
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          data-form-workspace-pane="workspace"
        >
          {workspaceBody}
        </section>
      )}

      {!isWideLayout && patientReferenceSheet != null
        ? patientReferenceSheet
        : null}
    </div>
  );
}
