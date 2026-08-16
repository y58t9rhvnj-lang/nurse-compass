"use client";

import { useCallback, useMemo, useState } from "react";
import Form3InformationCardList from "@/components/v2/form3/Form3InformationCardList";
import { getForm3PhaseBPersistLabel } from "@/components/v2/form3/form3PhaseBLabels";
import { useForm3Supabase } from "@/hooks/v2/useForm3Supabase";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { Form3V2AutosaveReason } from "@/lib/form3/v2/form3V2AutosaveReasons";
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
} from "@/lib/form3/v2/form3V2Types";
import type { Form3Snapshot } from "@/lib/v2/notebook/types";

export type Form3PhaseBWorkspaceProps = {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  patientName?: string;
};

/**
 * Form3 Phase B Workspace（B3 UI + B2-2C2 Autosave Activation）。
 * 操作後は markUserEditedV2(next, reason) のみ。
 * saveNowV2 は呼ばない（Hook 内 Controller が debounce → flush）。
 */
export default function Form3PhaseBWorkspace({
  patientId,
  userId,
  initial,
  patientName,
}: Form3PhaseBWorkspaceProps) {
  const {
    dataV2,
    markUserEditedV2,
    saveStatus,
    dirtyV2,
    hydrated,
    hasPersistedV2,
  } = useForm3Supabase({ patientId, userId, initial });

  const [showArchived, setShowArchived] = useState(false);

  const data: Form3DataV2 = dataV2 ?? createEmptyForm3V2(patientId);

  const cards = useMemo(
    () => listForm3InformationCards(data, { includeArchived: true }),
    [data],
  );

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

  const onAdd = useCallback(() => {
    applyEdit(addForm3InformationCard(data), "information_added");
  }, [applyEdit, data]);

  const onPatch = useCallback(
    (
      cardId: string,
      patch: {
        content?: string;
        soType?: Form3SoType | null;
        sourceType?: Form3InformationSourceType;
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

  const onArchive = useCallback(
    (cardId: string) => {
      applyEdit(
        archiveForm3InformationCard(data, cardId),
        "information_archived",
      );
    },
    [applyEdit, data],
  );

  const onUnarchive = useCallback(
    (cardId: string) => {
      applyEdit(
        unarchiveForm3InformationCard(data, cardId),
        "information_restored",
      );
    },
    [applyEdit, data],
  );

  const onMoveUp = useCallback(
    (cardId: string) => {
      applyEdit(
        moveForm3InformationCard(data, cardId, "up"),
        "information_reordered",
      );
    },
    [applyEdit, data],
  );

  const onMoveDown = useCallback(
    (cardId: string) => {
      applyEdit(
        moveForm3InformationCard(data, cardId, "down"),
        "information_reordered",
      );
    },
    [applyEdit, data],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#F2F2F7]">
      <header className="shrink-0 border-b border-[#E5E5EA] bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-end justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
              様式3 · Phase B
            </p>
            <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-[#1D1D1F]">
              Information Cards
            </h1>
            {patientName ? (
              <p className="mt-1 text-[14px] text-[#6E6E73]">{patientName}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8E8E93]">
              {persistLabel.label}
            </p>
            <p className="text-[13px] text-[#6E6E73]">{persistLabel.detailJa}</p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Form3InformationCardList
          cards={cards}
          showArchived={showArchived}
          onToggleShowArchived={() => setShowArchived((v) => !v)}
          onAdd={onAdd}
          onPatch={onPatch}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      </div>
    </div>
  );
}
