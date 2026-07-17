"use client";

// Compass Version2 Sprint1 — Evidence（Information Card）の Supabase 接続フック。
//
// 用語（正式決定）:
//   Information Card ＝ Evidence（事実のみ。解釈・推論・患者理解・看護判断は保持しない）。
//
// 責務:
//   ・初期データ（サーバから受け取った InformationCard[]）を保持する。
//   ・会話から Evidence を収集する（createCardAction）。
//   ・Evidence の本文修正（updateCardAction）と収集解除＝論理削除（releaseCardAction）。
//   ・楽観ロック（expectedUpdatedAt）に基づく競合は「最新を読み込む」で解決する
//     （黙って古い内容で上書きしない。差分マージは将来フェーズ）。
//
// 状態遷移:
//   idle → working → { idle(成功) | error | conflict }
//   conflict / error は次操作または最新読込で idle へ戻る。
//
// 保存の正は Supabase。localStorage へは戻さない。

import { useCallback, useEffect, useRef, useState } from "react";
import type { InformationCard } from "@/lib/information/informationCard";
import {
  createCardAction,
  listCardsAction,
  releaseCardAction,
  updateCardAction,
} from "@/app/v2/actions/informationCards";

export type EvidenceStatus = "idle" | "working" | "error" | "conflict";

export interface UseEvidenceSupabaseResult {
  cards: InformationCard[];
  status: EvidenceStatus;
  message: string | null;
  collectUtterance: (args: {
    entryId: string;
    content: string;
    originalText: string;
  }) => Promise<boolean>;
  updateContent: (id: string, content: string) => Promise<boolean>;
  release: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
  isCollectedBySource: (kind: string, id: string) => boolean;
  clearMessage: () => void;
}

function sortCards(cards: InformationCard[]): InformationCard[] {
  return [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function useEvidenceSupabase({
  patientId,
  initial,
}: {
  patientId: string;
  initial: InformationCard[];
}): UseEvidenceSupabaseResult {
  const [cards, setCards] = useState<InformationCard[]>(() => sortCards(initial));
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // 非同期コールバック内から常に最新の cards を参照する（expectedUpdatedAt 解決用）。
  const cardsRef = useRef<InformationCard[]>(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  const clearMessage = useCallback(() => setMessage(null), []);

  const reload = useCallback(async () => {
    const res = await listCardsAction(patientId);
    if (res.ok) {
      setCards(sortCards(res.data));
    }
  }, [patientId]);

  const collectUtterance = useCallback(
    async ({
      entryId,
      content,
      originalText,
    }: {
      entryId: string;
      content: string;
      originalText: string;
    }): Promise<boolean> => {
      setStatus("working");
      setMessage(null);
      const res = await createCardAction({
        patientId,
        content,
        sourceType: "patient_conversation",
        sourceLabel: "患者との会話",
        sourceReference: { kind: "patient_conversation", id: entryId },
        originalText,
      });
      if (res.ok) {
        setCards((prev) => sortCards([...prev, res.data]));
        setStatus("idle");
        return true;
      }
      if (res.kind === "duplicate") {
        // 既に（別端末などで）収集済み。最新へ合わせる。
        await reload();
        setStatus("idle");
        return true;
      }
      setStatus("error");
      setMessage("収集に失敗しました。通信状況を確認してもう一度お試しください。");
      return false;
    },
    [patientId, reload],
  );

  const updateContent = useCallback(
    async (id: string, content: string): Promise<boolean> => {
      const target = cardsRef.current.find((c) => c.id === id);
      const expectedUpdatedAt = target?.updatedAt ?? target?.createdAt;
      if (!target || !expectedUpdatedAt) {
        await reload();
        setStatus("conflict");
        setMessage("最新の状態を読み込みました。もう一度お試しください。");
        return false;
      }
      setStatus("working");
      setMessage(null);
      const res = await updateCardAction({
        patientId,
        id,
        expectedUpdatedAt,
        patch: { content },
      });
      if (res.ok) {
        setCards((prev) =>
          sortCards(prev.map((c) => (c.id === id ? res.data : c))),
        );
        setStatus("idle");
        return true;
      }
      if (res.kind === "conflict") {
        setCards((prev) =>
          res.latest
            ? sortCards(prev.map((c) => (c.id === id ? res.latest! : c)))
            : prev.filter((c) => c.id !== id),
        );
        setStatus("conflict");
        setMessage("他の端末で更新されていたため、最新の内容を読み込みました。");
        return false;
      }
      setStatus("error");
      setMessage("修正の保存に失敗しました。");
      return false;
    },
    [patientId, reload],
  );

  const release = useCallback(
    async (id: string): Promise<boolean> => {
      const target = cardsRef.current.find((c) => c.id === id);
      const expectedUpdatedAt = target?.updatedAt ?? target?.createdAt;
      if (!target || !expectedUpdatedAt) {
        await reload();
        setStatus("conflict");
        setMessage("最新の状態を読み込みました。もう一度お試しください。");
        return false;
      }
      setStatus("working");
      setMessage(null);
      const res = await releaseCardAction({ patientId, id, expectedUpdatedAt });
      if (res.ok) {
        setCards((prev) => prev.filter((c) => c.id !== id));
        setStatus("idle");
        return true;
      }
      if (res.kind === "conflict") {
        setCards((prev) =>
          res.latest
            ? sortCards(prev.map((c) => (c.id === id ? res.latest! : c)))
            : prev.filter((c) => c.id !== id),
        );
        setStatus("conflict");
        setMessage("他の端末で更新されていたため、最新の内容を読み込みました。");
        return false;
      }
      setStatus("error");
      setMessage("収集解除に失敗しました。");
      return false;
    },
    [patientId, reload],
  );

  const isCollectedBySource = useCallback(
    (kind: string, id: string): boolean =>
      cards.some(
        (c) => c.sourceReference?.kind === kind && c.sourceReference?.id === id,
      ),
    [cards],
  );

  return {
    cards,
    status,
    message,
    collectUtterance,
    updateContent,
    release,
    reload,
    isCollectedBySource,
    clearMessage,
  };
}
