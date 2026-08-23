"use client";

// Compass Version2 — Compass Memo Supabase Integration (Phase 2)
// Compassメモ（student_notes）の Supabase 接続フック。useEvidenceSupabase と同じ設計方針。
//
// 責務:
//   ・初期データ（サーバから受け取った StudentNoteRecord[]）を保持する。
//   ・メモの作成（createNoteAction）・本文更新（updateNoteAction）・論理削除（softDeleteNoteAction）。
//   ・楽観ロック（expectedUpdatedAt = 生 updated_at ISO）に基づく競合は「最新へ同期」で解決する
//     （黙って古い内容で上書きしない）。
//
// 状態:
//   ・内部状態は StudentNoteRecord[]（note: UI向け epoch ms ／ updatedAt: 楽観ロック用の生 ISO）。
//   ・UI へは Note[]（updatedAt 降順）を返す。
//
// 例外処理:
//   ・Server Action 呼び出しは callAction 経由（通信断・reject を network/unexpected へ正規化）。
//   ・busyRef を進行フラグとし、finally で必ず解除する（二重送信防止・再試行可能）。
//   ・optimistic update を行い、失敗時は元の状態へロールバックする。
//
// 保存の正は Supabase。localStorage は一切利用しない（localStorage 移行も実装しない）。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "@/lib/notes";
import type { StudentNoteRecord } from "@/lib/v2/notebook/studentNoteMapper";
import {
  createNoteAction,
  listNotesAction,
  softDeleteNoteAction,
  updateNoteAction,
} from "@/app/v2/actions/studentNotes";
import { callAction } from "@/lib/v2/callAction";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";

// 通信失敗（reject 含む）時に学生へ出す一般メッセージ（技術用語・DB情報を含めない）。
const NETWORK_HINT = "通信状況を確認して、もう一度お試しください。";

export type NotesStatus = "idle" | "working" | "error" | "conflict";

export interface UseNotesSupabaseResult {
  // このインスタンスがスコープする患者id（= 受け持ち患者）。consumer 側の患者一致判定に使う。
  patientId: string;
  // UI 向けメモ一覧（更新日時の新しい順）。
  notes: Note[];
  status: NotesStatus;
  message: string | null;
  // 新規メモを作成する。空文字は無視（false）。成功で true。
  addNote: (text: string) => Promise<boolean>;
  // 本文を更新する。空文字は無視（false）。成功で true。
  updateNote: (id: string, text: string) => Promise<boolean>;
  // 論理削除する。成功で true。
  deleteNote: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
  clearMessage: () => void;
}

