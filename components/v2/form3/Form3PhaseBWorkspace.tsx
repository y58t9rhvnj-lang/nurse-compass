"use client";

import { useCallback, useMemo, useState } from "react";
import Form3AssessmentCardList from "@/components/v2/form3/Form3AssessmentCardList";
import Form3InformationCardList from "@/components/v2/form3/Form3InformationCardList";
import Form3PatientSourcePanel from "@/components/v2/form3/Form3PatientSourcePanel";
import Form3PatientSourceSheet from "@/components/v2/form3/Form3PatientSourceSheet";
import { getForm3PhaseBPersistLabel } from "@/components/v2/form3/form3PhaseBLabels";
import { useForm3Supabase } from "@/hooks/v2/useForm3Supabase";
import type { Form3Judgment, Form3PatternKey } from "@/lib/form3/form3Types";
import type { Form3V2AutosaveReason } from "@/lib/form3/v2/form3V2AutosaveReasons";
import {
  addForm3AssessmentCard,
  archiveForm3AssessmentCard,
  listForm3AssessmentCards,
  unarchiveForm3AssessmentCard,
  updateForm3AssessmentCard,
} from "@/lib/form3/v2/form3V2AssessmentOps";
import { createEmptyForm3V2 } from "@/lib/form3/v2/form3V2Factory";
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
  Form3InformationSourceType,
  Form3SoType,
  Form3SourceReference,
} from "@/lib/form3/v2/form3V2Types";
import type { FacingConvoState } from "@/lib/patientFacingData";
import type { Form3Snapshot } from "@/lib/v2/notebook/types";
import type { Patient } from "@/lib/wardData";

export type Form3PhaseBWorkspaceProps = {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  patientName?: string;
  patient?: Patient | null;
  facingState?: FacingConvoState | null;
};

type WorkspaceTab = "information" | "assessment";

/**
 * Form3 Phase B Workspace（B3 Information + B4 Assessment + B5 Patient Source）。
 * 操作後は markUserEditedV2(next, reason) のみ。
 * saveNowV2 は呼ばない（Hook 内 Controller が debounce → flush）。
 */
export default function Form3PhaseBWorkspace({
  patientId,
  userId,
  initial,
  patientName,
  patient,
  facingState,
}: Form3PhaseBWorkspaceProps) {
  const {
    dataV2,
    markUserEditedV2,
    saveStatus,
    dirtyV2,
    hydrated,
    hasPersistedV2,
  } = useForm3Supabase({ patientId, userId, initial });

  const [tab, setTab] = useState<WorkspaceTab>("information");
  const [showArchivedInfo, setShowArchivedInfo] = useState(false);
  const [showArchivedAssess, setShowArchivedAssess] = useState(false);
  const [sourceSheetOpen, setSourceSheetOpen] = useState(false);

  const data: Form3DataV2 = dataV2 ?? createEmptyForm3V2(patientId);

  const infoCards = useMemo(
    () => listForm3InformationCards(data, { includeArchived: true }),
    [data],
  );

  const assessCards = useMemo(
    () => listForm3AssessmentCards(data, { includeArchived: true }),
    [data],
  );

  /** Evidence 候補: 一覧を見ながら選択できるよう全 Information を渡す */
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

  const applyEdit = useCallback(
    (next: Form3DataV2, reason: Form3V2AutosaveReason) => {
      markUserEditedV2(next, reason);
    },
    [markUserEditedV2],
  );

  const onAddInfo = useCallback(() => {
    applyEdit(addForm3InformationCard(data), "information_added");
  }, [applyEdit, data]);

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
    applyEdit(addForm3AssessmentCard(data), "assessment_added");
  }, [applyEdit, data]);

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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-[#F2F2F7]">
      <aside className="hidden h-full min-h-0 w-[min(40%,28rem)] shrink-0 border-r border-[#E5E5EA] lg:flex lg:flex-col">
        <Form3PatientSourcePanel
          key={patientId}
          patientId={patientId}
          patient={patient}
          facing={facingState}
        />
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#E5E5EA] bg-white/90 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
                様式3 · Phase B
              </p>
              <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[#1D1D1F]">
                {tab === "information" ? "Information Cards" : "Assessment Cards"}
              </h1>
              {patientName ? (
                <p className="mt-1 text-[14px] text-[#6E6E73]">{patientName}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <button
                type="button"
                className="min-h-[44px] rounded-2xl bg-[#F2F2F7] px-4 text-[15px] font-semibold text-[#1D1D1F] lg:hidden"
                onClick={() => setSourceSheetOpen(true)}
              >
                Patient Source
              </button>
              <div className="text-right">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                  {persistLabel.label}
                </p>
                <p className="text-[13px] text-[#6E6E73]">
                  {persistLabel.detailJa}
                </p>
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-3xl gap-2 px-4 pb-3 sm:px-6">
            <button
              type="button"
              className={`min-h-[44px] flex-1 rounded-2xl text-[15px] font-semibold ${
                tab === "information"
                  ? "bg-[#1D1D1F] text-white"
                  : "bg-[#F2F2F7] text-[#1D1D1F]"
              }`}
              onClick={() => setTab("information")}
            >
              Information
            </button>
            <button
              type="button"
              className={`min-h-[44px] flex-1 rounded-2xl text-[15px] font-semibold ${
                tab === "assessment"
                  ? "bg-[#1D1D1F] text-white"
                  : "bg-[#F2F2F7] text-[#1D1D1F]"
              }`}
              onClick={() => setTab("assessment")}
            >
              Assessment
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {tab === "information" ? (
            <Form3InformationCardList
              cards={infoCards}
              showArchived={showArchivedInfo}
              onToggleShowArchived={() => setShowArchivedInfo((v) => !v)}
              onAdd={onAddInfo}
              onPatch={onPatchInfo}
              onArchive={onArchiveInfo}
              onUnarchive={onUnarchiveInfo}
              onMoveUp={onMoveInfoUp}
              onMoveDown={onMoveInfoDown}
            />
          ) : (
            <Form3AssessmentCardList
              cards={assessCards}
              informationOptions={evidenceOptions}
              showArchived={showArchivedAssess}
              onToggleShowArchived={() => setShowArchivedAssess((v) => !v)}
              onAdd={onAddAssess}
              onPatch={onPatchAssess}
              onArchive={onArchiveAssess}
              onUnarchive={onUnarchiveAssess}
            />
          )}
        </div>
      </div>

      <Form3PatientSourceSheet
        open={sourceSheetOpen}
        onClose={() => setSourceSheetOpen(false)}
        patientId={patientId}
        patient={patient}
        facing={facingState}
      />
    </div>
  );
}
