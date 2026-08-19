// Form3 Phase B4 — Assessment Card 操作（純関数・永続化なし）
// 根拠は Information ID 参照のみ（本文コピー禁止）。
// Autosave は呼び出し側が markUserEditedV2 する。

import type { Form3Judgment, Form3PatternKey } from "../form3Types";
import { createForm3CardId } from "./form3V2Factory";
import type {
  Form3AssessmentCardStatus,
  Form3AssessmentCardV2,
  Form3DataV2,
} from "./form3V2Types";

export type Form3AssessmentCardPatch = Partial<{
  interpretation: string;
  classification: Form3Judgment | null;
  evidenceInformationIds: string[];
  needMoreInformation: string;
  patternKey: Form3PatternKey | null;
  status: Form3AssessmentCardStatus;
}>;

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function sortByOrder(cards: Form3AssessmentCardV2[]): Form3AssessmentCardV2[] {
  return [...cards].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** 表示用一覧。既定は archived 以外。 */
export function listForm3AssessmentCards(
  data: Form3DataV2,
  options: { includeArchived?: boolean } = {},
): Form3AssessmentCardV2[] {
  const includeArchived = options.includeArchived === true;
  const filtered = data.assessmentCards.filter((c) =>
    includeArchived ? true : c.status !== "archived",
  );
  return sortByOrder(filtered);
}

export function createForm3AssessmentCard(
  options: {
    now?: string;
    order?: number;
    patternKey?: Form3PatternKey | null;
  } = {},
): Form3AssessmentCardV2 {
  const t = nowIso(options.now);
  return {
    id: createForm3CardId(),
    interpretation: "",
    classification: null,
    evidenceInformationIds: [],
    needMoreInformation: "",
    patternKey: options.patternKey === undefined ? null : options.patternKey,
    order: options.order ?? 0,
    status: "draft",
    createdAt: t,
    updatedAt: t,
  };
}

export function addForm3AssessmentCard(
  data: Form3DataV2,
  options: { now?: string; patternKey?: Form3PatternKey | null } = {},
): Form3DataV2 {
  const sorted = sortByOrder(data.assessmentCards);
  const card = createForm3AssessmentCard({
    now: options.now,
    order: sorted.length,
    patternKey: options.patternKey,
  });
  return {
    ...data,
    assessmentCards: [...sorted, card],
  };
}

export function updateForm3AssessmentCard(
  data: Form3DataV2,
  cardId: string,
  patch: Form3AssessmentCardPatch,
  options: { now?: string } = {},
): Form3DataV2 {
  const t = nowIso(options.now);
  const knownInfoIds = new Set(data.informationCards.map((c) => c.id));

  return {
    ...data,
    assessmentCards: data.assessmentCards.map((c) => {
      if (c.id !== cardId) return c;
      const next: Form3AssessmentCardV2 = {
        ...c,
        ...patch,
        updatedAt: t,
      };
      if (patch.evidenceInformationIds) {
        // ID 参照のみ・重複除去・存在しない ID は落とす（コピーはしない）
        const seen = new Set<string>();
        next.evidenceInformationIds = [];
        for (const id of patch.evidenceInformationIds) {
          if (!knownInfoIds.has(id)) continue;
          if (seen.has(id)) continue;
          seen.add(id);
          next.evidenceInformationIds.push(id);
        }
      }
      return next;
    }),
  };
}

/** 論理削除 = Archive */
export function archiveForm3AssessmentCard(
  data: Form3DataV2,
  cardId: string,
  options: { now?: string } = {},
): Form3DataV2 {
  return updateForm3AssessmentCard(
    data,
    cardId,
    { status: "archived" },
    options,
  );
}

/** Archive 解除 → draft（reviewed には戻さない） */
export function unarchiveForm3AssessmentCard(
  data: Form3DataV2,
  cardId: string,
  options: { now?: string } = {},
): Form3DataV2 {
  return updateForm3AssessmentCard(
    data,
    cardId,
    { status: "draft" },
    options,
  );
}

export function toggleForm3AssessmentEvidence(
  data: Form3DataV2,
  cardId: string,
  informationId: string,
  options: { now?: string } = {},
): Form3DataV2 {
  const card = data.assessmentCards.find((c) => c.id === cardId);
  if (!card) return data;
  const has = card.evidenceInformationIds.includes(informationId);
  const nextIds = has
    ? card.evidenceInformationIds.filter((id) => id !== informationId)
    : [...card.evidenceInformationIds, informationId];
  return updateForm3AssessmentCard(
    data,
    cardId,
    { evidenceInformationIds: nextIds },
    options,
  );
}
