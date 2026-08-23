"use client";

// Compass Version2 — 様式2 Workspace（Learning Layer 中央）。
// Phase C6–C8: FormWorkspaceShell 接続・プレビュー/印刷/提出ヘッダー化。

import { useCallback, useState } from "react";
import {
  FileText,
  Pencil,
  Printer,
  Send,
  Sparkles,
} from "lucide-react";
import Form2EditForm from "@/components/form2/Form2EditForm";
import Form2PrintPortal from "@/components/form2/Form2PrintPortal";
import FormWorkspaceShell from "@/components/v2/workspace/FormWorkspaceShell";
import { EvidenceReviewBody } from "@/components/v2/workspace/EvidenceReviewWorkspace";
import Form2ReadonlyPreviewPane from "@/components/v2/workspace/Form2ReadonlyPreviewPane";
import Form2ReadonlyPreviewSheet from "@/components/v2/workspace/Form2ReadonlyPreviewSheet";
import Form2WorkspacePreview from "@/components/v2/workspace/Form2WorkspacePreview";
import WorkspacePatientReferencePane from "@/components/v2/workspace/WorkspacePatientReferencePane";
import WorkspacePatientReferenceSheet from "@/components/v2/workspace/WorkspacePatientReferenceSheet";
import {
  BRAND_ICON_SELECTED,
  BRAND_ICON_UNSELECTED,
  BRAND_SELECTED_SEGMENT,
  BRAND_UNSELECTED_PILL,
} from "@/components/v2/workspace/darkSelectedSegment";
import { requestWorkspaceBack } from "@/components/v2/workspace/requestWorkspaceBack";
import { useForm2Supabase } from "@/hooks/v2/useForm2Supabase";
import { formatSavedAtJa } from "@/lib/datetime/formatSavedAtJa";
import type { FacingConvoState } from "@/lib/patientFacingData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { Patient } from "@/lib/wardData";

type Mode = "edit" | "view";
/** 様式2編集 vs 患者理解（同一 Shell / focusMode 内） */
type WorkspacePanel = "form2" | "understanding";

function formatTime(iso: string): string {
  return formatSavedAtJa(iso);
}

