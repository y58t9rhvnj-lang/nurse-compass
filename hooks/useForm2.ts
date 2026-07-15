"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  clearForm2 as clearForm2Store,
  commitForm2,
  getServerSnapshot,
  getSnapshot,
  stageForm2,
  subscribe,
} from "@/lib/form2/form2Store";
import type {
  Form2Data,
  Form2Period,
  Form2SectionId,
  Form2Student,
} from "@/lib/form2/form2Types";

export type Form2SaveStatus = "idle" | "saving" | "saved";

// 入力停止からこの時間後に localStorage へ確定保存する（ディスク書き込みの抑制）。
const AUTOSAVE_DEBOUNCE_MS = 600;

// hydrated 判定（サーバー=false / クライアント=true）を setState なしで取得。
const noopSubscribe = () => () => {};

// 「精神様式2」を患者別に管理するフック。
// localStorage はクライアント専用のため useSyncExternalStore で購読し、
// SSR/ハイドレーション不整合を避ける。入力は即時にメモリへ反映し、
// 実保存はデバウンスして行う。
export function useForm2(patientId: string) {
  const data = useSyncExternalStore(
    subscribe,
    () => getSnapshot(patientId),
    () => getServerSnapshot(patientId),
  );

  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const [saveStatus, setSaveStatus] = useState<Form2SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    pendingRef.current = false;
    commitForm2(patientId);
    setSaveStatus("saved");
  }, [patientId]);

  const scheduleSave = useCallback(() => {
    pendingRef.current = true;
    setSaveStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = false;
      commitForm2(patientId);
      setSaveStatus("saved");
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [patientId]);

  // タブ非表示・離脱時は保留中の保存を確定し、データ喪失を防ぐ。
  useEffect(() => {
    const onHide = () => flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
      // 患者切替・アンマウント時も保留分を確定。
      flush();
    };
  }, [flush]);

  const updateSection = useCallback(
    (id: Form2SectionId, value: string) => {
      stageForm2(patientId, (prev) => ({
        ...prev,
        sections: { ...prev.sections, [id]: value },
      }));
      scheduleSave();
    },
    [patientId, scheduleSave],
  );

  const updateStudent = useCallback(
    (patch: Partial<Form2Student>) => {
      stageForm2(patientId, (prev) => ({
        ...prev,
        student: { ...prev.student, ...patch },
      }));
      scheduleSave();
    },
    [patientId, scheduleSave],
  );

  const updatePeriod = useCallback(
    (patch: Partial<Form2Period>) => {
      stageForm2(patientId, (prev) => ({
        ...prev,
        period: { ...prev.period, ...patch },
      }));
      scheduleSave();
    },
    [patientId, scheduleSave],
  );

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = false;
    clearForm2Store(patientId);
    setSaveStatus("idle");
  }, [patientId]);

  return {
    data: data as Form2Data,
    hydrated,
    saveStatus,
    lastSavedAt: data.updatedAt,
    updateSection,
    updateStudent,
    updatePeriod,
    reset,
  };
}
