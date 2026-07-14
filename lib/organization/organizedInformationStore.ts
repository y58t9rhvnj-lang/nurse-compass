// Sprint11.3A: 情報（OrganizedInformation）の保存基盤。
//
// 患者別に「現在の情報」を保持し、情報IDごとに revision 履歴を保持する。
// Information Card ストア（lib/information/）とは別ストア（別 localStorage キー）。
//
// 設計方針（informationCardStore.ts と同様）:
//   - 純粋関数（state 変換）と localStorage 永続化層を分離する
//   - SSR / hydration で壊れない
//   - 不正保存データでクラッシュせず、安全に空状態へ戻す
//   - version を持ち、将来 migration できる
//   - patientId の混在を防ぐ（normalize 時にキーと patientId の一致を検証）
//
// 更新モデル:
//   - create で revision=1 の情報と revision エントリ1件を作る
//   - title / content / sourceDataId の変更は commit を通して revision を +1 し、
//     過去 revision を履歴へ残したまま current を差し替える（破壊的上書きをしない）
//   - archive / restore は status のみ変更し、revision は増やさない
//     （revision は title / content / sourceDataIds という「考えの中身」の変化を追う）
//   - 本 Sprint では UI へ接続しない（基盤のみ）

import type { InformationCard } from "../information/informationCard";
import {
  createOrganizedInformation,
  isOrganizedInformation,
  validateOrganizedInformation,
  validateSourceDataOwnership,
  type NewOrganizedInformationInput,
  type OrganizedInformation,
  type OrganizedInformationStatus,
} from "./organizedInformation";
import {
  createRevisionEntry,
  isOrganizedInformationRevision,
  type OrganizedInformationRevision,
} from "./organizedInformationHistory";

export const ORGANIZED_INFORMATION_STORE_VERSION = 1 as const;

export interface OrganizedInformationStoreState {
  version: typeof ORGANIZED_INFORMATION_STORE_VERSION;
  // 患者ID → 現在の情報配列（配列順が表示順）。
  currentByPatient: Record<string, OrganizedInformation[]>;
  // 情報ID → revision 履歴（古い順）。
  revisionsByInformationId: Record<string, OrganizedInformationRevision[]>;
}

export function emptyStoreState(): OrganizedInformationStoreState {
  return {
    version: ORGANIZED_INFORMATION_STORE_VERSION,
    currentByPatient: {},
    revisionsByInformationId: {},
  };
}

// ===== getters（純粋・localStorage 非依存） =====

export function getInformationByPatient(
  state: OrganizedInformationStoreState,
  patientId: string,
): OrganizedInformation[] {
  return state.currentByPatient[patientId] ?? [];
}

export function getInformationById(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
): OrganizedInformation | undefined {
  return (state.currentByPatient[patientId] ?? []).find((i) => i.id === id);
}

export function getRevisions(
  state: OrganizedInformationStoreState,
  informationId: string,
): OrganizedInformationRevision[] {
  return state.revisionsByInformationId[informationId] ?? [];
}

// ===== create =====

export interface CreateInformationResult {
  state: OrganizedInformationStoreState;
  information: OrganizedInformation;
}

// 情報を新規作成する（revision=1）。cards を渡すと患者整合性も検証する。
// 生成した情報を返すため、呼び出し側は id を得られる。
export function createInformation(
  state: OrganizedInformationStoreState,
  input: NewOrganizedInformationInput,
  options?: { cards?: InformationCard[] },
): CreateInformationResult {
  const info = createOrganizedInformation(input);
  if (options?.cards) {
    const own = validateSourceDataOwnership(
      info.patientId,
      info.sourceDataIds,
      options.cards,
    );
    if (!own.ok) {
      throw new Error(`Invalid source data ownership: ${own.errors.join("; ")}`);
    }
  }
  const entry = createRevisionEntry(info, { createdAt: info.createdAt });
  const list = state.currentByPatient[info.patientId] ?? [];
  return {
    information: info,
    state: {
      ...state,
      currentByPatient: {
        ...state.currentByPatient,
        [info.patientId]: [...list, info],
      },
      revisionsByInformationId: {
        ...state.revisionsByInformationId,
        [info.id]: [entry],
      },
    },
  };
}

// ===== update（revision を +1 し履歴を残す） =====

function commitUpdate(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  changes: Partial<
    Pick<OrganizedInformation, "title" | "content" | "sourceDataIds">
  >,
  options?: { cards?: InformationCard[] },
): OrganizedInformationStoreState {
  const list = state.currentByPatient[patientId] ?? [];
  const current = list.find((i) => i.id === id);
  if (!current) {
    throw new Error(`OrganizedInformation not found: ${patientId}/${id}`);
  }
  const now = new Date().toISOString();
  const revisions = state.revisionsByInformationId[id] ?? [];
  const latest =
    revisions.length > 0 ? revisions[revisions.length - 1] : undefined;

  const nextInfo: OrganizedInformation = {
    ...current,
    title:
      changes.title !== undefined ? changes.title.trim() : current.title,
    content:
      changes.content !== undefined ? changes.content.trim() : current.content,
    sourceDataIds:
      changes.sourceDataIds !== undefined
        ? [...changes.sourceDataIds]
        : current.sourceDataIds,
    id: current.id,
    patientId: current.patientId,
    createdAt: current.createdAt,
    createdBy: "student",
    revision: current.revision + 1,
    updatedAt: now,
    previousRevisionId: latest?.id,
  };

  const validation = validateOrganizedInformation(nextInfo);
  if (!validation.ok) {
    throw new Error(`Invalid update: ${validation.errors.join("; ")}`);
  }
  if (options?.cards) {
    const own = validateSourceDataOwnership(
      nextInfo.patientId,
      nextInfo.sourceDataIds,
      options.cards,
    );
    if (!own.ok) {
      throw new Error(`Invalid source data ownership: ${own.errors.join("; ")}`);
    }
  }

  const entry = createRevisionEntry(nextInfo, { createdAt: now });
  const nextList = list.map((i) => (i.id === id ? nextInfo : i));
  return {
    ...state,
    currentByPatient: { ...state.currentByPatient, [patientId]: nextList },
    revisionsByInformationId: {
      ...state.revisionsByInformationId,
      [id]: [...revisions, entry],
    },
  };
}

