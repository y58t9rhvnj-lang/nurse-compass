"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  setFacingConvo,
  subscribe,
} from "@/lib/facingConvoStore";
import type { FacingConvoState } from "@/lib/patientFacingData";

// 患者会話（Compass Coach の状態を含む）を端末内（localStorage）へ永続化しつつ管理するフック。
// localStorage はクライアント専用のため useSyncExternalStore で外部ストアとして購読し、
// SSR/ハイドレーション不整合を避けつつ、同じ端末・同じブラウザで「続きから」復元する。
export function useFacingConvo(patientId: string): {
  state: FacingConvoState;
  setState: (next: FacingConvoState) => void;
} {
  const state = useSyncExternalStore(
    subscribe,
    () => getSnapshot(patientId),
    getServerSnapshot,
  );

  const setState = useCallback(
    (next: FacingConvoState) => setFacingConvo(patientId, next),
    [patientId],
  );

  return { state, setState };
}
