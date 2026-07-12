"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  patientUtteranceToInformationCard,
  temporaryMemoToInformationCard,
} from "@/lib/information/informationCardAdapters";
import {
  addCardForPatient,
  getCardsSnapshot,
  getServerCardsSnapshot,
  hasCardForEntry,
  hasCardForNote,
  removeCardForPatient,
  subscribeCards,
  updateCardForPatient,
} from "@/lib/information/informationCardStore";

// hydrated 判定（サーバー=false / クライアント=true）を setState を使わず取得する。
const noopSubscribe = () => () => {};

// 患者ごとの Information Card（=収集データ）を購読するフック。
// 「収集済み」判定は store の内容から導出し、UI ローカル state では管理しない。
// localStorage 永続のため、リロード・カルテ往復後も収集済み状態が維持される。
export function useInformationCards(patientId: string) {
  const cards = useSyncExternalStore(
    subscribeCards,
    () => getCardsSnapshot(patientId),
    getServerCardsSnapshot,
  );

  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

  // 会話エントリIDが既に収集済みか（重複収集防止・「✓ 収集済み」表示に使う）。
  const isEntryAdded = useCallback(
    (entryId: string) => hasCardForEntry(cards, entryId),
    [cards],
  );
  // 別名（学生UI用語に合わせる）。挙動は isEntryAdded と同じ。
  const isEntryCollected = isEntryAdded;

  // 一時メモ（Note ID）が既に収集済みか。
  const isNoteCollected = useCallback(
    (noteId: string) => hasCardForNote(cards, noteId),
    [cards],
  );

  // 患者発言を収集データとして追加する（共通収集ダイアログの確定内容で呼ぶ）。
  //   - content: ダイアログで確定した「保存する内容」
  //   - originalText: 患者発言の元全文
  //   - observedAt: 会話時刻があれば
  const collectPatientUtterance = useCallback(
    (
      entryId: string,
      content: string,
      originalText: string,
      observedAt?: string,
    ) => {
      const trimmed = content.trim();
      if (trimmed === "") return;
      // 重複は最新の store snapshot で判定（本文ではなくエントリID基準）。
      if (hasCardForEntry(getCardsSnapshot(patientId), entryId)) return;
      const card = patientUtteranceToInformationCard(patientId, entryId, trimmed, {
        originalText,
        observedAt,
      });
      addCardForPatient(patientId, card);
    },
    [patientId],
  );

  // 旧API互換：患者発言をそのまま収集（content=originalText=text）。
  const addPatientUtterance = useCallback(
    (entryId: string, text: string) => {
      collectPatientUtterance(entryId, text, text);
    },
    [collectPatientUtterance],
  );

  // 一時メモを収集データとして追加する（Note ID 基準で重複防止）。
  //   - originalText: 収集時点のメモ本文（以後メモを編集しても不変）
  //   - observedAt: メモを書いた時刻（あれば）
  const collectTemporaryMemo = useCallback(
    (
      noteId: string,
      content: string,
      originalText: string,
      observedAt?: string,
    ) => {
      const trimmed = content.trim();
      if (trimmed === "") return;
      if (hasCardForNote(getCardsSnapshot(patientId), noteId)) return;
      const card = temporaryMemoToInformationCard(
        patientId,
        noteId,
        trimmed,
        originalText,
        observedAt,
      );
      addCardForPatient(patientId, card);
    },
    [patientId],
  );

  // 収集データの「保存する内容（content）」のみを修正する。
  // originalText / sourceReference / createdAt / id は不変。空文字は保存しない。
  const updateContent = useCallback(
    (id: string, content: string) => {
      const trimmed = content.trim();
      if (trimmed === "") return;
      updateCardForPatient(patientId, id, {
        content: trimmed,
        updatedAt: new Date().toISOString(),
      });
    },
    [patientId],
  );

  // 収集解除：収集データから外す（元の患者発言・一時メモは残る）。
  const release = useCallback(
    (id: string) => {
      removeCardForPatient(patientId, id);
    },
    [patientId],
  );

  return {
    cards,
    hydrated,
    isEntryAdded,
    isEntryCollected,
    isNoteCollected,
    addPatientUtterance,
    collectPatientUtterance,
    collectTemporaryMemo,
    updateContent,
    release,
  };
}
