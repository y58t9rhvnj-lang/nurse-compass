// 患者会話（Compass Coach の状態を含む FacingConvoState）の端末内永続化層。
//
// Version1 の範囲: DB・ログイン・クラウド同期は使わず、localStorage にのみ保存する。
// 学生ごと・端末ごとに保存され、同じ端末・同じブラウザでのみ「続きから」再開できる。
// 患者ごとにキーを分離し、他患者や他端末とは共有しない。
//
// 保存対象は FacingConvoState 全体（history に加え、話題進行・Coach ヒント状態も含む）。
// Compass Coach は別ストアを持たず、この state から表示が導出されるため、
// このモジュールで会話と Coach の学習継続に必要な状態がまとめて復元される。

import {
  type FacingConvoState,
  initialFacingState,
} from "./patientFacingData";

// 保存データ構造のバージョン。将来 FacingConvoState の形が変わっても、
// 古い保存データで画面が壊れないよう、不一致時は安全に初期状態へ戻す。
export const FACING_CONVO_VERSION = 1 as const;

const KEY_PREFIX = "compass:v1:patient-conversation:";

// useSyncExternalStore 用のキャッシュ・購読者。
// 気づきメモ（notesStore）と同方針で、localStorage をクライアント専用の外部ストアとして扱い、
// SSR/ハイドレーション不整合を避けつつ、変更を即時反映する。
const cache = new Map<string, FacingConvoState>();
const listeners = new Set<() => void>();
// サーバー描画・ハイドレーション初回描画で使う安定参照（history は空）。
const SERVER_STATE: FacingConvoState = initialFacingState();

export interface StoredFacingConvo {
  version: number;
  patientId: string;
  updatedAt: string;
  state: FacingConvoState;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function facingConvoKey(patientId: string): string {
  return `${KEY_PREFIX}${patientId}`;
}

const VALID_ROLES = new Set(["student", "patient", "coach"]);

// history 配列を安全に検証する（不正な要素は落とし、順番と話者区分・ID は維持する）。
function sanitizeHistory(value: unknown): FacingConvoState["history"] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is FacingConvoState["history"][number] => {
    if (typeof entry !== "object" || entry === null) return false;
    const role = (entry as { role?: unknown }).role;
    return typeof role === "string" && VALID_ROLES.has(role);
  });
}

/**
 * 保存済みの患者会話を読み込む。
 * - データが無い / 壊れたJSON / 旧バージョン / 不正な形 の場合は null を返す（＝初期状態から開始）。
 * - 既存の initialFacingState() をベースに復元し、将来追加されたフィールドは既定値で補う。
 * - parse は try/catch で保護し、いかなる場合もアプリを停止させない。
 */
export function loadFacingConvo(patientId: string): FacingConvoState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(facingConvoKey(patientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const rec = parsed as Partial<StoredFacingConvo>;
    if (rec.version !== FACING_CONVO_VERSION) return null; // 旧形式は安全に初期化
    if (rec.patientId !== patientId) return null;
    if (typeof rec.state !== "object" || rec.state === null) return null;

    const saved = rec.state as Partial<FacingConvoState>;
    // 既定値の上に保存値を重ね、history のみ厳密に検証する（後方互換）。
    const restored: FacingConvoState = {
      ...initialFacingState(),
      ...saved,
      history: sanitizeHistory((saved as FacingConvoState).history),
    };
    return restored;
  } catch {
    // 壊れたデータ等は復元せず初期状態へ（画面は止めない）。
    return null;
  }
}

/**
 * 患者会話を保存する。容量超過・プライベートモード等の失敗は握りつぶし、画面を止めない。
 * 呼び出しは会話が変化したユーザー操作時のみ（初期レンダリングでは呼ばない）。
 */
export function saveFacingConvo(
  patientId: string,
  state: FacingConvoState,
): void {
  if (!isBrowser()) return;
  try {
    const payload: StoredFacingConvo = {
      version: FACING_CONVO_VERSION,
      patientId,
      updatedAt: new Date().toISOString(),
      state,
    };
    window.localStorage.setItem(
      facingConvoKey(patientId),
      JSON.stringify(payload),
    );
  } catch {
    // 保存失敗は無視（QuotaExceeded / Safari プライベート等）。
  }
}

/** 保存済みの患者会話を localStorage から削除する（初期化用）。 */
function removeStored(patientId: string): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(facingConvoKey(patientId));
  } catch {
    // 失敗は無視。
  }
}

// --- useSyncExternalStore 用 API ---

function emit(): void {
  for (const l of listeners) l();
}

// 別タブでの変更（storage イベント）にも追従する。
export function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key && e.key.startsWith(KEY_PREFIX)) {
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

// 患者ごとの会話状態を返す（安定参照）。初回は localStorage から復元し、
// 無ければ初期状態。以降は setFacingConvo で置き換わるまで同じ参照を返す。
export function getSnapshot(patientId: string): FacingConvoState {
  const cached = cache.get(patientId);
  if (cached) return cached;
  const loaded = loadFacingConvo(patientId) ?? initialFacingState();
  cache.set(patientId, loaded);
  return loaded;
}

// サーバー描画・ハイドレーション初回は常に空の初期状態（安定参照）。
export function getServerSnapshot(): FacingConvoState {
  return SERVER_STATE;
}

// 会話状態を更新し、localStorage へ保存して購読者へ通知する。
// 会話が変化したユーザー操作時のみ呼ばれる（初期レンダリングでは呼ばれない）。
export function setFacingConvo(
  patientId: string,
  next: FacingConvoState,
): void {
  cache.set(patientId, next);
  saveFacingConvo(patientId, next);
  emit();
}

/** 保存済みの患者会話を初期状態へ戻す（localStorage 削除＋購読者へ通知）。 */
export function clearFacingConvo(patientId: string): void {
  removeStored(patientId);
  cache.set(patientId, initialFacingState());
  emit();
}