export default function Form2Workspace({
  patient,
  userId,
  initialForm2,
  onForm2Persisted,
  facingState,
  onChangeFacingState,
  onBack,
  onToggleLearningSupport,
  learningSupportOpen,
  onGoToSubmissions,
}: {
  patient: Patient;
  userId: string;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  /**
   * @deprecated Round 2 B2: 患者理解は同一 Shell 内パネルへ。外部 view 遷移は使わない。
   */
  onOpenEvidenceReview?: () => void;
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
  /** C3: 患者トップへ。未指定時は no-op。 */
  onBack?: () => void;
  /**
   * 学習支援 Inspector（Coach / Compass Note）を開閉する。
   * 「患者理解を深める」（Evidence 整理）とは別機能。
   */
  onToggleLearningSupport?: () => void;
  learningSupportOpen?: boolean;
  /** focusMode 中に提出画面へ戻る */
  onGoToSubmissions?: () => void;
}) {
  const {
    data,
    hydrated,
    saveStatus,
    lastSavedAt,
    hasConflict,
    pendingDraft,
    updateBasic,
    updateHistory,
    updateTreatment,
    updateStudent,
    updatePeriod,
    saveNow,
    retry,
    loadLatest,
    restoreDraft,
    discardDraft,
  } = useForm2Supabase({
    patientId: patient.id,
    userId,
    initial: initialForm2,
    onPersisted: onForm2Persisted,
  });

  const [mode, setMode] = useState<Mode>("edit");
  const [workspacePanel, setWorkspacePanel] =
    useState<WorkspacePanel>("form2");
  /** 狭幅 Sheet（様式2通常=患者参照 / 患者理解=様式2プレビュー） */
  const [referenceSheetOpen, setReferenceSheetOpen] = useState(false);

  const openUnderstanding = useCallback(() => {
    setReferenceSheetOpen(false);
    setWorkspacePanel("understanding");
  }, []);

  const backToForm2Panel = useCallback(() => {
    setReferenceSheetOpen(false);
    setWorkspacePanel("form2");
  }, []);

  const savedTime = formatTime(lastSavedAt);

  const persistLabel = !hydrated
    ? ""
    : saveStatus === "saving"
      ? "保存中…"
      : saveStatus === "error"
        ? "保存できませんでした"
        : saveStatus === "conflict"
          ? "別の変更と競合しました"
          : saveStatus === "dirty"
            ? "未保存の変更あり"
            : savedTime
              ? "保存済み"
              : "";

  const persistDetail =
    persistLabel === "保存済み" && savedTime ? savedTime : "";

  const handleBack = useCallback(() => {
    // 患者理解パネル中は Shell 内で様式2へ戻す（focusMode を解除しない）
    if (workspacePanel === "understanding") {
      backToForm2Panel();
      return;
    }
    const proceed = () => onBack?.();
    if (!onBack) return;
    if (saveStatus === "saving") {
      requestWorkspaceBack({ kind: "saving", onProceed: proceed });
      return;
    }
    if (saveStatus === "error") {
      requestWorkspaceBack({ kind: "error", onProceed: proceed });
      return;
    }
    if (saveStatus === "conflict" || hasConflict) {
      requestWorkspaceBack({ kind: "conflict", onProceed: proceed });
      return;
    }
    if (saveStatus === "dirty") {
      requestWorkspaceBack({ kind: "draft", onProceed: proceed });
      return;
    }
    requestWorkspaceBack({ kind: "saved", onProceed: proceed });
  }, [onBack, saveStatus, hasConflict, workspacePanel, backToForm2Panel]);

  const handlePrint = () => {
    // 印刷は Form2PrintPortal（body 直下・等倍 A4）のみ。画面プレビューの scale は渡さない。
    if (mode !== "view") setMode("view");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  };

  const saveStatusNode = (
    <div className="max-w-[8rem] transition-opacity duration-150 motion-reduce:transition-none sm:max-w-none">
      {persistLabel ? (
        <p
          className={[
            "flex items-center justify-end gap-1 truncate text-[12px] leading-tight",
            persistLabel === "保存できませんでした" ||
            persistLabel === "別の変更と競合しました"
              ? "font-semibold text-[#C0392B]"
              : persistLabel === "未保存の変更あり"
                ? "font-semibold text-[#8A6D3B]"
                : persistLabel === "保存中…"
                  ? "font-medium text-[#6E6E73]"
                  : "font-semibold text-[#3A3A3C]",
          ].join(" ")}
        >
          {persistLabel === "保存済み" ? (
            <>
              <span
                className="text-[12px] font-normal text-[#AEAEB2]"
                aria-hidden
              >
                ✓
              </span>
              <span>保存済み</span>
            </>
          ) : (
            persistLabel
          )}
        </p>
      ) : null}
      {persistDetail ? (
        <p className="hidden truncate text-right text-[11px] font-normal tabular-nums text-[#6E6E73] sm:block">
          {persistDetail}
        </p>
      ) : null}
    </div>
  );

  const learningSupportButton = onToggleLearningSupport ? (
    <button
      type="button"
      onClick={onToggleLearningSupport}
      aria-expanded={learningSupportOpen === true}
      className={[
        "inline-flex h-12 min-h-[48px] shrink-0 items-center gap-2 rounded-2xl border px-3.5 text-[13px] font-medium transition-[background-color,border-color,color] duration-150 ease-out motion-reduce:transition-none",
        learningSupportOpen
          ? "border-[#D0D5DD] bg-[#F4F6F8] font-semibold text-[#344054]"
          : "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F4F6F8]",
      ].join(" ")}
    >
      学習支援
    </button>
  ) : null;

  const understandingHeaderActions = (
    <>
      <button
        type="button"
        onClick={backToForm2Panel}
        className="inline-flex h-12 min-h-[48px] shrink-0 items-center gap-2 rounded-2xl border border-[#D1D1D6] bg-white px-3.5 text-[13px] font-semibold text-[#3C3C43] transition-colors duration-150 hover:bg-[#F2F2F7] motion-reduce:transition-none"
      >
        様式2へ戻る
      </button>
      {learningSupportButton}
    </>
  );

  const headerActions = (
    <>
      {(saveStatus === "error" || saveStatus === "dirty") && (
        <button
          type="button"
          onClick={saveStatus === "error" ? retry : saveNow}
          className="h-12 min-h-[48px] rounded-2xl border border-[#D1D1D6] bg-white px-3.5 text-[13px] font-semibold text-[#3C3C43] transition-colors duration-150 hover:bg-[#F2F2F7] motion-reduce:transition-none"
        >
          {saveStatus === "error" ? "再試行" : "今すぐ保存"}
        </button>
      )}
      {/* 編集/プレビュー → 印刷（18px）→ 提出（16px）→ 患者理解/学習（24px） */}
      <div className="flex flex-wrap items-center gap-y-2">
        <div className="flex items-center">
          <div className="flex overflow-hidden rounded-2xl border border-[#D0D5DD]">
            <button
              type="button"
              onClick={() => setMode("edit")}
              aria-pressed={mode === "edit"}
              data-compass-selected={mode === "edit" ? "true" : "false"}
              className={[
                "relative z-[1] flex h-12 min-h-[48px] items-center gap-2 px-3.5 text-[13px] transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
                mode === "edit" ? BRAND_SELECTED_SEGMENT : BRAND_UNSELECTED_PILL,
              ].join(" ")}
            >
              <Pencil
                className={[
                  "relative z-[1] h-4 w-4",
                  mode === "edit" ? BRAND_ICON_SELECTED : BRAND_ICON_UNSELECTED,
                ].join(" ")}
                strokeWidth={1.9}
              />
              <span className="relative z-[1]">編集</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("view")}
              aria-pressed={mode === "view"}
              data-compass-selected={mode === "view" ? "true" : "false"}
              className={[
                "relative z-[1] flex h-12 min-h-[48px] items-center gap-2 border-l border-[#D0D5DD] px-3.5 text-[13px] transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
                mode === "view" ? BRAND_SELECTED_SEGMENT : BRAND_UNSELECTED_PILL,
              ].join(" ")}
            >
              <FileText
                className={[
                  "relative z-[1] h-4 w-4",
                  mode === "view" ? BRAND_ICON_SELECTED : BRAND_ICON_UNSELECTED,
                ].join(" ")}
                strokeWidth={1.9}
              />
              <span className="relative z-[1]">プレビュー</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            className="ml-[18px] flex h-12 min-h-[48px] items-center gap-2 rounded-2xl border border-[#D0D5DD] bg-white px-3.5 text-[13px] font-semibold text-[#344054] transition-colors duration-150 hover:bg-[#F4F6F8] motion-reduce:transition-none"
          >
            <Printer className="h-4 w-4 text-[#667085]" strokeWidth={1.9} />
            印刷
          </button>
          {onGoToSubmissions ? (
            <button
              type="button"
              onClick={onGoToSubmissions}
              className="ml-4 flex h-12 min-h-[48px] items-center gap-2 rounded-2xl bg-[#1E88E5] px-3.5 text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 motion-reduce:transition-none"
            >
              <Send className="h-4 w-4 text-white" strokeWidth={2} />
              提出へ戻る
            </button>
          ) : null}
        </div>
        <div className="ml-6 flex items-center gap-3">
          <button
            type="button"
            onClick={openUnderstanding}
            className="inline-flex h-12 min-h-[48px] shrink-0 items-center gap-2 rounded-2xl border border-[#D0D5DD] bg-white px-3.5 text-[13px] font-medium text-[#344054] transition-colors duration-150 hover:bg-[#F4F6F8] motion-reduce:transition-none"
          >
            <Sparkles className="h-4 w-4 text-[#667085]" strokeWidth={1.75} />
            患者理解を深める
          </button>
          {learningSupportButton}
        </div>
      </div>
    </>
  );

  const inUnderstanding = workspacePanel === "understanding";

  return (
    <>
    {/* 印刷 portal は様式2印刷時専用。患者理解左ペインでは使わない */}
    <Form2PrintPortal data={data} />
    <FormWorkspaceShell
      workspaceKind="form2"
      formTitle={inUnderstanding ? "患者理解を深める" : "様式2"}
      patientName={patient.name}
      onBack={handleBack}
      saveStatus={saveStatusNode}
      headerActions={
        inUnderstanding ? understandingHeaderActions : headerActions
      }
      patientReferenceLabel={
        inUnderstanding ? "様式2プレビュー" : "患者参照"
      }
      patientReferenceTrigger={
        <button
          type="button"
          className="min-h-[44px] rounded-2xl bg-[#F2F2F7] px-3 text-[14px] font-semibold text-[#1D1D1F]"
          onClick={() => setReferenceSheetOpen(true)}
          aria-label={
            inUnderstanding ? "様式2を参照" : "患者参照を開く"
          }
        >
          {inUnderstanding ? "様式2を参照" : "患者参照"}
        </button>
      }
      patientReference={
        inUnderstanding ? (
          <Form2ReadonlyPreviewPane
            key={`form2-preview-${patient.id}`}
            data={data}
            hydrated={hydrated}
            className="h-full min-h-0 min-w-0"
          />
        ) : (
          <WorkspacePatientReferencePane
            key={patient.id}
            patient={patient}
            facingState={facingState}
            onChangeFacingState={onChangeFacingState}
            className="h-full min-h-0 min-w-0"
          />
        )
      }
      patientReferenceSheet={
        inUnderstanding ? (
          <Form2ReadonlyPreviewSheet
            open={referenceSheetOpen}
            onClose={() => setReferenceSheetOpen(false)}
            data={data}
            hydrated={hydrated}
          />
        ) : (
          <WorkspacePatientReferenceSheet
            open={referenceSheetOpen}
            onClose={() => setReferenceSheetOpen(false)}
            patient={patient}
            facingState={facingState}
            onChangeFacingState={onChangeFacingState}
          />
        )
      }
      workspaceLabel={inUnderstanding ? "患者理解" : "様式2 作業"}
    >
      {inUnderstanding ? (
        <EvidenceReviewBody
          patientId={patient.id}
          data={data}
          hydrated={hydrated}
          layout="formOnly"
        />
      ) : (
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[900px] space-y-3 px-4 py-4">
          {hasConflict ? (
            <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-[#F3D6D2] bg-[#FBEAE8] px-3.5 py-2">
              <span className="text-[12px] text-[#C0392B]">
                他の端末でこの様式2が更新されました。入力内容は端末内に退避しています。
              </span>
              <button
                type="button"
                onClick={loadLatest}
                className="min-h-[32px] rounded-lg bg-[#C0392B] px-3 text-[12px] font-semibold text-white"
              >
                最新を読み込む
              </button>
            </div>
          ) : null}

          {pendingDraft && !hasConflict ? (
            <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-[#FCE9C6] bg-[#FFF7E6] px-3.5 py-2">
              <span className="text-[12px] text-[#8A6D3B]">
                前回、保存できなかった入力内容が端末内に残っています。復元しますか？
              </span>
              <button
                type="button"
                onClick={restoreDraft}
                className="min-h-[32px] rounded-lg border border-[#E0B75B] bg-white px-3 text-[12px] font-semibold text-[#8A6D3B]"
              >
                下書きを復元
              </button>
              <button
                type="button"
                onClick={discardDraft}
                className="min-h-[32px] rounded-lg border border-[#D1D1D6] px-3 text-[12px] text-[#6E6E73]"
              >
                破棄
              </button>
            </div>
          ) : null}

          {mode === "edit" ? (
            <Form2EditForm
              data={data}
              updateBasic={updateBasic}
              updateHistory={updateHistory}
              updateTreatment={updateTreatment}
              updateStudent={updateStudent}
              updatePeriod={updatePeriod}
            />
          ) : (
            <Form2WorkspacePreview data={data} />
          )}
        </div>
      </div>
      )}
    </FormWorkspaceShell>
    </>
  );
}
