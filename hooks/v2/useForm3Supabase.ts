"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { saveForm3Action, saveForm3V2Action } from "@/app/v2/actions/form3";
import { callAction } from "@/lib/v2/callAction";
import { type Form3Data, type Form3PatternKey } from "@/lib/form3/form3Types";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
import {
  hydrateForm3ReadFromSnapshotPayload,
  type Form3ReadHydration,
} from "@/lib/form3/v2/form3V2ReadPath";
import type { Form3SnapshotV2 } from "@/lib/form3/v2/form3V2Mapper";
import type { Form3V2PersistGateResult } from "@/lib/form3/v2/form3V2SaveGate";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";
import {
  createForm3V2AutosaveController,
  type Form3V2AutosaveController,
  type Form3V2AutosaveSaveResult,
} from "@/lib/form3/v2/form3V2AutosaveController";
import type { Form3V2AutosaveReason } from "@/lib/form3/v2/form3V2AutosaveReasons";
import {
  applyForm3V2SaveConflict,
  applyForm3V2SaveError,
  applyForm3V2SaveSuccess,
  createInitialForm3V2WriteFlags,
  evaluateForm3V2ExplicitSave,
  markForm3V2UserEdited,
  resolveHasPersistedV2,
  shouldClearForm3V2DraftOnSaveSuccess,
  shouldWriteForm3V2DraftOnSaveFailure,
  type Form3V2WriteFlags,
} from "@/lib/form3/v2/form3V2WritePath";
import {
  clearForm3V2Draft,
  writeForm3V2Draft,
} from "@/lib/form3/v2/form3V2Draft";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  clearForm3Draft,
  getForm3DraftServerSnapshot,
  getForm3DraftSnapshot,
  subscribeForm3Draft,
  writeForm3Draft,
} from "@/lib/v2/notebook/form3Draft";
import {
  applyPatternField,
  initialForm3Data,
  initialForm3SaveStatusAfterRead,
  interpretForm3SaveResult,
  markPatternReviewed,
  resolveConflictWithLatest,
  unmarkPatternReviewed,
  type Form3PatternField,
  type Form3SaveStatus,
} from "@/lib/v2/notebook/form3HookLogic";
import type {
  Form3SaveWarning,
  Form3Snapshot,
} from "@/lib/v2/notebook/types";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";

// 様式3 を Supabase（Server Action 経由）へ保存する V2 専用フック。
//
// Version2.1: Form3 Phase B（v2 読込・明示保存・Autosave）を正式経路とする。
// 旧 v1 autosave 経路は Form3Workspace 比較用に残置（通常導線では未使用）。

const AUTOSAVE_DEBOUNCE_MS = 1000;

/** Phase B は Version2.1 で常時有効（feature flag 撤去済み）。 */
const PHASE_B_ENABLED = true;

export type { Form3SaveStatus, Form3PatternField };

export interface UseForm3SupabaseArgs {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  onPersisted?: (snapshot: Form3Snapshot) => void;
  /** Phase B 明示保存成功時（UI 未接続でも可） */
  onPersistedV2?: (snapshot: Form3SnapshotV2) => void;
  /** Version 2.2 講義デモ: Server Action / draft を使わずメモリ内のみ。 */
  localOnly?: boolean;
}

export type SaveNowV2Result =
  | { ok: true; kind: "saved"; snapshot: Form3SnapshotV2 }
  | { ok: false; kind: "gate_rejected"; gate: Form3V2PersistGateResult }
  | { ok: false; kind: "conflict"; latest: Form3SnapshotV2 | null }
  | { ok: false; kind: "error"; message: string };

