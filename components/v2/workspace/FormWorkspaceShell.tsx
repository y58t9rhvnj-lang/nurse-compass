"use client";

/**
 * FormWorkspaceShell — 様式2 / 様式3 共用の集中作業用ワークスペース外枠（Phase C2）。
 *
 * 責務:
 *   - 共通ヘッダー（戻る / 様式名 / 患者名 / 保存状態 slot / 操作 slot）
 *   - 左: 患者参照 / 右: 作業領域（固定比率。Resizable は C4）
 *   - 狭幅: 患者参照は Sheet slot（二重 mount しない）
 *   - min-w-0 / overflow でページ横スクロールを抑制
 *
 * 非責務（持ち込まない）:
 *   - Form2/Form3 保存・Autosave・印刷・提出・Final 契約
 *   - SideNav の表示制御（C3 focusMode。本 Shell は DOM/CSS で隠さない）
 */

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { ChevronLeft } from "lucide-react";

/** Tailwind `lg`（1024px）。R1 と同じ幅ベース切替。 */
export const FORM_WORKSPACE_WIDE_MQ = "(min-width: 1024px)";

/** C3 準備: AppShell が focusMode 判定に使う様式識別。Shell 自身は SideNav を触らない。 */
export type FormWorkspaceKind = "form2" | "form3";

export type FormWorkspaceShellProps = {
  /** 様式名（例: 「様式3」） */
  formTitle: string;
  /** 患者表示名。長い場合は truncate */
  patientName?: string | null;
  /** 戻る。遷移先は呼び出し側が決める（C3 で患者トップ統一）。Shell は history に依存しない。 */
  onBack?: () => void;
  /** 保存状態表示（READY / DRAFT / SAVING / SAVED / SAVE FAILED / CONFLICT 等）。Autosave は呼ばない。 */
  saveStatus?: ReactNode;
  /** ヘッダー右の操作（様式表示・印刷など）。Shell は意味を知らない。 */
  headerActions?: ReactNode;
  /**
   * 広幅時の左ペイン内容。
   * 狭幅では描画しない（Sheet と二重 mount しない）。
   */
  patientReference?: ReactNode;
  /**
   * 狭幅時のみ描画する Sheet。開閉 state は呼び出し側。
   * 広幅では描画しない。
   */
  patientReferenceSheet?: ReactNode;
  /**
   * 狭幅ヘッダー用。例: 「患者参照」ボタン。
   * 広幅では出さない。
   */
  patientReferenceTrigger?: ReactNode;
  /**
   * 右ペイン上部（スクロール外）。例: Gordon Pattern タブバー。
   */
  workspaceTop?: ReactNode;
  /** 右作業領域の本体 */
  children: ReactNode;
  /** C3 準備用。data 属性として付与するのみ。 */
  workspaceKind?: FormWorkspaceKind;
  className?: string;
  /** 左ペイン aria-label */
  patientReferenceLabel?: string;
  /** 右ペイン aria-label */
  workspaceLabel?: string;
};

function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(FORM_WORKSPACE_WIDE_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getWideSnapshot() {
  return window.matchMedia(FORM_WORKSPACE_WIDE_MQ).matches;
}

function getWideServerSnapshot() {
  return true;
}

/** R1 と同じ lg 判定。Sheet 二重 mount 回避のため呼び出し側でも利用可。 */
export function useFormWorkspaceWideLayout(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    getWideSnapshot,
    getWideServerSnapshot,
  );
}

/**
 * 様式作業の共通外枠。
 * 中央に C4 の Resizable separator を差し込める DOM（left | gap | right）。
 */
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
        <div className="flex min-h-[52px] items-center gap-2 px-2 py-1.5 sm:gap-3 sm:px-3">
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

          <div className="flex max-w-[55%] shrink-0 items-center justify-end gap-1.5 overflow-hidden sm:max-w-none sm:gap-3">
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

      {/*
        2ペイン本体。C4 で中央に separator を挿入しやすいよう
        [leftPane][/* resize gap *\/][rightPane] の横並び。
      */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {isWideLayout && patientReference != null ? (
          <aside
            aria-label={patientReferenceLabel}
            className="flex h-full min-h-0 min-w-0 w-[38%] shrink-0 flex-col overflow-hidden border-r border-[#E5E5EA]"
            data-form-workspace-pane="patient-reference"
          >
            <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {patientReference}
            </div>
          </aside>
        ) : null}

        {/* C4: ResizableTwoPane separator 挿入位置 */}
        <div
          aria-hidden
          data-form-workspace-resize-slot=""
          className="hidden w-0 shrink-0"
        />

        <section
          aria-label={workspaceLabel}
          className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          data-form-workspace-pane="workspace"
        >
          {workspaceTop ? (
            <div className="no-print shrink-0">{workspaceTop}</div>
          ) : null}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </section>
      </div>

      {!isWideLayout && patientReferenceSheet != null
        ? patientReferenceSheet
        : null}
    </div>
  );
}
