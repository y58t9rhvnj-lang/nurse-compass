"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { saveForm2Action } from "@/app/v2/actions/form2";
import {
  createEmptyForm2,
  type Form2BasicInformation,
  type Form2Data,
  type Form2History,
  type Form2Period,
  type Form2Student,
} from "@/lib/form2/form2Types";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  clearForm2Draft,
  getForm2DraftServerSnapshot,
  getForm2DraftSnapshot,
  subscribeForm2Draft,
  writeForm2Draft,
} from "@/lib/v2/notebook/form2Draft";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";

// 精神様式2 を Supabase（Server Action 経由）へ保存する V2 専用フック。
// V1 の useForm2 / form2Store（localStorage）には一切依存しない。
//
// 保存状態の状態遷移（この遷移を維持すること）:
//
//            (編集)
//     idle ─────────► dirty
//                       │  debounce(1000ms) / 手動保存(flush)
//                       ▼
//                     saving
//                       ├─────► saved      (ok)
//                       ├─────► error      (not_configured / unauthorized / validation / db_error)
//                       └─────► conflict   (version 不一致 → 最新を取得して同梱)
//
//   ・saving 中の編集は dirtyDuringSave として記録し、保存完了後に dirty へ戻して再保存する。
//   ・error は自動再試行（一定間隔）＋手動再試行で saving へ戻る。入力は下書きへ退避して失わない。
//   ・conflict は「最新を読み込む」のみ実装（サーバ最新を採用して saved）。
//     「自分の内容で上書き保存」は差分マージ Phase まで保留（今回は未実装）。
//   ・saved / idle から編集すると再び dirty。

const AUTOSAVE_DEBOUNCE_MS = 1000;
const RETRY_DELAY_MS = 8000;

export type Form2SaveStatus =
  | "idle"
  | "dirty"
  | "saving"
  | "saved"
  | "error"
  | "conflict";

export interface UseForm2SupabaseArgs {
  patientId: string;
  userId: string;
  // Server Component が Repository で直接取得した初期スナップショット（無ければ null）。
  initial: Form2Snapshot | null;
}

