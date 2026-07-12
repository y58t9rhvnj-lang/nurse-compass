// Sprint11.1: Information Card 保存基盤。
// 患者別にカードを保持し、追加・更新・削除・並び替え（順序保持）に対応する。
// localStorage ベースだが、純粋関数（state 変換）と永続化層を分離しており、
// UI からの操作は本 Sprint では行わない（基盤のみ）。
// SSR / hydration で壊れず、不正データ時は安全に空状態へ戻る。version で将来 migration 可能。

import {
  isInformationCard,
  type InformationCard,
} from "./informationCard";

export const INFORMATION_CARD_STORE_VERSION = 1 as const;

export interface InformationCardStoreState {
  version: typeof INFORMATION_CARD_STORE_VERSION;
  // 患者ID → カード配列（配列順が表示順。並び替えに備えて順序を保持する）。
  cardsByPatient: Record<string, InformationCard[]>;
}

export function emptyStoreState(): InformationCardStoreState {
  return { version: INFORMATION_CARD_STORE_VERSION, cardsByPatient: {} };
}

// ===== 純粋関数 CRUD（state を受け取り新しい state を返す・localStorage 非依存） =====

export function getCards(
  state: InformationCardStoreState,
  patientId: string,
): InformationCard[] {
  return state.cardsByPatient[patientId] ?? [];
}

export function addCard(
  state: InformationCardStoreState,
  card: InformationCard,
): InformationCardStoreState {
  const list = state.cardsByPatient[card.patientId] ?? [];
  return {
    ...state,
    cardsByPatient: {
      ...state.cardsByPatient,
      [card.patientId]: [...list, card],
    },
  };
}

export function updateCard(
  state: InformationCardStoreState,
  patientId: string,
  id: string,
  patch: Partial<Omit<InformationCard, "id" | "patientId">>,
): InformationCardStoreState {
  const list = state.cardsByPatient[patientId] ?? [];
  const next = list.map((c) =>
    c.id === id ? { ...c, ...patch, id: c.id, patientId: c.patientId } : c,
  );
  return {
    ...state,
    cardsByPatient: { ...state.cardsByPatient, [patientId]: next },
  };
}

export function deleteCard(
  state: InformationCardStoreState,
  patientId: string,
  id: string,
): InformationCardStoreState {
  const list = state.cardsByPatient[patientId] ?? [];
  return {
    ...state,
    cardsByPatient: {
      ...state.cardsByPatient,
      [patientId]: list.filter((c) => c.id !== id),
    },
  };
}

// 並び替え：orderedIds の順に並べ、指定外のカードは末尾へ元順で残す（欠落・過剰に強い）。
export function reorderCards(
  state: InformationCardStoreState,
  patientId: string,
  orderedIds: string[],
): InformationCardStoreState {
  const list = state.cardsByPatient[patientId] ?? [];
  const byId = new Map(list.map((c) => [c.id, c]));
  const ordered: InformationCard[] = [];
  for (const id of orderedIds) {
    const card = byId.get(id);
    if (card) {
      ordered.push(card);
      byId.delete(id);
    }
  }
  for (const c of list) if (byId.has(c.id)) ordered.push(c);
  return {
    ...state,
    cardsByPatient: { ...state.cardsByPatient, [patientId]: ordered },
  };
}

// ===== serialize / deserialize（安全） =====

export function serializeStore(state: InformationCardStoreState): string {
  return JSON.stringify(state);
}

// 任意の unknown を安全に正規化する。壊れていれば空状態を返す。
// version 不一致は将来の migration ポイント（現状は空へフォールバック）。
export function normalizeStoreState(
  parsed: unknown,
): InformationCardStoreState {
  if (typeof parsed !== "object" || parsed === null) return emptyStoreState();
  const p = parsed as Record<string, unknown>;
  if (p.version !== INFORMATION_CARD_STORE_VERSION) return emptyStoreState();
  if (typeof p.cardsByPatient !== "object" || p.cardsByPatient === null)
    return emptyStoreState();

  const src = p.cardsByPatient as Record<string, unknown>;
  const cardsByPatient: Record<string, InformationCard[]> = {};
  for (const [patientId, list] of Object.entries(src)) {
    if (!Array.isArray(list)) continue;
    // 有効なカードのみ、かつ患者IDが一致するもののみ採用（患者間の混入を防ぐ）。
    const valid = list.filter(
      (c): c is InformationCard =>
        isInformationCard(c) && c.patientId === patientId,
    );
    if (valid.length > 0) cardsByPatient[patientId] = valid;
  }
  return { version: INFORMATION_CARD_STORE_VERSION, cardsByPatient };
}