export function updateInformationTitle(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  title: string,
): OrganizedInformationStoreState {
  return commitUpdate(state, patientId, id, { title });
}

export function updateInformationContent(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  content: string,
): OrganizedInformationStoreState {
  return commitUpdate(state, patientId, id, { content });
}

// データ参照を追加する。同一情報内での重複は拒否する。
export function addSourceDataId(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  dataId: string,
  options?: { cards?: InformationCard[] },
): OrganizedInformationStoreState {
  const current = getInformationById(state, patientId, id);
  if (!current) {
    throw new Error(`OrganizedInformation not found: ${patientId}/${id}`);
  }
  if (current.sourceDataIds.includes(dataId)) {
    throw new Error(`duplicate sourceDataId: ${dataId}`);
  }
  return commitUpdate(
    state,
    patientId,
    id,
    { sourceDataIds: [...current.sourceDataIds, dataId] },
    options,
  );
}

// データ参照を除去する。最後の1件を除去して 0 件になる場合は検証で拒否される。
export function removeSourceDataId(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  dataId: string,
): OrganizedInformationStoreState {
  const current = getInformationById(state, patientId, id);
  if (!current) {
    throw new Error(`OrganizedInformation not found: ${patientId}/${id}`);
  }
  const next = current.sourceDataIds.filter((x) => x !== dataId);
  return commitUpdate(state, patientId, id, { sourceDataIds: next });
}

// ===== archive / restore（status のみ・revision は変えない） =====

function setStatus(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  status: OrganizedInformationStatus,
): OrganizedInformationStoreState {
  const list = state.currentByPatient[patientId] ?? [];
  const current = list.find((i) => i.id === id);
  if (!current) {
    throw new Error(`OrganizedInformation not found: ${patientId}/${id}`);
  }
  const next: OrganizedInformation = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
  };
  const nextList = list.map((i) => (i.id === id ? next : i));
  return {
    ...state,
    currentByPatient: { ...state.currentByPatient, [patientId]: nextList },
  };
}

export function archiveInformation(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
): OrganizedInformationStoreState {
  return setStatus(state, patientId, id, "archived");
}

// restore は既定で "organized" に戻す（Version1 では復帰先の細分化を行わない）。
export function restoreInformation(
  state: OrganizedInformationStoreState,
  patientId: string,
  id: string,
  status: Exclude<OrganizedInformationStatus, "archived"> = "organized",
): OrganizedInformationStoreState {
  return setStatus(state, patientId, id, status);
}

// ===== serialize / deserialize（安全） =====

export function serializeStore(state: OrganizedInformationStoreState): string {
  return JSON.stringify(state);
}

// 任意の unknown を安全に正規化する。壊れていれば空状態を返す。
export function normalizeStoreState(
  parsed: unknown,
): OrganizedInformationStoreState {
  if (typeof parsed !== "object" || parsed === null) return emptyStoreState();
  const p = parsed as Record<string, unknown>;
  if (p.version !== ORGANIZED_INFORMATION_STORE_VERSION) return emptyStoreState();

  const currentByPatient: Record<string, OrganizedInformation[]> = {};
  if (typeof p.currentByPatient === "object" && p.currentByPatient !== null) {
    for (const [patientId, list] of Object.entries(
      p.currentByPatient as Record<string, unknown>,
    )) {
      if (!Array.isArray(list)) continue;
      // 有効な情報のみ、かつ患者IDが一致するもののみ採用（患者間の混入を防ぐ）。
      const valid = list.filter(
        (i): i is OrganizedInformation =>
          isOrganizedInformation(i) && i.patientId === patientId,
      );
      if (valid.length > 0) currentByPatient[patientId] = valid;
    }
  }

  const revisionsByInformationId: Record<
    string,
    OrganizedInformationRevision[]
  > = {};
  if (
    typeof p.revisionsByInformationId === "object" &&
    p.revisionsByInformationId !== null
  ) {
    for (const [infoId, list] of Object.entries(
      p.revisionsByInformationId as Record<string, unknown>,
    )) {
      if (!Array.isArray(list)) continue;
      const valid = list.filter(
        (r): r is OrganizedInformationRevision =>
          isOrganizedInformationRevision(r) && r.informationId === infoId,
      );
      if (valid.length > 0) revisionsByInformationId[infoId] = valid;
    }
  }

  return {
    version: ORGANIZED_INFORMATION_STORE_VERSION,
    currentByPatient,
    revisionsByInformationId,
  };
}

export function deserializeStore(
  raw: string | null | undefined,
): OrganizedInformationStoreState {
  if (!raw) return emptyStoreState();
  try {
    return normalizeStoreState(JSON.parse(raw) as unknown);
  } catch {
    return emptyStoreState();
  }
}

// ===== localStorage 永続化層（SSR 安全・UI 未接続） =====

const STORAGE_KEY = "nc:organized-information";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadStore(): OrganizedInformationStoreState {
  if (!isBrowser()) return emptyStoreState();
  try {
    return deserializeStore(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyStoreState();
  }
}

export function saveStore(state: OrganizedInformationStoreState): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeStore(state));
  } catch {
    // 保存失敗（容量超過・プライベートモード等）は握りつぶす
  }
}