export function useForm2Supabase({
  patientId,
  userId,
  initial,
}: UseForm2SupabaseArgs) {
  const caseId = caseIdForPatient(patientId) ?? patientId;

  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // 下書き（保存失敗/競合時の退避）を購読する。安定参照・SSRでは null。
  const draft = useSyncExternalStore(
    subscribeForm2Draft,
    () => getForm2DraftSnapshot(userId, caseId),
    getForm2DraftServerSnapshot,
  );

  const [data, setData] = useState<Form2Data>(
    () => initial?.payload ?? createEmptyForm2(patientId),
  );
  const [saveStatus, setSaveStatus] = useState<Form2SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string>(initial?.updatedAt ?? "");
  const [conflictLatest, setConflictLatest] = useState<Form2Snapshot | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const dataRef = useRef<Form2Data>(data);
  const versionRef = useRef<number | null>(initial?.version ?? null);
  const inFlightRef = useRef(false);
  const dirtyDuringSaveRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});

  const setDataAndRef = useCallback((next: Form2Data) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const clearTimers = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveStatus((prev) => (prev === "saving" ? prev : "dirty"));
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void saveRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const doSave = useCallback(async () => {
    clearTimers();
    // 多重実行防止。保存中の要求は完了後に追随保存する。
    if (inFlightRef.current) {
      dirtyDuringSaveRef.current = true;
      return;
    }
    inFlightRef.current = true;
    dirtyDuringSaveRef.current = false;
    setSaveStatus("saving");

    const res = await saveForm2Action({
      patientId,
      payload: dataRef.current,
      expectedVersion: versionRef.current,
    });

    inFlightRef.current = false;

    if (res.ok) {
      versionRef.current = res.data.version;
      setLastSavedAt(res.data.updatedAt);
      clearForm2Draft(userId, caseId);
      setConflictLatest(null);
      if (dirtyDuringSaveRef.current) {
        // 保存中に編集された → 追随保存。
        scheduleSave();
      } else {
        setSaveStatus("saved");
      }
      return;
    }

    // 失敗時は入力を退避（成功するまで消えない）。
    writeForm2Draft(userId, caseId, {
      payload: dataRef.current,
      version: versionRef.current,
    });

    if (res.kind === "conflict") {
      setConflictLatest(res.latest);
      setSaveStatus("conflict");
      return;
    }

    setSaveStatus("error");
    // 軽量な自動再試行（編集がなくても復旧を試みる）。
    retryRef.current = setTimeout(() => {
      void saveRef.current();
    }, RETRY_DELAY_MS);
  }, [patientId, userId, caseId, clearTimers, scheduleSave]);

  // saveRef を最新の doSave に同期（scheduleSave/タイマーから参照するため）。
  useEffect(() => {
    saveRef.current = doSave;
  }, [doSave]);

  // アンマウント時にタイマーを破棄。
  useEffect(() => clearTimers, [clearTimers]);

  // 未保存の変更がある間は離脱を警告する。
  useEffect(() => {
    const unsaved =
      saveStatus === "dirty" ||
      saveStatus === "saving" ||
      saveStatus === "error" ||
      saveStatus === "conflict";
    if (!unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saveStatus]);

  // 編集ハンドラ共通処理。保存中なら追随フラグのみ、そうでなければデバウンス保存。
  const onEdited = useCallback(
    (next: Form2Data) => {
      setDataAndRef(next);
      if (inFlightRef.current) {
        dirtyDuringSaveRef.current = true;
        return;
      }
      scheduleSave();
    },
    [setDataAndRef, scheduleSave],
  );

  const updateBasic = useCallback(
    (patch: Partial<Form2BasicInformation>) =>
      onEdited({
        ...dataRef.current,
        basicInformation: { ...dataRef.current.basicInformation, ...patch },
      }),
    [onEdited],
  );
  const updateHistory = useCallback(
    (patch: Partial<Form2History>) =>
      onEdited({
        ...dataRef.current,
        history: { ...dataRef.current.history, ...patch },
      }),
    [onEdited],
  );
  const updateTreatment = useCallback(
    (value: string) =>
      onEdited({
        ...dataRef.current,
        treatment: { ...dataRef.current.treatment, policyAndContent: value },
      }),
    [onEdited],
  );
  const updateStudent = useCallback(
    (patch: Partial<Form2Student>) =>
      onEdited({
        ...dataRef.current,
        student: { ...dataRef.current.student, ...patch },
      }),
    [onEdited],
  );
  const updatePeriod = useCallback(
    (patch: Partial<Form2Period>) =>
      onEdited({
        ...dataRef.current,
        period: { ...dataRef.current.period, ...patch },
      }),
    [onEdited],
  );

  // 手動保存（デバウンス待ちを即時 flush）。error からの再試行も同じ経路。
  const saveNow = useCallback(() => {
    void saveRef.current();
  }, []);

  // 競合解決：サーバ最新を採用する（自分の編集は破棄）。上書き保存は今回未実装。
  const loadLatest = useCallback(() => {
    if (!conflictLatest) return;
    setDataAndRef(conflictLatest.payload);
    versionRef.current = conflictLatest.version;
    setLastSavedAt(conflictLatest.updatedAt);
    clearForm2Draft(userId, caseId);
    setConflictLatest(null);
    setSaveStatus("saved");
  }, [conflictLatest, setDataAndRef, userId, caseId]);

  // 下書き復元候補（ハイドレーション後・未破棄のときのみ）。
  const pendingDraft: Form2Data | null =
    hydrated && !draftDismissed && draft ? draft.payload : null;

  const restoreDraft = useCallback(() => {
    if (!draft) return;
    setDataAndRef(draft.payload);
    versionRef.current = draft.version;
    setDraftDismissed(true);
    scheduleSave();
  }, [draft, setDataAndRef, scheduleSave]);

  const discardDraft = useCallback(() => {
    clearForm2Draft(userId, caseId);
    setDraftDismissed(true);
  }, [userId, caseId]);

  return {
    data,
    hydrated,
    saveStatus,
    lastSavedAt,
    hasConflict: saveStatus === "conflict",
    conflictLatest,
    pendingDraft,
    updateBasic,
    updateHistory,
    updateTreatment,
    updateStudent,
    updatePeriod,
    saveNow,
    retry: saveNow,
    loadLatest,
    restoreDraft,
    discardDraft,
  };
}