export function deserializeStore(
  raw: string | null | undefined,
): InformationCardStoreState {
  if (!raw) return emptyStoreState();
  try {
    return normalizeStoreState(JSON.parse(raw) as unknown);
  } catch {
    return emptyStoreState();
  }
}

// ===== localStorage 永続化層（SSR 安全・UI 未接続） =====

const STORAGE_KEY = "nc:information-cards";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadStore(): InformationCardStoreState {
  if (!isBrowser()) return emptyStoreState();
  try {
    return deserializeStore(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyStoreState();
  }
}

export function saveStore(state: InformationCardStoreState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStore(state));
  } catch {
    // 保存失敗（容量超過・プライベートモード等）は握りつぶす
  }
}

// 永続化つき CRUD（load → 変換 → save）。UI からはまだ呼ばない。
export function addCardPersistent(card: InformationCard): InformationCard {
  saveStore(addCard(loadStore(), card));
  return card;
}

// ===== 重複判定（会話エントリID基準） =====

// 患者発言カードの重複は、本文ではなく sourceReference の会話エントリIDで判定する。
// 同じ内容でも別エントリ（別ID）なら別カードとして追加できる。
export function hasCardForEntry(
  cards: InformationCard[],
  entryId: string,
): boolean {
  return cards.some(
    (c) =>
      c.sourceReference?.kind === "patient_conversation" &&
      c.sourceReference.id === entryId,
  );
}

// ===== React 購読用リアクティブ層（useSyncExternalStore） =====
// 「追加済み」表示は UI ローカル state ではなく、この store から導出する。
// localStorage 永続のため、リロード・カルテ往復後も追加済み状態が復元される。

const cache = new Map<string, InformationCard[]>();
const listeners = new Set<() => void>();
const EMPTY: InformationCard[] = [];

function emit(): void {
  for (const l of listeners) l();
}

// 別タブでの localStorage 変更にも追従する。
export function subscribeCards(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache.clear();
      emit();
    }
  };
  if (isBrowser()) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    if (isBrowser()) window.removeEventListener("storage", onStorage);
  };
}

// 安定参照を返す（空配列もキャッシュして useSyncExternalStore のループを防ぐ）。
export function getCardsSnapshot(patientId: string): InformationCard[] {
  const cached = cache.get(patientId);
  if (cached) return cached;
  const loaded = getCards(loadStore(), patientId);
  cache.set(patientId, loaded);
  return loaded;
}

// サーバー描画時は常に空（安定参照）。
export function getServerCardsSnapshot(): InformationCard[] {
  return EMPTY;
}

// 患者発言などから 1 枚のカードを追加し、キャッシュ更新＋購読者へ通知する。
// patientId 単位でキャッシュするため、患者の取り違えは起きない。
export function addCardForPatient(
  patientId: string,
  card: InformationCard,
): InformationCard {
  const next = addCard(loadStore(), card);
  saveStore(next);
  cache.set(patientId, getCards(next, patientId));
  emit();
  return card;
}

export function updateCardPersistent(
  patientId: string,
  id: string,
  patch: Partial<Omit<InformationCard, "id" | "patientId">>,
): void {
  saveStore(updateCard(loadStore(), patientId, id, patch));
}

export function deleteCardPersistent(patientId: string, id: string): void {
  saveStore(deleteCard(loadStore(), patientId, id));
}

export function getCardsPersistent(patientId: string): InformationCard[] {
  return getCards(loadStore(), patientId);
}
