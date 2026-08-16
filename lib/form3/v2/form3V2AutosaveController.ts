// Form3 Phase B2-2C1 — Autosave Engine（Controller）
// Phase B2-2C2 — Hook が enableTimer: true で Activation（本ファイルの保存ロジックは不変）
//
// 目的:
//   debounce 予約 / pending / cancel / flush / Save Gate / saveNowV2 接続
//
// 制約:
//   ・タイマー既定は起動しない（enableTimer: false）。C2 で Hook が true を渡す
//   ・Migration のみでは schedule されない
//   ・schedule だけでは保存しない。flush（または timer）で saveNowV2

import type { Form3V2AutosaveReason } from "./form3V2AutosaveReasons";
import {
  canPersistForm3V2,
  type CanPersistForm3V2Input,
  type Form3V2PersistGateResult,
} from "./form3V2SaveGate";

export const FORM3_V2_AUTOSAVE_DEBOUNCE_MS_DEFAULT = 1000;

export type Form3V2AutosaveSaveResult =
  | { ok: true; kind: "saved" }
  | { ok: false; kind: "gate_rejected"; gate: Form3V2PersistGateResult }
  | { ok: false; kind: "conflict" }
  | { ok: false; kind: "error"; message?: string }
  | { ok: false; kind: "skipped"; reason: "not_pending" | "already_saving" };

export type Form3V2AutosaveControllerState = {
  /** debounce 予約中（まだ保存していない） */
  pending: boolean;
  /** flush / saveNowV2 実行中 */
  saving: boolean;
  /** 保存中に再 schedule された（保存キュー） */
  queued: boolean;
  debounceMs: number;
  /** C1 では通常 false。true のときのみ setTimeout を使う */
  timerEnabled: boolean;
  /** タイマーが実際にセットされているか */
  timerArmed: boolean;
  /** 直近の notifyDirty reason（C2） */
  lastReason: Form3V2AutosaveReason | null;
};

export type Form3V2AutosaveControllerDeps = {
  /** 毎回最新の Gate 入力を返す */
  getGateInput: () => CanPersistForm3V2Input;
  /** B2-2B の明示保存（saveNowV2）と同等の関数 */
  saveNowV2: () => Promise<Form3V2AutosaveSaveResult>;
  debounceMs?: number;
  /**
   * true のときだけ debounce 後に自動 flush。
   * B2-2C1 既定は false（タイマー起動禁止）。
   */
  enableTimer?: boolean;
  setTimeoutFn?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void;
};

export type Form3V2AutosaveController = {
  getState: () => Form3V2AutosaveControllerState;
  /**
   * dirty 監視入口。
   * dirty && hasUserEdited のときだけ debounce 予約。
   * Migration（未編集）では予約しない。
   */
  notifyDirty: (flags: {
    dirty: boolean;
    hasUserEdited: boolean;
    reason?: Form3V2AutosaveReason;
  }) => void;
  /** 明示的に debounce 予約（Gate の dirty/edited も確認） */
  schedule: () => void;
  /** 予約キャンセル（保存しない） */
  cancel: () => void;
  /**
   * 即時保存。pending を消費し Save Gate → saveNowV2。
   * schedule なしでも、Gate を満たせば保存する（明示 flush）。
   */
  flush: (opts?: { requirePending?: boolean }) => Promise<Form3V2AutosaveSaveResult>;
};

/**
 * Autosave Controller を生成する。
 * React / Repository / Server Action には依存しない。
 */
export function createForm3V2AutosaveController(
  deps: Form3V2AutosaveControllerDeps,
): Form3V2AutosaveController {
  const debounceMs = deps.debounceMs ?? FORM3_V2_AUTOSAVE_DEBOUNCE_MS_DEFAULT;
  const timerEnabled = deps.enableTimer === true;
  const setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;

  let pending = false;
  let saving = false;
  let queued = false;
  let lastReason: Form3V2AutosaveReason | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timerId !== null) {
      clearTimeoutFn(timerId);
      timerId = null;
    }
  }

  function getState(): Form3V2AutosaveControllerState {
    return {
      pending,
      saving,
      queued,
      debounceMs,
      timerEnabled,
      timerArmed: timerId !== null,
      lastReason,
    };
  }

  function armTimerIfEnabled() {
    if (!timerEnabled) return;
    clearTimer();
    timerId = setTimeoutFn(() => {
      timerId = null;
      void flush();
    }, debounceMs);
  }

  function schedule(): void {
    const gateInput = deps.getGateInput();
    // Migration / 未編集は予約しない
    if (!gateInput.hasUserEdited || !gateInput.dirty) {
      return;
    }
    if (gateInput.hasConflict || gateInput.saveStatus === "conflict") {
      return;
    }
    if (saving) {
      queued = true;
      pending = true;
      return;
    }
    pending = true;
    armTimerIfEnabled();
  }

  function notifyDirty(flags: {
    dirty: boolean;
    hasUserEdited: boolean;
    reason?: Form3V2AutosaveReason;
  }): void {
    if (flags.reason !== undefined) {
      lastReason = flags.reason;
    }
    if (!flags.dirty || !flags.hasUserEdited) {
      return;
    }
    schedule();
  }

  function cancel(): void {
    clearTimer();
    pending = false;
    queued = false;
  }

  async function flush(opts?: {
    requirePending?: boolean;
  }): Promise<Form3V2AutosaveSaveResult> {
    const requirePending = opts?.requirePending === true;
    clearTimer();

    if (requirePending && !pending && !queued) {
      return { ok: false, kind: "skipped", reason: "not_pending" };
    }
    if (saving) {
      queued = true;
      pending = true;
      return { ok: false, kind: "skipped", reason: "already_saving" };
    }

    const gate = canPersistForm3V2(deps.getGateInput());
    if (!gate.allowed) {
      // Gate 拒否時は予約を残すか消すか: dirty が満たない場合は消す
      if (
        gate.reason === "not_dirty" ||
        gate.reason === "not_user_edited" ||
        gate.reason === "feature_disabled"
      ) {
        pending = false;
        queued = false;
      }
      return { ok: false, kind: "gate_rejected", gate };
    }

    pending = false;
    saving = true;
    try {
      const result = await deps.saveNowV2();
      if (result.ok) {
        queued = false;
        return result;
      }
      // 失敗時は pending を戻して再試行可能に（自動再 schedule は C1 ではしない）
      if (result.kind === "conflict" || result.kind === "error") {
        // conflict では Gate が弾くので queued は落とす
        queued = false;
      }
      return result;
    } finally {
      saving = false;
      if (queued) {
        // 保存キュー: 再予約のみ（タイマーは C1 では起動しない）
        pending = true;
        queued = false;
        armTimerIfEnabled();
      }
    }
  }

  return {
    getState,
    notifyDirty,
    schedule,
    cancel,
    flush,
  };
}
