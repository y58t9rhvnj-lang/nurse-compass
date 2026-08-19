"use client";

import {
  useCallback,
  useMemo,
  useState,
} from "react";
import Form3AssessmentCardList from "@/components/v2/form3/Form3AssessmentCardList";
import Form3FinalFormEditor from "@/components/v2/form3/Form3FinalFormEditor";
import Form3FinalReferencePanel from "@/components/v2/form3/Form3FinalReferencePanel";
import Form3FinalReferenceSheet from "@/components/v2/form3/Form3FinalReferenceSheet";
import Form3InformationCardList from "@/components/v2/form3/Form3InformationCardList";
import Form3PhaseBPatternPickerSheet from "@/components/v2/form3/Form3PhaseBPatternPickerSheet";
import Form3PhaseBPatternTabBar, {
  form3PhaseBPatternTabLabel,
} from "@/components/v2/form3/Form3PhaseBPatternTabBar";
import { getForm3PhaseBPersistLabel } from "@/components/v2/form3/form3PhaseBLabels";
import FormWorkspaceShell from "@/components/v2/workspace/FormWorkspaceShell";
import WorkspacePatientReferencePane from "@/components/v2/workspace/WorkspacePatientReferencePane";
import WorkspacePatientReferenceSheet from "@/components/v2/workspace/WorkspacePatientReferenceSheet";
import { useForm3Supabase } from "@/hooks/v2/useForm3Supabase";
import {
  FORM3_PATTERN_ORDER,
  isForm3PatternKey,
  type Form3Judgment,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import type { Form3V2AutosaveReason } from "@/lib/form3/v2/form3V2AutosaveReasons";
import {
  addForm3AssessmentCard,
  archiveForm3AssessmentCard,
  listForm3AssessmentCards,
  unarchiveForm3AssessmentCard,
  updateForm3AssessmentCard,
} from "@/lib/form3/v2/form3V2AssessmentOps";
import { createEmptyForm3V2 } from "@/lib/form3/v2/form3V2Factory";
import { updateForm3FinalPattern } from "@/lib/form3/v2/form3V2FinalOps";
import {
  addForm3InformationCard,
  archiveForm3InformationCard,
  listForm3InformationCards,
  moveForm3InformationCard,
  unarchiveForm3InformationCard,
  updateForm3InformationCard,
} from "@/lib/form3/v2/form3V2InformationOps";
import type {
  Form3DataV2,
  Form3FinalPatternV2,
  Form3InformationSourceType,
  Form3SoType,
  Form3SourceReference,
} from "@/lib/form3/v2/form3V2Types";
import { createEmptyForm3FinalForm } from "@/lib/form3/v2/form3V2Types";
import {
  initialFacingState,
  type FacingConvoState,
} from "@/lib/patientFacingData";
import type { Form3Snapshot } from "@/lib/v2/notebook/types";
import type { Patient } from "@/lib/wardData";

export type Form3PhaseBWorkspaceProps = {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  patientName?: string;
  patient?: Patient | null;
  facingState?: FacingConvoState | null;
  onChangeFacingState?: (next: FacingConvoState) => void;
};

/** 右ペイン: Pattern WS か Final Artifact（12番目 Pattern にはしない） */
type RightView = "pattern" | "final";

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
 * （患者参照ペイン R1 + ゴードン Pattern ナビ R2 + FormWorkspaceShell C2）。
 * 操作後は markUserEditedV2(next, reason) のみ。
 */
export default function Form3PhaseBWorkspace({
  patientId,
  userId,
  initial,
  patientName,
  patient = null,
  facingState = null,
  onChangeFacingState,
}: Form3PhaseBWorkspaceProps) {
  const {
    dataV2,
    markUserEditedV2,
    saveStatus,
    dirtyV2,
    hydrated,
    hasPersistedV2,
  } = useForm3Supabase({ patientId, userId, initial });

  const [rightView, setRightView] = useState<RightView>("pattern");
  const [selectedPatternKey, setSelectedPatternKey] = useState<Form3PatternKey>(
    () => readStoredPattern(patientId),
  );
  const [patternStatePatientId, setPatternStatePatientId] = useState(patientId);
  const [patternPickerOpen, setPatternPickerOpen] = useState(false);
  const [showArchivedInfo, setShowArchivedInfo] = useState(false);
  const [showArchivedAssess, setShowArchivedAssess] = useState(false);
  const [patientReferenceOpen, setPatientReferenceOpen] = useState(false);
  const [finalRefSheetOpen, setFinalRefSheetOpen] = useState(false);
  const resolvedFacing = facingState ?? initialFacingState();
  const handleFacingChange = onChangeFacingState ?? (() => undefined);

  if (patternStatePatientId !== patientId) {
    setPatternStatePatientId(patientId);
    setSelectedPatternKey(readStoredPattern(patientId));
    setRightView("pattern");
  }

  const selectPattern = useCallback(
    (key: Form3PatternKey) => {
      setSelectedPatternKey(key);
      setRightView("pattern");
      try {
        sessionStorage.setItem(patternStorageKey(patientId), key);
      } catch {
        // ignore
      }
    },
    [patientId],
  );

  const data: Form3DataV2 = dataV2 ?? createEmptyForm3V2(patientId);
  const finalForm = data.finalForm ?? createEmptyForm3FinalForm();

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
      infoCards.filter((c) =>
        c.patternKeys.includes(selectedPatternKey),
      ),
    [infoCards, selectedPatternKey],
  );

  const patternAssessCards = useMemo(
    () =>
      assessCards.filter((c) => c.patternKey === selectedPatternKey),
    [assessCards, selectedPatternKey],
  );

  const unclassifiedAssessCount = useMemo(
    () =>
      assessCards.filter(
        (c) => c.status !== "archived" && c.patternKey === null,
      ).length,
    [assessCards],
  );

  const evidenceOptions = useMemo(() => {
    const active = infoCards.filter((c) => c.status === "active");
    const archivedSelected = infoCards.filter(
      (c) =>
        c.status === "archived" &&
        assessCards.some((a) => a.evidenceInformationIds.includes(c.id)),
    );
    return [...active, ...archivedSelected];
  }, [infoCards, assessCards]);

  const persistLabel = getForm3PhaseBPersistLabel({
    dirty: dirtyV2,
    saveStatus,
    hydrated,
    hasPersistedV2,
  });

  const patternLabel = form3PhaseBPatternTabLabel(selectedPatternKey);

  const applyEdit = useCallback(
    (next: Form3DataV2, reason: Form3V2AutosaveReason) => {
      markUserEditedV2(next, reason);
    },
    [markUserEditedV2],
  );

  const onAddInfo = useCallback(() => {
    applyEdit(
      addForm3InformationCard(data, {
        patternKeys: [selectedPatternKey],
      }),
      "information_added",
    );
  }, [applyEdit, data, selectedPatternKey]);

  const onPatchInfo = useCallback(
    (
      cardId: string,
      patch: {
        content?: string;
        soType?: Form3SoType | null;
        sourceType?: Form3InformationSourceType;
        sourceLabel?: string | null;
        sourceReference?: Form3SourceReference | null;
        patternKeys?: Form3PatternKey[];
      },
    ) => {
      applyEdit(
        updateForm3InformationCard(data, cardId, patch),
        "information_updated",
      );
    },
    [applyEdit, data],
  );

  const onArchiveInfo = useCallback(
    (cardId: string) => {
      applyEdit(
        archiveForm3InformationCard(data, cardId),
        "information_archived",
      );
    },
    [applyEdit, data],
  );

  const onUnarchiveInfo = useCallback(
    (cardId: string) => {
      applyEdit(
        unarchiveForm3InformationCard(data, cardId),
        "information_restored",
      );
    },
    [applyEdit, data],
  );

  const onMoveInfoUp = useCallback(
    (cardId: string) => {
      applyEdit(
        moveForm3InformationCard(data, cardId, "up"),
        "information_reordered",
      );
    },
    [applyEdit, data],
  );

  const onMoveInfoDown = useCallback(
    (cardId: string) => {
      applyEdit(
        moveForm3InformationCard(data, cardId, "down"),
        "information_reordered",
      );
    },
    [applyEdit, data],
  );

  const onAddAssess = useCallback(() => {
    applyEdit(
      addForm3AssessmentCard(data, { patternKey: selectedPatternKey }),
      "assessment_added",
    );
  }, [applyEdit, data, selectedPatternKey]);

  const onPatchAssess = useCallback(
    (
      cardId: string,
      patch: {
        interpretation?: string;
        classification?: Form3Judgment | null;
        evidenceInformationIds?: string[];
        needMoreInformation?: string;
        patternKey?: Form3PatternKey | null;
      },
    ) => {
      applyEdit(
        updateForm3AssessmentCard(data, cardId, patch),
        "assessment_updated",
      );
    },
    [applyEdit, data],
  );

  const onArchiveAssess = useCallback(
    (cardId: string) => {
      applyEdit(
        archiveForm3AssessmentCard(data, cardId),
        "assessment_archived",
      );
    },
    [applyEdit, data],
  );

  const onUnarchiveAssess = useCallback(
    (cardId: string) => {
      applyEdit(
        unarchiveForm3AssessmentCard(data, cardId),
        "assessment_restored",
      );
    },
    [applyEdit, data],
  );

  const onPatchFinal = useCallback(
    (patternKey: Form3PatternKey, patch: Partial<Form3FinalPatternV2>) => {
      applyEdit(updateForm3FinalPattern(data, patternKey, patch), "final_updated");
    },
    [applyEdit, data],
  );

  // C2: 戻る先は Shell が決めない。C3 で患者トップへ統一するまで no-op。
  const onBack = useCallback(() => {
    // no-op (Phase C3)
  }, []);

  const saveStatusNode = (
    <div className="max-w-[7.5rem] sm:max-w-none">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
        {persistLabel.label}
      </p>
      {persistLabel.detailJa ? (
        <p className="hidden truncate text-[12px] text-[#6E6E73] sm:block">
          {persistLabel.detailJa}
        </p>
      ) : null}
    </div>
  );

  const headerActions = (
    <>
      {rightView === "final" ? (
        <>
          <button
            type="button"
            className="min-h-[44px] rounded-2xl bg-[#F2F2F7] px-3 text-[14px] font-semibold text-[#1D1D1F] sm:px-4 sm:text-[15px]"
            onClick={() => setRightView("pattern")}
          >
            Patternへ戻る
          </button>
          <button
            type="button"
            className="min-h-[44px] rounded-2xl bg-[#F2F2F7] px-3 text-[14px] font-semibold text-[#1D1D1F] xl:hidden sm:px-4 sm:text-[15px]"
            onClick={() => setFinalRefSheetOpen(true)}
          >
            Workspace 参照
          </button>
        </>
      ) : (
        <button
          type="button"
          className="min-h-[44px] rounded-2xl border border-[#E5E5EA] bg-white px-3 text-[13px] font-semibold text-[#1D1D1F] sm:px-4 sm:text-[14px]"
          onClick={() => setRightView("final")}
        >
          様式表示
        </button>
      )}
    </>
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
          rightView === "pattern" ? (
            <div className="border-b border-[#E5E5EA] bg-white/90">
              <p className="px-3 pt-2 text-[12px] text-[#8E8E93] sm:px-4">
                {patternLabel}
              </p>
              <Form3PhaseBPatternTabBar
                selectedPatternKey={selectedPatternKey}
                onSelect={selectPattern}
                onOpenList={() => setPatternPickerOpen(true)}
                panelId={PATTERN_PANEL_ID}
              />
            </div>
          ) : (
            <div className="border-b border-[#E5E5EA] bg-white/90 px-3 py-2 sm:px-4">
              <p className="text-[13px] font-medium text-[#1D1D1F]">
                Final Form（様式表示）
              </p>
            </div>
          )
        }
        workspaceLabel="様式3 作業"
      >
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
            {rightView === "pattern" ? (
              <div
                id={PATTERN_PANEL_ID}
                role="tabpanel"
                aria-labelledby={`form3-phase-b-pattern-tab-${selectedPatternKey}`}
              >
                {unclassifiedAssessCount > 0 ? (
                  <p className="mx-auto w-full max-w-3xl px-4 pt-3 text-[13px] text-[#8E8E93] sm:px-6">
                    パターン未設定のアセスメントが {unclassifiedAssessCount}{" "}
                    件あります（各カードで Pattern を設定してください）。
                  </p>
                ) : null}
                <Form3InformationCardList
                  cards={patternInfoCards}
                  showArchived={showArchivedInfo}
                  onToggleShowArchived={() =>
                    setShowArchivedInfo((v) => !v)
                  }
                  onAdd={onAddInfo}
                  onPatch={onPatchInfo}
                  onArchive={onArchiveInfo}
                  onUnarchive={onUnarchiveInfo}
                  onMoveUp={onMoveInfoUp}
                  onMoveDown={onMoveInfoDown}
                  emptyTitle="このパターンの情報はまだありません"
                  emptyBody="「＋ Information」から、このパターンに関する事実を追加してください。"
                />
                <div className="border-t border-[#E5E5EA]">
                  <Form3AssessmentCardList
                    cards={patternAssessCards}
                    informationOptions={evidenceOptions}
                    showArchived={showArchivedAssess}
                    onToggleShowArchived={() =>
                      setShowArchivedAssess((v) => !v)
                    }
                    onAdd={onAddAssess}
                    onPatch={onPatchAssess}
                    onArchive={onArchiveAssess}
                    onUnarchive={onUnarchiveAssess}
                    emptyTitle="このパターンのアセスメントはまだありません"
                    emptyBody="このパターンの Information を根拠に、「＋ Assessment」で解釈を追加してください。"
                  />
                </div>
              </div>
            ) : null}

            {rightView === "final" ? (
              <Form3FinalFormEditor
                finalForm={finalForm}
                onPatchPattern={onPatchFinal}
              />
            ) : null}
          </div>

          {rightView === "final" ? (
            <aside className="hidden h-full min-h-0 min-w-0 w-[min(36%,24rem)] shrink-0 border-l border-[#E5E5EA] xl:flex xl:flex-col">
              <Form3FinalReferencePanel
                informationCards={infoCards}
                assessmentCards={assessCards}
              />
            </aside>
          ) : null}
        </div>
      </FormWorkspaceShell>

      <Form3PhaseBPatternPickerSheet
        open={patternPickerOpen}
        onClose={() => setPatternPickerOpen(false)}
        selectedPatternKey={selectedPatternKey}
        onSelect={selectPattern}
      />
      <Form3FinalReferenceSheet
        open={finalRefSheetOpen}
        onClose={() => setFinalRefSheetOpen(false)}
        informationCards={infoCards}
        assessmentCards={assessCards}
      />
    </>
  );
}