// クライアント生成の text ID（既存 notesStore.createId と同形式）。Evidence source_reference 互換のため維持。
function createClientNoteId(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// 更新日時の新しい順（notesStore / listActiveNotes と同じ並び）。
function sortRecords(records: StudentNoteRecord[]): StudentNoteRecord[] {
  return [...records].sort((a, b) => b.note.updatedAt - a.note.updatedAt);
}

export function useNotesSupabase({
  patientId,
  initial,
  localOnly: localOnlyProp = false,
}: {
  patientId: string;
  initial: StudentNoteRecord[];
  /** Version 2.2 講義デモ: Server Action を呼ばずメモリ内のみ。 */
  localOnly?: boolean;
}): UseNotesSupabaseResult {
  const lectureLocalOnly = useLectureLocalOnly();
  const localOnly = localOnlyProp || lectureLocalOnly;
  const [records, setRecords] = useState<StudentNoteRecord[]>(() =>
    sortRecords(initial),
  );
  const [status, setStatus] = useState<NotesStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // 非同期コールバック内から常に最新の records を参照する（expectedUpdatedAt 解決用）。
  const recordsRef = useRef<StudentNoteRecord[]>(records);
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // 進行中フラグ（二重送信防止）。finally で必ず解除する。
  const busyRef = useRef(false);

  const clearMessage = useCallback(() => setMessage(null), []);

  const reload = useCallback(async () => {
    if (localOnly) return;
    const res = await callAction(() => listNotesAction(patientId));
    if (res.ok) {
      setRecords(sortRecords(res.data));
    }
  }, [patientId, localOnly]);

  const addNote = useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = rawText.trim();
      if (text === "") return false;
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);

      // optimistic add: client 生成 ID の仮レコードを先頭へ。id はサーバ保存でもそのまま維持される。
      const id = createClientNoteId();
      const now = Date.now();
      const optimistic: StudentNoteRecord = {
        note: { id, patientId, text, createdAt: now, updatedAt: now },
        updatedAt: new Date(now).toISOString(),
      };
      setRecords((prev) => sortRecords([optimistic, ...prev]));

      try {
        if (localOnly) {
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          createNoteAction({ patientId, id, text }),
        );
        if (res.ok) {
          // サーバ確定レコード（正の created_at/updated_at）で仮レコードを置換。
          setRecords((prev) =>
            sortRecords(prev.map((r) => (r.note.id === id ? res.data : r))),
          );
          setStatus("idle");
          return true;
        }
        if (res.kind === "duplicate") {
          // 同一 id が既存（二重送信・別端末）。最新へ合わせる。
          await reload();
          setStatus("idle");
          return true;
        }
        // 失敗: optimistic 追加をロールバック。
        setRecords((prev) => prev.filter((r) => r.note.id !== id));
        setStatus("error");
        setMessage(`メモを保存できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
  );

  const updateNote = useCallback(
    async (id: string, rawText: string): Promise<boolean> => {
      const text = rawText.trim();
      if (text === "") return false;
      const target = recordsRef.current.find((r) => r.note.id === id);
      if (!target) {
        await reload();
        setStatus("conflict");
        setMessage("最新の状態を読み込みました。もう一度お試しください。");
        return false;
      }
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);

      const expectedUpdatedAt = target.updatedAt; // 生 ISO（楽観ロック）
      const previous = target; // ロールバック用に元レコードを保持
      // optimistic update: 本文と updatedAt を仮更新（表示順も追従）。
      const now = Date.now();
      setRecords((prev) =>
        sortRecords(
          prev.map((r) =>
            r.note.id === id
              ? {
                  note: { ...r.note, text, updatedAt: now },
                  updatedAt: new Date(now).toISOString(),
                }
              : r,
          ),
        ),
      );

      try {
        if (localOnly) {
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          updateNoteAction({ patientId, id, expectedUpdatedAt, text }),
        );
        if (res.ok) {
          setRecords((prev) =>
            sortRecords(prev.map((r) => (r.note.id === id ? res.data : r))),
          );
          setStatus("idle");
          return true;
        }
        if (res.kind === "conflict") {
          // 他端末で更新済み。latest があればそれへ同期、無ければ一覧から除外。
          setRecords((prev) =>
            res.latest
              ? sortRecords(prev.map((r) => (r.note.id === id ? res.latest! : r)))
              : prev.filter((r) => r.note.id !== id),
          );
          setStatus("conflict");
          setMessage("他の端末で更新されていたため、最新の内容を読み込みました。");
          return false;
        }
        // 失敗: 元の内容へ戻す。
        setRecords((prev) =>
          sortRecords(prev.map((r) => (r.note.id === id ? previous : r))),
        );
        setStatus("error");
        setMessage(`メモを更新できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
  );

  const deleteNote = useCallback(
    async (id: string): Promise<boolean> => {
      const target = recordsRef.current.find((r) => r.note.id === id);
      if (!target) {
        await reload();
        setStatus("conflict");
        setMessage("最新の状態を読み込みました。もう一度お試しください。");
        return false;
      }
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);

      const expectedUpdatedAt = target.updatedAt; // 生 ISO（楽観ロック）
      const previous = target; // ロールバック用に元の行を保持
      // optimistic soft-delete: 一覧から即時に外す。
      setRecords((prev) => prev.filter((r) => r.note.id !== id));

      try {
        if (localOnly) {
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          softDeleteNoteAction({ patientId, id, expectedUpdatedAt }),
        );
        if (res.ok) {
          setStatus("idle");
          return true;
        }
        if (res.kind === "conflict") {
          // 他端末で更新済み（削除は未確定）。latest があれば行を復元して競合を通知。
          setRecords((prev) =>
            res.latest ? sortRecords([res.latest, ...prev]) : prev,
          );
          setStatus("conflict");
          setMessage("他の端末で更新されていたため、最新の内容を読み込みました。");
          return false;
        }
        // 失敗: 削除した行を復元。
        setRecords((prev) => sortRecords([previous, ...prev]));
        setStatus("error");
        setMessage(`メモを削除できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
  );

  const notes = useMemo(() => records.map((r) => r.note), [records]);

  return {
    patientId,
    notes,
    status,
    message,
    addNote,
    updateNote,
    deleteNote,
    reload,
    clearMessage,
  };
}
