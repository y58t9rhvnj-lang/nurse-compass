"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  FileText,
  Pencil,
  Printer,
  Send,
} from "lucide-react";
import Form3AssessmentCardList from "@/components/v2/form3/Form3AssessmentCardList";
import Form3InformationCardList from "@/components/v2/form3/Form3InformationCardList";
import Form3PhaseBPatternPickerSheet from "@/components/v2/form3/Form3PhaseBPatternPickerSheet";
import Form3PhaseBPatternTabBar, {
  form3PhaseBPatternTabLabel,
} from "@/components/v2/form3/Form3PhaseBPatternTabBar";
import Form3PrintPortal, {
  measureForm3PrintPortal,
} from "@/components/v2/form3/Form3PrintPortal";
import Form3SheetView from "@/components/v2/form3/Form3SheetView";
import Form3SubmitConfirmDialog from "@/components/v2/form3/Form3SubmitConfirmDialog";
import { getForm3PhaseBPersistLabel } from "@/components/v2/form3/form3PhaseBLabels";
import {
  buildForm3PrintLayout,
  buildForm3PrintLayoutFallback,
} from "@/lib/form3/form3PrintLayout";
import FormWorkspaceShell from "@/components/v2/workspace/FormWorkspaceShell";
import WorkspacePatientReferencePane from "@/components/v2/workspace/WorkspacePatientReferencePane";
import WorkspacePatientReferenceSheet from "@/components/v2/workspace/WorkspacePatientReferenceSheet";
import {
  BRAND_ICON_SELECTED,
  BRAND_ICON_UNSELECTED,
  BRAND_SELECTED_SEGMENT,
  BRAND_UNSELECTED_PILL,
} from "@/components/v2/workspace/darkSelectedSegment";
import { requestWorkspaceBack } from "@/components/v2/workspace/requestWorkspaceBack";
import { useForm3Supabase } from "@/hooks/v2/useForm3Supabase";
import {
  FORM3_PATTERN_ORDER,
  isForm3PatternKey,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import type { Form3V2AutosaveReason } from "@/lib/form3/v2/form3V2AutosaveReasons";
import {
  addForm3AssessmentCard,
  archiveForm3AssessmentCard,
  listForm3AssessmentCards,
  updateForm3AssessmentCard,
} from "@/lib/form3/v2/form3V2AssessmentOps";
import { createEmptyForm3V2 } from "@/lib/form3/v2/form3V2Factory";
import {
  addForm3InformationCard,
  archiveForm3InformationCard,
  listForm3InformationCards,
  updateForm3InformationCard,
} from "@/lib/form3/v2/form3V2InformationOps";
import { collectForm3Missing } from "@/lib/form3/v2/collectForm3Missing";
import type { Form3DataV2, Form3SoType } from "@/lib/form3/v2/form3V2Types";
/**
 * Autosave reason literals kept for Phase B validators / ops contract:
 * "information_restored" "information_reordered" "assessment_restored"
 * "final_updated"（旧様式欄 UI は撤去。ops / Final Editor ファイルは互換で残す）
 * （本 Step の一覧 UI はアーカイブ復帰・並び替えを出さない。ops 自体は維持。）
 */
import {
  initialFacingState,
  type FacingConvoState,
} from "@/lib/patientFacingData";
import type { Form3Snapshot } from "@/lib/v2/notebook/types";
import type { Form3SnapshotV2 } from "@/lib/form3/v2/form3V2Mapper";
import { sanitizeForm3Payload } from "@/lib/v2/notebook/form3Mapper";
import type { Patient } from "@/lib/wardData";

type Mode = "edit" | "view";

export type Form3PhaseBWorkspaceProps = {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  patientName?: string;
  patient?: Patient | null;
  facingState?: FacingConvoState | null;
  onChangeFacingState?: (next: FacingConvoState) => void;
  /** C3: 患者トップへ戻る。未指定時は確認のみの no-op 相当。 */
  onBack?: () => void;
  /** 永続化成功時（AppShell セッション更新・再マウント巻き戻り防止） */
  onPersisted?: (snapshot: Form3Snapshot) => void;
  /**
   * 学習支援 Inspector（Coach / Compass Note）を開閉する。
   * 「患者理解を深める」とは別機能。
   */
  onToggleLearningSupport?: () => void;
  learningSupportOpen?: boolean;
  /** 提出チェック用（様式2スナップショットから） */
  studentNumber?: string | null;
  studentName?: string | null;
};

/** Phase B SnapshotV2 → AppShell 用 Form3Snapshot（rawPayload に v2 を保持） */
function form3SnapshotFromV2(
  snap: Form3SnapshotV2,
  patientId: string,
): Form3Snapshot {
  const { payload } = sanitizeForm3Payload(snap.payload, patientId);
  return {
    payload,
    version: snap.version,
    updatedAt: snap.updatedAt,
    persistedSchemaVersion: 2,
    rawPayload: snap.payload,
  };
}

const DEFAULT_PATTERN: Form3PatternKey = FORM3_PATTERN_ORDER[0]!;
const PATTERN_PANEL_ID = "form3-phase-b-pattern-panel";

function patternStorageKey(patientId: string) {
  return `form3-phase-b-selected-pattern:${patientId}`;
}

function readStoredPattern(patientId: string): Form3PatternKey {
  if (typeof window === "undefined") return DEFAULT_PATTERN;
  try {
    const raw = sessionStorage.getItem(patternStorageKey(patientId));
    if (raw && isForm3PatternKey(raw)) return raw;
  } catch {
    // ignore
  }
  return DEFAULT_PATTERN;
}

/**
 * Form3 Phase B Workspace
 * ヘッダーは様式2と同型: 編集 / プレビュー / 印刷 / 提出 / 学習支援。
 * 編集 = 選択中ゴードン Pattern のカード編集。印刷正本はカードから学校指定様式①〜⑦。
 */
export default function Form3PhaseBWorkspace({
  patientId,
  userId,
  initial,
  patientName,
  patient = null,
  facingState = null,
  onChangeFacingState,
  onBack: onBackProp,
  onPersisted,
  onToggleLearningSupport,
  learningSupportOpen,
  studentNumber = null,
  studentName = null,
}: Form3PhaseBWorkspaceProps) {
  const onPersistedV2 = useCallback(
    (snap: Form3SnapshotV2) => {
      onPersisted?.(form3SnapshotFromV2(snap, patientId));
    },
    [onPersisted, patientId],
  );

  const {
    dataV2,
    markUserEditedV2,
    dirtyV2,
    hydrated,
    hasPersistedV2,
    writeFlags,
    lastSavedAt,
  } = useForm3Supabase({
    patientId,
    userId,
    initial,
    onPersistedV2,
  });

  const [mode, setMode] = useState<Mode>("edit");
  const [selectedPatternKey, setSelectedPatternKey] = useState<Form3PatternKey>(
    () => readStoredPattern(patientId),
  );
  const [patternStatePatientId, setPatternStatePatientId] = useState(patientId);
  const [patternPickerOpen, setPatternPickerOpen] = useState(false);
  const [patientReferenceOpen, setPatientReferenceOpen] = useState(false);
  const [formDialogOpenInfo, setFormDialogOpenInfo] = useState(false);
  const [formDialogOpenAssess, setFormDialogOpenAssess] = useState(false);
  const formDialogOpen = formDialogOpenInfo || formDialogOpenAssess;
  const [panelEpoch, setPanelEpoch] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const resolvedFacing = facingState ?? initialFacingState();
  const handleFacingChange = onChangeFacingState ?? (() => undefined);

  if (patternStatePatientId !== patientId) {
    setPatternStatePatientId(patientId);
    setSelectedPatternKey(readStoredPattern(patientId));
    setMode("edit");
    setSubmitted(false);
    setSubmitDialogOpen(false);
  }

  const selectPattern = useCallback(
    (key: Form3PatternKey) => {
      if (formDialogOpen) {
        const ok = window.confirm(
          "編集中のダイアログを閉じてパターンを切り替えますか？",
        );
        if (!ok) return;
        setPanelEpoch((n) => n + 1);
        setFormDialogOpenInfo(false);
        setFormDialogOpenAssess(false);
      }
      setSelectedPatternKey(key);
      setMode("edit");
      try {
        sessionStorage.setItem(patternStorageKey(patientId), key);
      } catch {
        // ignore
      }
      requestAnimationFrame(() => {
        rightScrollRef.current?.scrollTo({ top: 0 });
      });
    },
    [patientId, formDialogOpen],
  );

  const data: Form3DataV2 = dataV2 ?? createEmptyForm3V2(patientId);

  const [printLayoutTick, setPrintLayoutTick] = useState(0);
  useEffect(() => {
    if (mode !== "view") return;
    const id = window.setTimeout(() => setPrintLayoutTick((n) => n + 1), 40);
    return () => window.clearTimeout(id);
  }, [data.informationCards, data.assessmentCards, mode]);

  const printLayout = useMemo(() => {
    void printLayoutTick;
    if (typeof document === "undefined") {
      return buildForm3PrintLayoutFallback(data);
    }
    return (
      buildForm3PrintLayout(data) ?? buildForm3PrintLayoutFallback(data)
    );
  }, [data, printLayoutTick]);

  const printMeta = useMemo(
    () => ({
      studentName: (studentName ?? "").trim(),
      studentNumber: (studentNumber ?? "").trim(),
    }),
    [studentName, studentNumber],
  );

  const missing = useMemo(
    () =>
      collectForm3Missing(data, {
        studentNumber,
        studentName,
      }),
    [data, studentNumber, studentName],
  );

  /** 印刷は Portal（最新カード）へ直接。プレビューを開く必要なし。 */
  const handlePrint = useCallback(() => {
    try {
      const measured = measureForm3PrintPortal();
      if (measured) {
        console.info("[Form3PrintPortal measure]", measured);
      }
    } catch {
      // ignore diagnostics
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print());
    });
  }, []);

  const completeSubmit = useCallback(() => {
    setSubmitDialogOpen(false);
    setSubmitted(true);
  }, []);

  const handleSubmit = useCallback(() => {
    const status = writeFlags.saveStatus;
    if (dirtyV2 || status === "dirty" || status === "saving") {
      window.alert("保存が完了してから提出してください。");
      return;
    }
    if (status === "error" || status === "conflict") {
      window.alert("保存状態を確認してから提出してください。");
      return;
    }
    // Pattern 未入力は warning。確認 Dialog で了承後に提出可能。
    if (missing.length > 0) {
      setSubmitDialogOpen(true);
      return;
    }
    completeSubmit();
  }, [missing, writeFlags.saveStatus, dirtyV2, completeSubmit]);

  const handleToggleLearningSupport = useCallback(() => {
    if (mode === "view") setMode("edit");
    onToggleLearningSupport?.();
  }, [mode, onToggleLearningSupport]);

  const jumpToMissing = useCallback(
    (patternKey: Form3PatternKey) => {
      setSubmitDialogOpen(false);
      selectPattern(patternKey);
    },
    [selectPattern],
  );

  const infoCards = useMemo(
    () => listForm3InformationCards(data, { includeArchived: true }),
    [data],
  );

  const assessCards = useMemo(
    () => listForm3AssessmentCards(data, { includeArchived: true }),
    [data],
  );

  const patternInfoCards = useMemo(
    () =>
      infoCards.filter((c) => c.patternKeys.includes(selectedPatternKey)),
    [infoCards, selectedPatternKey],
  );

  const patternAssessCards = useMemo(
    () => assessCards.filter((c) => c.patternKey === selectedPatternKey),
    [assessCards, selectedPatternKey],
  );

  const unclassifiedAssessCount = useMemo(
    () =>
      assessCards.filter(
        (c) => c.status !== "archived" && c.patternKey === null,
      ).length,
    [assessCards],
  );

  const evidenceOptions = useMemo(
    () => patternInfoCards.filter((c) => c.status === "active"),
    [patternInfoCards],
  );

  const informationLookup = useMemo(
    () => listForm3InformationCards(data, { includeArchived: true }),
    [data],
  );

  const persistLabel = getForm3PhaseBPersistLabel({
    dirty: dirtyV2,
    saveStatus: writeFlags.saveStatus,
    hydrated,
    hasPersistedV2,
    lastSavedAt,
  });

  const submitSaveLabel =
    persistLabel.label === "Saved"
      ? "保存済み"
      : persistLabel.label === "Draft"
        ? "未保存の変更あり"
        : persistLabel.label === "Saving"
          ? "保存中…"
          : persistLabel.label === "Save failed"
            ? "保存失敗"
            : persistLabel.label === "Conflict"
              ? "競合"
              : "—";

  const patternLabel = form3PhaseBPatternTabLabel(selectedPatternKey);

  const applyEdit = useCallback(
    (
      recipe: (current: Form3DataV2) => Form3DataV2,
      reason: Form3V2AutosaveReason,
    ) => {
      markUserEditedV2(recipe, reason);
    },
    [markUserEditedV2],
  );

  const onAddInfo = useCallback(
    (values: { soType: Form3SoType; content: string }) => {
      applyEdit(
        (current) =>
          addForm3InformationCard(current, {
            patternKeys: [selectedPatternKey],
            content: values.content,
            soType: values.soType,
          }),
        "information_added",
      );
    },
    [applyEdit, selectedPatternKey],
  );

  const onPatchInfo = useCallback(
    (
      cardId: string,
      patch: {
        content?: string;
        soType?: Form3SoType | null;
      },
    ) => {
      applyEdit(
        (current) => updateForm3InformationCard(current, cardId, patch),
        "information_updated",
      );
    },
    [applyEdit],
  );

  const onArchiveInfo = useCallback(
    (cardId: string) => {
      applyEdit(
        (current) => archiveForm3InformationCard(current, cardId),
        "information_archived",
      );
    },
    [applyEdit],
  );

  const onAddAssess = useCallback(
    (values: {
      interpretation: string;
      evidenceInformationIds: string[];
    }) => {
      applyEdit(
        (current) =>
          addForm3AssessmentCard(current, {
            patternKey: selectedPatternKey,
            interpretation: values.interpretation,
            evidenceInformationIds: values.evidenceInformationIds,
          }),
        "assessment_added",
      );
    },
    [applyEdit, selectedPatternKey],
  );

  const onPatchAssess = useCallback(
    (
      cardId: string,
      patch: {
        interpretation?: string;
        evidenceInformationIds?: string[];
      },
    ) => {
      // patternKey は作成時のみ設定。編集 UI からは変更しない（誤移動防止）。
      applyEdit(
        (current) => updateForm3AssessmentCard(current, cardId, patch),
        "assessment_updated",
      );
    },
    [applyEdit],
  );

  const onArchiveAssess = useCallback(
    (cardId: string) => {
      applyEdit(
        (current) => archiveForm3AssessmentCard(current, cardId),
        "assessment_archived",
      );
    },
    [applyEdit],
  );

  const onBack = useCallback(() => {
    const proceed = () => onBackProp?.();
    if (!onBackProp) return;
    const status = writeFlags.saveStatus;
    if (status === "saving") {
      requestWorkspaceBack({ kind: "saving", onProceed: proceed });
      return;
    }
    if (status === "error") {
      requestWorkspaceBack({ kind: "error", onProceed: proceed });
      return;
    }
    if (status === "conflict") {
      requestWorkspaceBack({ kind: "conflict", onProceed: proceed });
      return;
    }
    if (dirtyV2 || status === "dirty") {
      requestWorkspaceBack({ kind: "draft", onProceed: proceed });
      return;
    }
    requestWorkspaceBack({ kind: "saved", onProceed: proceed });
  }, [onBackProp, writeFlags.saveStatus, dirtyV2]);

  const saveStatusNode = (
    <div className="max-w-[7.5rem] transition-[opacity] duration-150 motion-reduce:transition-none sm:max-w-none">
      {persistLabel.label !== "Ready" || persistLabel.detailJa ? (
        <p
          className={[
            "truncate text-[12px] font-semibold leading-tight",
            persistLabel.label === "Save failed" ||
            persistLabel.label === "Conflict"
              ? "text-[#C0392B]"
              : persistLabel.label === "Draft"
                ? "text-[#8A6D3B]"
                : "text-[#3A3A3C]",
          ].join(" ")}
        >
          {persistLabel.label === "Saved" ? (
            <>
              <span
                className="mr-1 text-[12px] font-normal text-[#AEAEB2]"
                aria-hidden
              >
                ✓
              </span>
              保存済み
            </>
          ) : persistLabel.label === "Saving" ? (
            "保存中…"
          ) : persistLabel.label === "Draft" ? (
            "未保存の変更あり"
          ) : persistLabel.label === "Save failed" ? (
            "保存できませんでした"
          ) : persistLabel.label === "Conflict" ? (
            "別の変更と競合しました"
          ) : (
            persistLabel.detailJa
          )}
        </p>
      ) : null}
      {persistLabel.label === "Saved" && persistLabel.detailJa ? (
        <p className="hidden truncate text-[11px] tabular-nums text-[#8E8E93] sm:block">
          {persistLabel.detailJa}
        </p>
      ) : null}
    </div>
  );

  const learningSupportButton = onToggleLearningSupport ? (
    <button
      type="button"
      onClick={handleToggleLearningSupport}
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

  const headerActions = (
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
        <button
          type="button"
          onClick={handleSubmit}
          className="ml-4 flex h-12 min-h-[48px] items-center gap-2 rounded-2xl bg-[#1E88E5] px-3.5 text-[13px] font-semibold text-white transition-opacity duration-150 hover:opacity-90 motion-reduce:transition-none"
        >
          <Send className="h-4 w-4 text-white" strokeWidth={2} />
          提出
        </button>
      </div>
      {learningSupportButton ? (
        <div className="ml-6 flex items-center gap-3">
          {learningSupportButton}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <FormWorkspaceShell
        workspaceKind="form3"
        formTitle="様式3"
        patientName={patientName}
        onBack={onBack}
        saveStatus={saveStatusNode}
        headerActions={headerActions}
        patientReferenceTrigger={
          <button
            type="button"
            className="min-h-[44px] rounded-2xl bg-[#F2F2F7] px-3 text-[14px] font-semibold text-[#1D1D1F] sm:px-4 sm:text-[15px]"
            onClick={() => setPatientReferenceOpen(true)}
            aria-label="患者参照を開く"
          >
            患者参照
          </button>
        }
        patientReference={
          patient ? (
            <WorkspacePatientReferencePane
              key={patientId}
              patient={patient}
              facingState={resolvedFacing}
              onChangeFacingState={handleFacingChange}
              className="h-full min-h-0 min-w-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-[14px] text-[#8E8E93]">
              患者データがありません
            </div>
          )
        }
        patientReferenceSheet={
          patient ? (
            <WorkspacePatientReferenceSheet
              open={patientReferenceOpen}
              onClose={() => setPatientReferenceOpen(false)}
              patient={patient}
              facingState={resolvedFacing}
              onChangeFacingState={handleFacingChange}
            />
          ) : null
        }
        workspaceTop={
          mode === "edit" ? (
            <div className="relative z-20 border-b border-[#E5E5EA] bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]">
              <p className="px-3 pt-2 text-[12px] font-medium text-[#6E6E73] sm:px-4">
                {patternLabel}
              </p>
              <Form3PhaseBPatternTabBar
                selectedPatternKey={selectedPatternKey}
                onSelect={selectPattern}
                onOpenList={() => setPatternPickerOpen(true)}
                panelId={PATTERN_PANEL_ID}
              />
            </div>
          ) : null
        }
        workspaceLabel="様式3 作業"
      >
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={rightScrollRef}
            data-form3-right-scroll=""
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          >
            {mode === "edit" ? (
              <div
                id={PATTERN_PANEL_ID}
                role="tabpanel"
                aria-labelledby={`form3-phase-b-pattern-tab-${selectedPatternKey}`}
              >
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-10 pt-4 sm:px-6">
                  {submitted ? (
                    <p className="no-print flex items-center gap-1.5 text-[13px] font-medium text-[#3F7E52]">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                      提出内容を確認しました（保存済みのカード内容が対象です）。
                    </p>
                  ) : null}

                  {unclassifiedAssessCount > 0 ? (
                    <p className="text-[13px] text-[#8E8E93]">
                      パターン未設定のアセスメントが {unclassifiedAssessCount}{" "}
                      件あります（所属 Pattern のない既存データです。新規追加分は現在の
                      Pattern に紐づきます）。
                    </p>
                  ) : null}
                  <Form3InformationCardList
                    key={`info-${selectedPatternKey}-${panelEpoch}`}
                    cards={patternInfoCards}
                    onAdd={onAddInfo}
                    onPatch={onPatchInfo}
                    onArchive={onArchiveInfo}
                    onDialogOpenChange={setFormDialogOpenInfo}
                  />
                  <Form3AssessmentCardList
                    key={`assess-${selectedPatternKey}-${panelEpoch}`}
                    cards={patternAssessCards}
                    informationOptions={evidenceOptions}
                    informationLookup={informationLookup}
                    onAdd={onAddAssess}
                    onPatch={onPatchAssess}
                    onArchive={onArchiveAssess}
                    onDialogOpenChange={setFormDialogOpenAssess}
                  />
                </div>
              </div>
            ) : (
              <div className="bg-[#E8E8ED] px-3 py-6 sm:px-6">
                {submitted ? (
                  <p className="no-print mx-auto mb-4 flex max-w-3xl items-center gap-1.5 text-[13px] font-medium text-[#3F7E52]">
                    <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                    提出内容を確認しました（保存済みのカード内容が対象です）。
                  </p>
                ) : null}
                <Form3SheetView
                  layout={printLayout}
                  meta={printMeta}
                  forPrint={false}
                />
              </div>
            )}
          </div>
        </div>
      </FormWorkspaceShell>

      <Form3PhaseBPatternPickerSheet
        open={patternPickerOpen}
        onClose={() => setPatternPickerOpen(false)}
        selectedPatternKey={selectedPatternKey}
        onSelect={selectPattern}
      />

      <Form3SubmitConfirmDialog
        open={submitDialogOpen}
        missing={missing}
        saveLabel={submitSaveLabel}
        onClose={() => setSubmitDialogOpen(false)}
        onSubmitAnyway={completeSubmit}
        onJumpToPattern={jumpToMissing}
      />

      <Form3PrintPortal data={data} meta={printMeta} />
    </>
  );
}
