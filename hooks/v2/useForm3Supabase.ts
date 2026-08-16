"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { saveForm3Action } from "@/app/v2/actions/form3";
import { callAction } from "@/lib/v2/callAction";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { type Form3Data, type Form3PatternKey } from "@/lib/form3/form3Types";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
import {
  hydrateForm3ReadFromSnapshotPayload,
  type Form3ReadHydration,
} from "@/lib/form3/v2/form3V2ReadPath";
import type { Form3DataV2 } from "@/lib/form3/v2/form3V2Types";
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

// 様式3 を Supabase（Server Action 経由）へ保存する V2 専用フック。
//
// 状態遷移:
//            (編集)
//     idle ─────────► dirty
//                       │  debounce(1000ms) / flush
//                       ▼
//                     saving
//                       ├──► saved     (ok。warnings は保持し error 扱いしない)
//                       ├──► error     (入力保持。自動無限再試行なし)
//                       └──► conflict  (自動保存停止。最新 Snapshot 保持)
//
// Form2 との差分:
//   ・error 時の一定間隔自動再試行は行わない（明示 flush / 次の編集のみ）。
//   ・整理済みパターンの本文編集で isReviewed を false へ戻す。
//   ・Server Action の warnings を保持する。
//
// Phase B2-2A (form3PhaseB ON):
//   ・読込のみ v2 hydrate（migrate→sanitize）。dirty=false。Repository save しない。
//   ・保存処理（doSave / saveForm3Action）は変更しないが、読込 hydrate からは呼ばない。
//   ・Flag OFF では従来どおり（data のみ・autosave あり）。

const AUTOSAVE_DEBOUNCE_MS = 1000;

export type { Form3SaveStatus, Form3PatternField };

export interface UseForm3SupabaseArgs {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  onPersisted?: (snapshot: Form3Snapshot) => void;
}

export function useForm3Supabase({
  patientId,
  userId,
  initial,
  onPersisted,
}: UseForm3SupabaseArgs) {
  const caseId = caseIdForPatient(patientId) ?? patientId;
  const phaseB = isFeatureEnabled("form3PhaseB");

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
        initial?.payload ?? null,
        patientId,
      );
    },
  );
  const [dataV2, setDataV2] = useState<Form3DataV2 | null>(
    () => readHydration?.dataV2 ?? null,
  );

  const [saveStatus, setSaveStatus] = useState<Form3SaveStatus>(() =>
    phaseB ? initialForm3SaveStatusAfterRead(false) : "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<string>(
    initial?.updatedAt ?? "",
  );
  const [conflictSnapshot, setConflictSnapshot] =
    useState<Form3Snapshot | null>(null);
  const [warnings, setWarnings] = useState<Form3SaveWarning[]>([]);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const dataRef = useRef(data);
  const versionRef = useRef<number | null>(initial?.version ?? null);
  const statusRef = useRef<Form3SaveStatus>(
    phaseB ? initialForm3SaveStatusAfterRead(false) : "idle",
  );
  const inFlightRef = useRef(false);
  const dirtyDuringSaveRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const onPersistedRef = useRef(onPersisted);

  useEffect(() => {
    onPersistedRef.current = onPersisted;
  }, [onPersisted]);

  useEffect(() => {
    statusRef.current = saveStatus;
  }, [saveStatus]);

  const setDataAndRef = useCallback((next: Form3Data) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const scheduleAutosave = useCallback(() => {
    // B2-2A: Phase B 読込パスでは Migration / 未編集で autosave しない
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
  ]);

  useEffect(() => {
    saveRef.current = doSave;
  }, [doSave]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
        // Phase B 読込のみ: 未スケジュールなら何もしない。debounce 中のみ flush。
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
    // B2-2A: Phase B では読込由来の永続化をしない（保存処理本体は未変更）
    if (phaseB) return;
    void saveRef.current();
  }, [phaseB]);

  const loadLatestOnConflict = useCallback(() => {
    if (!conflictSnapshot) return;
    const resolved = resolveConflictWithLatest(conflictSnapshot);
    setDataAndRef(resolved.data);
    versionRef.current = resolved.version;
    setLastSavedAt(resolved.updatedAt);
    if (phaseB) {
      const hydration = hydrateForm3ReadFromSnapshotPayload(
        conflictSnapshot.payload,
        patientId,
      );
      setReadHydration(hydration);
      setDataV2(hydration.dataV2);
      setSaveStatus(initialForm3SaveStatusAfterRead(hydration.dirty));
    } else {
      setSaveStatus("saved");
    }
    clearForm3Draft(userId, caseId);
    setConflictSnapshot(null);
    setWarnings([]);
  }, [conflictSnapshot, setDataAndRef, userId, caseId, phaseB, patientId]);

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
      setDataV2(hydration.dataV2);
      // Draft 復元はユーザー操作だが、B2-2A ではまだ Phase B 保存しない
      setSaveStatus(initialForm3SaveStatusAfterRead(false));
      return;
    }
    scheduleAutosave();
  }, [draft, setDataAndRef, scheduleAutosave, phaseB, patientId]);

  const discardDraft = useCallback(() => {
    clearForm3Draft(userId, caseId);
    setDraftDismissed(true);
  }, [userId, caseId]);

  return {
    data,
    /** Phase B ON 時のみ。読込 hydrate 済み v2。Migration では dirty/save しない */
    dataV2,
    /** Phase B 読込メタ（テスト・次フェーズ用）。Flag OFF では null */
    readHydration,
    phaseB,
    hydrated,
    saveStatus,
    lastSavedAt,
    warnings,
    conflictSnapshot,
    pendingDraft,
    setPatternField,
    replaceData,
    markReviewed,
    unmarkReviewed,
    flush,
    loadLatestOnConflict,
    restoreDraft,
    discardDraft,
  };
}
