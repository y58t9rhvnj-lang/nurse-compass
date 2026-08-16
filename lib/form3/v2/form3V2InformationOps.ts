// Form3 Phase B3 — Information Card 操作（純関数・永続化なし）
// Autosave / saveNowV2 は呼ばない。呼び出し側が markUserEditedV2 する。

import type { Form3PatternKey } from "../form3Types";
import { createForm3CardId } from "./form3V2Factory";
import type {
  Form3DataV2,
  Form3InformationCardStatus,
  Form3InformationCardV2,
  Form3InformationSourceType,
  Form3SoType,
  Form3SourceReference,
} from "./form3V2Types";

export type Form3InformationCardPatch = Partial<{
  content: string;
  soType: Form3SoType | null;
  sourceType: Form3InformationSourceType;
  sourceReference: Form3SourceReference | null;
  sourceLabel: string | null;
  patternKeys: Form3PatternKey[];
  status: Form3InformationCardStatus;
}>;

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function reindexOrders(cards: Form3InformationCardV2[]): Form3InformationCardV2[] {
  return cards.map((c, index) => ({ ...c, order: index }));
}

function sortByOrder(cards: Form3InformationCardV2[]): Form3InformationCardV2[] {
  return [...cards].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** 表示用一覧。既定は active のみ。 */
export function listForm3InformationCards(
  data: Form3DataV2,
  options: { includeArchived?: boolean } = {},
): Form3InformationCardV2[] {
  const includeArchived = options.includeArchived === true;
  const filtered = data.informationCards.filter((c) =>
    includeArchived ? true : c.status === "active",
  );
  return sortByOrder(filtered);
}

export function createForm3InformationCard(
  options: {
    now?: string;
    order?: number;
  } = {},
): Form3InformationCardV2 {
  const t = nowIso(options.now);
  return {
    id: createForm3CardId(),
    content: "",
    soType: null,
    sourceType: "other",
    patternKeys: [],
    order: options.order ?? 0,
    status: "active",
    createdAt: t,
    updatedAt: t,
  };
}

export function addForm3InformationCard(
  data: Form3DataV2,
  options: { now?: string } = {},
): Form3DataV2 {
  const sorted = sortByOrder(data.informationCards);
  const card = createForm3InformationCard({
    now: options.now,
    order: sorted.length,
  });
  return {
    ...data,
    informationCards: [...sorted, card],
  };
}

export function updateForm3InformationCard(
  data: Form3DataV2,
  cardId: string,
  patch: Form3InformationCardPatch,
  options: { now?: string } = {},
): Form3DataV2 {
  const t = nowIso(options.now);
  return {
    ...data,
    informationCards: data.informationCards.map((c) => {
      if (c.id !== cardId) return c;
      const {
        sourceLabel,
        sourceReference,
        patternKeys,
        ...rest
      } = patch;
      const next: Form3InformationCardV2 = {
        ...c,
        ...rest,
        patternKeys: patternKeys ? [...new Set(patternKeys)] : c.patternKeys,
        updatedAt: t,
      };
      if (sourceLabel !== undefined) {
        if (sourceLabel === null || sourceLabel.trim() === "") {
          delete next.sourceLabel;
        } else {
          next.sourceLabel = sourceLabel;
        }
      }
      if (sourceReference !== undefined) {
        if (sourceReference === null) {
          delete next.sourceReference;
        } else {
          next.sourceReference = sourceReference;
        }
      }
      return next;
    }),
  };
}

/** 論理削除 = Archive */
export function archiveForm3InformationCard(
  data: Form3DataV2,
  cardId: string,
  options: { now?: string } = {},
): Form3DataV2 {
  return updateForm3InformationCard(
    data,
    cardId,
    { status: "archived" },
    options,
  );
}

export function unarchiveForm3InformationCard(
  data: Form3DataV2,
  cardId: string,
  options: { now?: string } = {},
): Form3DataV2 {
  return updateForm3InformationCard(
    data,
    cardId,
    { status: "active" },
    options,
  );
}

export function moveForm3InformationCard(
  data: Form3DataV2,
  cardId: string,
  direction: "up" | "down",
): Form3DataV2 {
  const sorted = sortByOrder(data.informationCards);
  const index = sorted.findIndex((c) => c.id === cardId);
  if (index < 0) return data;
  const current = sorted[index]!;
  // 同 status のカード同士でのみ並び替え（active 一覧で archive と入れ替わらない）
  let swapWith = direction === "up" ? index - 1 : index + 1;
  while (swapWith >= 0 && swapWith < sorted.length) {
    if (sorted[swapWith]!.status === current.status) break;
    swapWith += direction === "up" ? -1 : 1;
  }
  if (swapWith < 0 || swapWith >= sorted.length) return data;
  if (sorted[swapWith]!.status !== current.status) return data;
  const next = [...sorted];
  const tmp = next[index]!;
  next[index] = next[swapWith]!;
  next[swapWith] = tmp;
  return {
    ...data,
    informationCards: reindexOrders(next),
  };
}
