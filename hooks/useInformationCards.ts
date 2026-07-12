"use client";

import { useCallback, useSyncExternalStore } from "react";
import { patientUtteranceToInformationCard } from "@/lib/information/informationCardAdapters";
import {
  addCardForPatient,
  getCardsSnapshot,
  getServerCardsSnapshot,
  hasCardForEntry,
  subscribeCards,
} from "@/lib/information/informationCardStore";

// hydrated 判定（サーバー=false / クライアント=true）を setState を使わず取得する。
const noopSubscribe = () => () => {};

// 患者ごとの Information Card を購読するフック（Sprint11.2）。
// 「追加済み」判定は store の内容から導出し、UI ローカル state では管理しない。
// localStorage 永続のため、リロード・カルテ往復後も追加済み状態が維持される。
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

  // 会話エントリIDが既にカード化されているか（重複追加防止・表示切替に使う）。
  const isEntryAdded = useCallback(
    (entryId: string) => hasCardForEntry(cards, entryId),
    [cards],
  );

  // 患者発言を Information Card として追加する（学生の明示操作でのみ呼ぶ）。
  const addPatientUtterance = useCallback(
    (entryId: string, text: string) => {
      const content = text.trim();
      if (content === "") return;
      // 重複は最新の store snapshot で判定（本文ではなくエントリID基準）。
      if (hasCardForEntry(getCardsSnapshot(patientId), entryId)) return;
      const card = patientUtteranceToInformationCard(patientId, entryId, content);
      addCardForPatient(patientId, card);
    },
    [patientId],
  );

  return { cards, hydrated, isEntryAdded, addPatientUtterance };
}