export function useForm3Supabase({
  patientId,
  userId,
  initial,
  onPersisted,
  onPersistedV2,
  localOnly: localOnlyProp = false,
}: UseForm3SupabaseArgs) {
  const lectureLocalOnly = useLectureLocalOnly();
  const localOnly = localOnlyProp || lectureLocalOnly;
  const caseId = caseIdForPatient(patientId) ?? patientId;
  const phaseB = PHASE_B_ENABLED;

  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const draft = useSyncExternalStore(
    subscribeForm3Draft,
    () => getForm3DraftSnapshot(userId, caseId, patientId),
    getForm3DraftServerSnapshot,
  );

  const [data, setData] = useState<Form3Data>(() =>
    initialForm3Data(patientId, initial),
  );

  const [readHydration, setReadHydration] = useState<Form3ReadHydration | null>(
    () => {
      if (!phaseB) return null;
      return hydrateForm3ReadFromSnapshotPayload(
        initial?.rawPayload ?? initial?.payload ?? null,
        patientId,
      );
    },
  );
  const [dataV2, setDataV2] = useState<Form3DataV2 | null>(
    () => readHydration?.dataV2 ?? null,
  );

  const [writeFlags, setWriteFlags] = useState<Form3V2WriteFlags>(() =>
    createInitialForm3V2WriteFlags({
      hasPersistedV2: phaseB
        ? resolveHasPersistedV2({
            persistedSchemaVersion: initial?.persistedSchemaVersion,
            rawPayload: initial?.rawPayload,
          })
        : false,
    }),
  );

  const [saveStatus, setSaveStatus] = useState<Form3SaveStatus>(() =>
    phaseB ? initialForm3SaveStatusAfterRead(false) : "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    initial?.updatedAt ?? "",
  );
  const [conflictSnapshot, setConflictSnapshot] =
    useState<Form3Snapshot | null>(null);
  const [conflictSnapshotV2, setConflictSnapshotV2] =
    useState<Form3SnapshotV2 | null>(null);
  const [warnings, setWarnings] = useState<Form3SaveWarning[]>([]);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const dataRef = useRef(data);
  const dataV2Ref = useRef(dataV2);
  const writeFlagsRef = useRef(writeFlags);
  const versionRef = useRef<number | null>(initial?.version ?? null);
  const statusRef = useRef<Form3SaveStatus>(
    phaseB ? initialForm3SaveStatusAfterRead(false) : "idle",
  );
  const inFlightRef = useRef(false);
  const dirtyDuringSaveRef = useRef(false);
  /** Phase B: 保存中に編集されたら追随保存（Form2 dirtyDuringSave と同型） */
  const dirtyDuringSaveV2Ref = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const onPersistedRef = useRef(onPersisted);
  const onPersistedV2Ref = useRef(onPersistedV2);
  const saveNowV2Ref = useRef<
    (opts?: { requireUserEdit?: boolean }) => Promise<SaveNowV2Result>
  >(async () => ({
    ok: false,
    kind: "error",
    message: "saveNowV2 not ready",
  }));
  const autosaveControllerRef = useRef<Form3V2AutosaveController | null>(null);

  useEffect(() => {
    onPersistedRef.current = onPersisted;
  }, [onPersisted]);

  useEffect(() => {
    onPersistedV2Ref.current = onPersistedV2;
  }, [onPersistedV2]);

  useEffect(() => {
    statusRef.current = saveStatus;
  }, [saveStatus]);

  useEffect(() => {
    dataV2Ref.current = dataV2;
  }, [dataV2]);

  useEffect(() => {
    writeFlagsRef.current = writeFlags;
  }, [writeFlags]);

  const setDataAndRef = useCallback((next: Form3Data) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const setDataV2AndRef = useCallback((next: Form3DataV2) => {
    dataV2Ref.current = next;
    setDataV2(next);
  }, []);

  const setWriteFlagsAndRef = useCallback((next: Form3V2WriteFlags) => {
    writeFlagsRef.current = next;
    setWriteFlags(next);
    setSaveStatus(next.saveStatus);
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const scheduleAutosave = useCallback(() => {
    // Phase B: Autosave は B2-2C まで無効
    if (phaseB) return;
    if (statusRef.current === "conflict") return;
    setSaveStatus((prev) => (prev === "saving" ? prev : "dirty"));
    clearDebounce();
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void saveRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [clearDebounce, phaseB]);

  const doSave = useCallback(async () => {
    clearDebounce();
    if (statusRef.current === "conflict") return;

    if (inFlightRef.current) {
      dirtyDuringSaveRef.current = true;
      return;
    }
    inFlightRef.current = true;
    dirtyDuringSaveRef.current = false;
    setSaveStatus("saving");

    try {
      if (localOnly) {
        const nextVersion = (versionRef.current ?? 0) + 1;
        const updatedAt = new Date().toISOString();
        versionRef.current = nextVersion;
        setLastSavedAt(updatedAt);
        setConflictSnapshot(null);
        onPersistedRef.current?.({
          payload: dataRef.current,
          version: nextVersion,
          updatedAt,
          persistedSchemaVersion: 1,
          rawPayload: dataRef.current,
        });
        if (dirtyDuringSaveRef.current) {
          scheduleAutosave();
        } else {
          setSaveStatus("saved");
        }
        return;
      }

      const res = await callAction(() =>
        saveForm3Action({
          patientId,
          payload: dataRef.current,
          expectedVersion: versionRef.current,
        }),
      );

      const outcome = interpretForm3SaveResult(
        res.ok
          ? {
              ok: true,
              kind: "saved",
              data: res.data,
              warnings: res.warnings,
            }
          : {
              ok: false,
              kind: res.kind,
              latest: "latest" in res ? res.latest : null,
              warnings: [],
            },
        dirtyDuringSaveRef.current,
      );

      if (outcome.kind === "saved") {
        setDataAndRef(outcome.snapshot.payload);
        versionRef.current = outcome.snapshot.version;
        setLastSavedAt(outcome.snapshot.updatedAt);
        setWarnings(outcome.warnings);
        clearForm3Draft(userId, caseId);
        setConflictSnapshot(null);
        onPersistedRef.current?.(outcome.snapshot);
        if (outcome.resave) {
          scheduleAutosave();
        } else {
          setSaveStatus("saved");
        }
        return;
      }

      writeForm3Draft(userId, caseId, {
        payload: dataRef.current,
        version: versionRef.current,
      });

      if (outcome.kind === "conflict") {
        setConflictSnapshot(outcome.latest);
        setWarnings(outcome.warnings);
        setSaveStatus("conflict");
        return;
      }

      setWarnings(outcome.warnings);
      setSaveStatus("error");
    } finally {
      inFlightRef.current = false;
    }
  }, [
    patientId,
    userId,
    caseId,
    clearDebounce,
    scheduleAutosave,
    setDataAndRef,
    localOnly,
  ]);

  useEffect(() => {
    saveRef.current = doSave;
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        if (!phaseB) {
          void saveRef.current();
        }
      }
    };
  }, [phaseB]);

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

  const onEdited = useCallback(
    (next: Form3Data) => {
      setDataAndRef(next);
      if (statusRef.current === "conflict") {
        writeForm3Draft(userId, caseId, {
          payload: next,
          version: versionRef.current,
        });
        return;
      }
      if (inFlightRef.current) {
        dirtyDuringSaveRef.current = true;
        return;
      }
      scheduleAutosave();
    },
    [setDataAndRef, scheduleAutosave, userId, caseId],
  );

  const setPatternField = useCallback(
    (
      patternKey: Form3PatternKey,
      field: Form3PatternField,
      value: Form3Data["patterns"][Form3PatternKey][Form3PatternField],
    ) => {
      onEdited(applyPatternField(dataRef.current, patternKey, field, value));
    },
    [onEdited],
  );

  const replaceData = useCallback(
    (next: Form3Data) => {
      onEdited(next);
    },
    [onEdited],
  );

  const markReviewed = useCallback(
    (
      patternKey: Form3PatternKey,
    ): { ok: true } | { ok: false; issues: Form3ReviewIssue[] } => {
      const result = markPatternReviewed(dataRef.current, patternKey);
      if (!result.ok) {
        return { ok: false, issues: result.issues };
      }
      onEdited(result.data);
      return { ok: true };
    },
    [onEdited],
  );

  const unmarkReviewed = useCallback(
    (patternKey: Form3PatternKey) => {
      onEdited(unmarkPatternReviewed(dataRef.current, patternKey));
    },
    [onEdited],
  );

  const flush = useCallback(() => {
    if (statusRef.current === "conflict") return;
    if (phaseB) return;
    void saveRef.current();
  }, [phaseB]);

  /**
   * Phase B: ユーザー編集を記録 → Autosave notifyDirty（C2）。
   * next はオブジェクト、または dataV2Ref 基準の updater（連打時の stale closure 防止）。
   */
  const markUserEditedV2 = useCallback(
    (
      next?: Form3DataV2 | ((current: Form3DataV2) => Form3DataV2),
      reason?: Form3V2AutosaveReason,
    ) => {
      if (!phaseB) return;
      const current = dataV2Ref.current;
      let resolved: Form3DataV2 | undefined;
      if (typeof next === "function") {
        if (!current) return;
        resolved = next(current);
      } else {
        resolved = next;
      }
      if (!current && !resolved) return;
      if (writeFlagsRef.current.saveStatus === "saving") {
        dirtyDuringSaveV2Ref.current = true;
      }
      const marked = markForm3V2UserEdited(writeFlagsRef.current, resolved);
      if (marked.dataV2) {
        setDataV2AndRef(marked.dataV2);
      }
      setWriteFlagsAndRef(marked.flags);
      autosaveControllerRef.current?.notifyDirty({
        dirty: marked.flags.dirty,
        hasUserEdited: marked.flags.hasUserEdited,
        reason,
      });
    },
    [phaseB, setDataV2AndRef, setWriteFlagsAndRef],
  );

  /** Phase B: 明示保存（Autosave Controller からも呼ばれる） */
  const saveNowV2 = useCallback(
    async (opts?: { requireUserEdit?: boolean }): Promise<SaveNowV2Result> => {
      const flags = writeFlagsRef.current;
      const gate = evaluateForm3V2ExplicitSave({
        featureEnabled: true,
        hasUserEdited: flags.hasUserEdited,
        dirty: flags.dirty,
        saveStatus: flags.saveStatus,
        hasConflict: flags.saveStatus === "conflict",
        requireUserEdit: opts?.requireUserEdit,
      });
      if (!gate.allowed) {
        return { ok: false, kind: "gate_rejected", gate };
      }

      const payloadToSave = dataV2Ref.current;
      if (!payloadToSave) {
        return {
          ok: false,
          kind: "error",
          message: "no v2 data",
        };
      }

      dirtyDuringSaveV2Ref.current = false;
      const expectedVersion = versionRef.current;
      setWriteFlagsAndRef({ ...flags, saveStatus: "saving" });

      if (localOnly) {
        const nextVersion = (expectedVersion ?? 0) + 1;
        const updatedAt = new Date().toISOString();
        versionRef.current = nextVersion;
        setLastSavedAt(updatedAt);
        setConflictSnapshotV2(null);
        const snap: Form3SnapshotV2 = {
          payload: payloadToSave,
          version: nextVersion,
          updatedAt,
          persistedSchemaVersion: 2,
          migratedFromV1: false,
          warnings: [],
        };
        setDataV2AndRef(payloadToSave);
        setWriteFlagsAndRef(applyForm3V2SaveSuccess(writeFlagsRef.current));
        onPersistedV2Ref.current?.(snap);
        return { ok: true, kind: "saved", snapshot: snap };
      }

      const res = await callAction(() =>
        saveForm3V2Action({
          patientId,
          payload: payloadToSave,
          expectedVersion,
        }),
      );

      if (res.ok && res.kind === "saved") {
        const snap = res.data as Form3SnapshotV2;
        versionRef.current = snap.version;
        setLastSavedAt(snap.updatedAt);
        setConflictSnapshotV2(null);

        const editedDuringSave =
          dirtyDuringSaveV2Ref.current ||
          dataV2Ref.current !== payloadToSave;

        if (editedDuringSave) {
          // 保存中の追記をサーバ応答で潰さない。version だけ進め、dirty を維持して追随保存。
          setWriteFlagsAndRef({
            ...writeFlagsRef.current,
            dirty: true,
            hasUserEdited: true,
            hasPersistedV2: true,
            saveStatus: "dirty",
          });
          autosaveControllerRef.current?.notifyDirty({
            dirty: true,
            hasUserEdited: true,
          });
        } else {
          setDataV2AndRef(snap.payload);
          setWriteFlagsAndRef(applyForm3V2SaveSuccess(writeFlagsRef.current));
          if (shouldClearForm3V2DraftOnSaveSuccess()) {
            clearForm3V2Draft(userId, caseId);
          }
        }

        onPersistedV2Ref.current?.(
          editedDuringSave
            ? {
                ...snap,
                // 親セッションは最新ローカルを正とする（再マウント巻き戻り防止）
                payload: dataV2Ref.current ?? snap.payload,
              }
            : snap,
        );
        return { ok: true, kind: "saved", snapshot: snap };
      }

      if (
        shouldWriteForm3V2DraftOnSaveFailure({
          hasUserEdited: writeFlagsRef.current.hasUserEdited,
        }) &&
        dataV2Ref.current
      ) {
        writeForm3V2Draft(userId, caseId, {
          payload: dataV2Ref.current,
          version: versionRef.current,
        });
      }

      if (!res.ok && res.kind === "conflict") {
        const latest = (res.latest as Form3SnapshotV2 | null) ?? null;
        setConflictSnapshotV2(latest);
        setWriteFlagsAndRef(applyForm3V2SaveConflict(writeFlagsRef.current));
        return { ok: false, kind: "conflict", latest };
      }

      setWriteFlagsAndRef(applyForm3V2SaveError(writeFlagsRef.current));
      const message =
        !res.ok && "message" in res ? String(res.message) : "save failed";
      return { ok: false, kind: "error", message };
    },
    [patientId, userId, caseId, setDataV2AndRef, setWriteFlagsAndRef, localOnly],
  );

  useEffect(() => {
    saveNowV2Ref.current = saveNowV2;
  }, [saveNowV2]);

  // Phase B Autosave Controller Activation（enableTimer）
  useEffect(() => {
    if (!phaseB) {
      autosaveControllerRef.current?.cancel();
      autosaveControllerRef.current = null;
      return;
    }

    const controller = createForm3V2AutosaveController({
      getGateInput: () => {
        const flags = writeFlagsRef.current;
        return {
          featureEnabled: true,
          hasUserEdited: flags.hasUserEdited,
          dirty: flags.dirty,
          saveStatus: flags.saveStatus,
          hasConflict: flags.saveStatus === "conflict",
        };
      },
      saveNowV2: async (): Promise<Form3V2AutosaveSaveResult> => {
        const result = await saveNowV2Ref.current();
        if (result.ok) {
          return { ok: true, kind: "saved" };
        }
        if (result.kind === "gate_rejected") {
          return { ok: false, kind: "gate_rejected", gate: result.gate };
        }
        if (result.kind === "conflict") {
          return { ok: false, kind: "conflict" };
        }
        return { ok: false, kind: "error", message: result.message };
      },
      enableTimer: true,
      debounceMs: AUTOSAVE_DEBOUNCE_MS,
    });
    autosaveControllerRef.current = controller;

    // Remount / HMR / Strict Mode 後も dirty が残っていれば再 schedule する
    // （cancel で timer だけ消えて Draft のまま止まるのを防ぐ）
    const flags = writeFlagsRef.current;
    if (flags.dirty && flags.hasUserEdited && flags.saveStatus !== "conflict") {
      controller.notifyDirty({
        dirty: true,
        hasUserEdited: true,
      });
    }

    return () => {
      // Form2 と同様: debounce 待ちを捨てず、未保存があれば即時 flush する
      const latest = writeFlagsRef.current;
      if (
        latest.dirty &&
        latest.hasUserEdited &&
        latest.saveStatus !== "conflict" &&
        latest.saveStatus !== "saving"
      ) {
        void saveNowV2Ref.current();
      }
      controller.cancel();
      if (autosaveControllerRef.current === controller) {
        autosaveControllerRef.current = null;
      }
    };
  }, [phaseB]);

  const flushV2 = useCallback(
    async (opts?: { requireUserEdit?: boolean }) => {
      return saveNowV2(opts);
    },
    [saveNowV2],
  );

  const loadLatestOnConflict = useCallback(() => {
    if (phaseB) {
      if (!conflictSnapshotV2) return;
      setDataV2AndRef(conflictSnapshotV2.payload);
      versionRef.current = conflictSnapshotV2.version;
      setLastSavedAt(conflictSnapshotV2.updatedAt);
      setWriteFlagsAndRef(
        createInitialForm3V2WriteFlags({
          hasPersistedV2: true,
        }),
      );
      clearForm3V2Draft(userId, caseId);
      setConflictSnapshotV2(null);
      return;
    }

    if (!conflictSnapshot) return;
    const resolved = resolveConflictWithLatest(conflictSnapshot);
    setDataAndRef(resolved.data);
    versionRef.current = resolved.version;
    setLastSavedAt(resolved.updatedAt);
    setSaveStatus("saved");
    clearForm3Draft(userId, caseId);
    setConflictSnapshot(null);
    setWarnings([]);
  }, [
    phaseB,
    conflictSnapshot,
    conflictSnapshotV2,
    setDataAndRef,
    setDataV2AndRef,
    setWriteFlagsAndRef,
    userId,
    caseId,
  ]);

  const pendingDraft: Form3Data | null =
    hydrated && !draftDismissed && draft ? draft.payload : null;

  const restoreDraft = useCallback(() => {
    if (!draft) return;
    setDataAndRef(draft.payload);
    versionRef.current = draft.version;
    setDraftDismissed(true);
    if (phaseB) {
      const hydration = hydrateForm3ReadFromSnapshotPayload(
        draft.payload,
        patientId,
      );
      setReadHydration(hydration);
      setDataV2AndRef(hydration.dataV2);
      setWriteFlagsAndRef(
        markForm3V2UserEdited(
          createInitialForm3V2WriteFlags({
            hasPersistedV2: writeFlagsRef.current.hasPersistedV2,
          }),
          hydration.dataV2,
        ).flags,
      );
      return;
    }
    scheduleAutosave();
  }, [
    draft,
    setDataAndRef,
    scheduleAutosave,
    phaseB,
    patientId,
    setDataV2AndRef,
    setWriteFlagsAndRef,
  ]);

  const discardDraft = useCallback(() => {
    clearForm3Draft(userId, caseId);
    setDraftDismissed(true);
  }, [userId, caseId]);

  return {
    data,
    dataV2,
    readHydration,
    phaseB,
    hasUserEdited: writeFlags.hasUserEdited,
    hasPersistedV2: writeFlags.hasPersistedV2,
    dirtyV2: writeFlags.dirty,
    writeFlags,
    hydrated,
    saveStatus: phaseB ? writeFlags.saveStatus : saveStatus,
    lastSavedAt,
    warnings,
    conflictSnapshot,
    conflictSnapshotV2,
    pendingDraft,
    setPatternField,
    replaceData,
    markReviewed,
    unmarkReviewed,
    flush,
    markUserEditedV2,
    saveNowV2,
    flushV2,
    loadLatestOnConflict,
    restoreDraft,
    discardDraft,
  };
}
