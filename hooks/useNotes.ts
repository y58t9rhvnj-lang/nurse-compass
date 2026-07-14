"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addNote as addNoteStore,
  deleteNote as deleteNoteStore,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  updateNote as updateNoteStore,
} from "@/lib/notesStore";

// hydrated 判定（サーバー=false / クライアント=true）を setState を使わず取得する。
const noopSubscribe = () => () => {};

// 患者ごとの気づきメモを管理するフック。
// localStorage はクライアント専用のため、useSyncExternalStore で外部ストアとして購読する。
// これにより SSR/ハイドレーション不整合を避けつつ、変更を即時反映できる。
export function useNotes(patientId: string) {
  const notes = useSyncExternalStore(
    subscribe,
    () => getSnapshot(patientId),
    getServerSnapshot,
  );

  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  const addNote = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      addNoteStore(patientId, text);
    },
    [patientId],
  );

  const updateNote = useCallback(
    (id: string, text: string) => {
      if (!text.trim()) return;
      updateNoteStore(patientId, id, text);
    },
    [patientId],
  );

  const deleteNote = useCallback(
    (id: string) => {
      deleteNoteStore(patientId, id);
    },
    [patientId],
  );

  return { notes, hydrated, addNote, updateNote, deleteNote };
}
