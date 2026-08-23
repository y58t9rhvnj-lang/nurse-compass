"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { saveForm2Action } from "@/app/v2/actions/form2";
import { callAction } from "@/lib/v2/callAction";
import {
  createEmptyForm2,
  type Form2BasicInformation,
  type Form2Data,
  type Form2History,
  type Form2Period,
  type Form2Student,
  type Form2Treatment,
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
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";

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
//                       ├─────► error      (not_configured / unauthorized / validation / db_error /
//                       │                    network / unexpected ＝ 通信断・サーバ停止・Promise reject)
//                       └─────► conflict   (version 不一致 → 最新を取得して同梱)
//
//   ・Server Action 呼び出しは callAction 経由。reject（通信断・サーバ停止）は
//     network / unexpected へ正規化され、error へ遷移する（saving に固定されない）。
//   ・inFlightRef は finally で必ず解除する（reject でも解除される）。
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
  // 呼び出し側（AppShell）は「ページロード時のサーバ値」または「同一セッションで保存した最新
  // スナップショット」を渡す。保存の正本は常に Supabase で、これは初期表示の元にすぎない。
  initial: Form2Snapshot | null;
  // 保存成功時に、サーバが確定した最新スナップショット（payload / version / updatedAt）を親へ通知する。
  // AppShell はこれを患者単位のセッション snapshot として保持し、再マウント時の initial に再利用する
  //（ビュー往復での「表示巻き戻り」防止。DB 再取得や強制 reload は行わない）。
  onPersisted?: (snapshot: Form2Snapshot) => void;
  /** Version 2.2 講義デモ: Server Action / draft を使わずメモリ内のみ。 */
  localOnly?: boolean;
}

export function useForm2Supabase({
  patientId,
  userId,
  initial,
  onPersisted,
  localOnly: localOnlyProp = false,
}: UseForm2SupabaseArgs) {
  const lectureLocalOnly = useLectureLocalOnly();
  const localOnly = localOnlyProp || lectureLocalOnly;
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
  // onPersisted は毎レンダーで変わりうる（親がインライン関数を渡す）ため ref 経由で参照し、
  // doSave の依存に含めない（保存経路を安定させる）。アンマウント後の flush からも呼べる。
  const onPersistedRef = useRef(onPersisted);
  useEffect(() => {
    onPersistedRef.current = onPersisted;
  }, [onPersisted]);

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

    try {
      // 講義デモ: Server Action / draft に触れずメモリ内で確定扱い。
      if (localOnly) {
        const nextVersion = (versionRef.current ?? 0) + 1;
        const updatedAt = new Date().toISOString();
        versionRef.current = nextVersion;
        setLastSavedAt(updatedAt);
        setConflictLatest(null);
        onPersistedRef.current?.({
          payload: dataRef.current,
          version: nextVersion,
          updatedAt,
        });
        if (dirtyDuringSaveRef.current) {
          scheduleSave();
        } else {
          setSaveStatus("saved");
        }
        return;
      }

      // callAction は決して reject しない（reject は network / unexpected の Result に正規化）。
      const res = await callAction(() =>
        saveForm2Action({
          patientId,
          payload: dataRef.current,
          expectedVersion: versionRef.current,
        }),
      );

      if (res.ok) {
        versionRef.current = res.data.version;
        setLastSavedAt(res.data.updatedAt);
        clearForm2Draft(userId, caseId);
        setConflictLatest(null);
        // 保存成功＝サーバ確定値。親のセッション snapshot を更新し、再マウント時の initial に使わせる。
        // dataRef.current が今回保存した payload、res.data が確定 version / updatedAt。
        onPersistedRef.current?.({
          payload: dataRef.current,
          version: res.data.version,
          updatedAt: res.data.updatedAt,
        });
        if (dirtyDuringSaveRef.current) {
          // 保存中に編集された → 追随保存。
          scheduleSave();
        } else {
          setSaveStatus("saved");
        }
        return;
      }

      // 失敗時は入力を退避（成功するまで消えない）。通信断・サーバ停止でも消えない。
      writeForm2Draft(userId, caseId, {
        payload: dataRef.current,
        version: versionRef.current,
      });

      if (res.kind === "conflict") {
        setConflictLatest(res.latest);
        setSaveStatus("conflict");
        return;
      }

      // network / unexpected / validation / db_error 等はすべて error へ。
      setSaveStatus("error");
      // 軽量な自動再試行（編集がなくても復旧を試みる）。手動再試行も saveNow で可能。
      retryRef.current = setTimeout(() => {
        void saveRef.current();
      }, RETRY_DELAY_MS);
    } finally {
      // reject でも必ず解除し、saving のまま固定させない。
      inFlightRef.current = false;
    }
  }, [patientId, userId, caseId, clearTimers, scheduleSave, localOnly]);

  // saveRef を最新の doSave に同期（scheduleSave/タイマーから参照するため）。
  useEffect(() => {
    saveRef.current = doSave;
  }, [doSave]);

  // アンマウント時: 保留中の自動保存があれば破棄せず flush する。
  // ビュー切り替え（unmount）が debounce 待ちより先に起きても、未保存の編集を
  // Supabase へ確実に反映し、親のセッション snapshot（onPersisted）も更新させる。
  // これにより「保存前に画面移動 → 入力が消える」を防ぐ（保存の正本は Supabase のまま）。
  useEffect(() => {
    return () => {
      if (retryRef.current) {
        clearTimeout(retryRef.current);
        retryRef.current = null;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        // 保留中の編集を即時 flush（fire-and-forget）。onPersisted は AppShell 側で受ける。
        void saveRef.current();
      }
    };
  }, []);

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
    (patch: Partial<Form2Treatment>) =>
      onEdited({
        ...dataRef.current,
        treatment: { ...dataRef.current.treatment, ...patch },
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
