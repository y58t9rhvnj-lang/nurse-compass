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
// 例外処理（Sprint2-1）:
//   ・Server Action 呼び出しは callAction 経由。通信断・サーバ停止・Promise reject は
//     network / unexpected の Result に正規化され、working に固定されず error へ遷移する。
//   ・busyRef を進行フラグとし、finally で必ず解除する（二重送信防止・再試行可能）。
//   ・失敗時は操作対象や既存 Evidence を消さない（成功時のみ状態を反映）。
//
// 保存の正は Supabase。localStorage へは戻さない。

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InformationCard,
  InformationSourceReference,
  InformationSourceType,
} from "@/lib/information/informationCard";
import {
  createCardAction,
  listCardsAction,
  releaseCardAction,
  updateCardAction,
} from "@/app/v2/actions/informationCards";
import { callAction, type ClientCallErrorKind } from "@/lib/v2/callAction";
import type { ActionErrorKind } from "@/lib/v2/notebook/types";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";

// 通信失敗（reject 含む）時に学生へ出す一般メッセージ（技術用語・DB情報を含めない）。
const NETWORK_HINT = "通信状況を確認して、もう一度お試しください。";

export type EvidenceStatus = "idle" | "working" | "error" | "conflict";

// Sprint6: Core 画面（電子カルテ・会話 等）から任意の情報源を Evidence として収集する共通入力。
// 会話専用の collectUtterance / 一時メモ専用の collectMemo と異なり、出所種別・出所参照を
// 呼び出し側が明示する（電子カルテ記録など sourceReference.id を持つ情報源の二重収集防止に対応）。
export interface CaptureSourceArgs {
  content: string;
  sourceType: InformationSourceType;
  sourceLabel: string;
  // {kind,id?,date?,tab?}。id を持つ場合は uq_information_cards_source により二重収集を防ぐ。
  sourceReference?: InformationSourceReference;
  // 原文（immutable）。学生が content を整えても原文は保持する。
  originalText?: string;
  // 学生メモ（原文・保存内容とは別項目）。
  note?: string;
  category?: string;
}

// 収集結果。UI 側で「保存済み（duplicate）」「認証切れ」「通信エラー」等を区別できるよう、
// callAction / Server Action の分類済み kind をそのまま返す（DB 生エラーは含めない）。
export type CaptureResult =
  | { ok: true }
  | { ok: false; kind: ActionErrorKind | ClientCallErrorKind };

export interface UseEvidenceSupabaseResult {
  cards: InformationCard[];
  status: EvidenceStatus;
  message: string | null;
  // 会話発言を Evidence として収集する。出所 id はサーバが original_text から
  // content hash として再計算するため（TD-001）、クライアントからは id を送らない。
  collectUtterance: (args: {
    content: string;
    originalText: string;
  }) => Promise<boolean>;
  // メモ（Compassメモ / 一時メモ）を Evidence として整理・保存する。
  // 出所種別は student_note。options.sourceReference（例 {kind:"student_note", id: note.id}）を
  // 付けると、DB 一意制約による重複防止と「整理済み」判定（isCollectedBySource）に対応する。
  // options 未指定時は従来どおり出所参照なしの一時メモ収集（後方互換）。
  collectMemo: (
    content: string,
    options?: {
      sourceReference?: InformationSourceReference;
      originalText?: string;
      sourceLabel?: string;
    },
  ) => Promise<boolean>;
  // Core 画面の任意情報源（電子カルテ記録・患者発言 等）を Evidence として収集する。
  // 成功時は cards へ即時反映し、duplicate はサーバの最新へ合わせたうえで区別可能な結果を返す。
  collectSource: (args: CaptureSourceArgs) => Promise<CaptureResult>;
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
  localOnly: localOnlyProp = false,
}: {
  patientId: string;
  initial: InformationCard[];
  /** Version 2.2 講義デモ: Server Action を呼ばずメモリ内のみ。 */
  localOnly?: boolean;
}): UseEvidenceSupabaseResult {
  const lectureLocalOnly = useLectureLocalOnly();
  const localOnly = localOnlyProp || lectureLocalOnly;
  const [cards, setCards] = useState<InformationCard[]>(() => sortCards(initial));
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  // 非同期コールバック内から常に最新の cards を参照する（expectedUpdatedAt 解決用）。
  const cardsRef = useRef<InformationCard[]>(cards);
  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);

  // 進行中フラグ（二重送信防止）。finally で必ず解除する。
  const busyRef = useRef(false);

  const clearMessage = useCallback(() => setMessage(null), []);

  const reload = useCallback(async () => {
    if (localOnly) return;
    const res = await callAction(() => listCardsAction(patientId));
    if (res.ok) {
      setCards(sortCards(res.data));
    }
  }, [patientId, localOnly]);

  const collectUtterance = useCallback(
    async ({
      content,
      originalText,
    }: {
      content: string;
      originalText: string;
    }): Promise<boolean> => {
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          const now = Date.now();
          const card: InformationCard = {
            id: `lecture-${now}`,
            patientId,
            content,
            sourceType: "patient_conversation",
            sourceLabel: "患者との会話",
            sourceReference: { kind: "patient_conversation" },
            originalText,
            createdBy: "student",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          };
          setCards((prev) => sortCards([...prev, card]));
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          createCardAction({
            patientId,
            content,
            sourceType: "patient_conversation",
            sourceLabel: "患者との会話",
            // TD-001: 出所 id はサーバが original_text から再計算する（client 値は使わない）。
            sourceReference: { kind: "patient_conversation" },
            originalText,
          }),
        );
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
        // network / unexpected / db_error 等はすべて error（既存の収集候補は残る）。
        setStatus("error");
        setMessage(`収集できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
  );

  const collectMemo = useCallback(
    async (
      rawContent: string,
      options?: {
        sourceReference?: InformationSourceReference;
        originalText?: string;
        sourceLabel?: string;
      },
    ): Promise<boolean> => {
      const content = rawContent.trim();
      if (content === "") return false;
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          const now = Date.now();
          const card: InformationCard = {
            id: `lecture-memo-${now}`,
            patientId,
            content,
            sourceType: "student_note",
            sourceLabel: options?.sourceLabel ?? "一時メモ",
            sourceReference: options?.sourceReference,
            originalText: options?.originalText ?? content,
            createdBy: "student",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          };
          setCards((prev) => sortCards([...prev, card]));
          setStatus("idle");
          return true;
        }
        // Compassメモ由来は sourceReference {kind:"student_note", id: note.id} を付ける。
        // これにより uq_information_cards_source（source_reference.id 前提）で重複を防ぐ。
        // 出所参照なし（従来の一時メモ）の場合は重複防止インデックスの対象外。
        const res = await callAction(() =>
          createCardAction({
            patientId,
            content,
            sourceType: "student_note",
            sourceLabel: options?.sourceLabel ?? "一時メモ",
            sourceReference: options?.sourceReference,
            originalText: options?.originalText ?? content,
          }),
        );
        if (res.ok) {
          setCards((prev) => sortCards([...prev, res.data]));
          setStatus("idle");
          return true;
        }
        if (res.kind === "duplicate") {
          // 既に同じメモから Evidence 化済み（別端末・二重送信含む）。最新へ合わせる。
          await reload();
          setStatus("idle");
          return true;
        }
        // 失敗時は入力（memo）を呼び出し側で保持する（本フックは false を返すのみ）。
        setStatus("error");
        setMessage(`収集できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
  );

  const collectSource = useCallback(
    async (args: CaptureSourceArgs): Promise<CaptureResult> => {
      const content = args.content.trim();
      if (content === "") return { ok: false, kind: "validation" };
      if (busyRef.current) return { ok: false, kind: "unexpected" }; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          const now = Date.now();
          const card: InformationCard = {
            id: `lecture-src-${now}`,
            patientId,
            content,
            sourceType: args.sourceType,
            sourceLabel: args.sourceLabel,
            sourceReference: args.sourceReference,
            originalText: args.originalText,
            note: args.note,
            category: args.category,
            createdBy: "student",
            createdAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString(),
          };
          setCards((prev) => sortCards([...prev, card]));
          setStatus("idle");
          return { ok: true };
        }
        const res = await callAction(() =>
          createCardAction({
            patientId,
            content,
            sourceType: args.sourceType,
            sourceLabel: args.sourceLabel,
            sourceReference: args.sourceReference,
            originalText: args.originalText,
            note: args.note,
            category: args.category,
          }),
        );
        if (res.ok) {
          setCards((prev) => sortCards([...prev, res.data]));
          setStatus("idle");
          return { ok: true };
        }
        if (res.kind === "duplicate") {
          // 同じ出所を既に収集済み。最新へ合わせ、呼び出し側で「保存済み」を示せるようにする。
          await reload();
          setStatus("idle");
          return { ok: false, kind: "duplicate" };
        }
        // network / unexpected / unauthorized / db_error 等。既存の表示は壊さない。
        setStatus("error");
        setMessage(`収集できませんでした。${NETWORK_HINT}`);
        return { ok: false, kind: res.kind };
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
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
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          const updatedAt = new Date().toISOString();
          setCards((prev) =>
            sortCards(
              prev.map((c) =>
                c.id === id ? { ...c, content, updatedAt } : c,
              ),
            ),
          );
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          updateCardAction({
            patientId,
            id,
            expectedUpdatedAt,
            patch: { content },
          }),
        );
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
        // network / unexpected / db_error 等。対象カードは消さず、修正内容も破棄しない。
        setStatus("error");
        setMessage(`修正を保存できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
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
      if (busyRef.current) return false; // 二重送信防止
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          setCards((prev) => prev.filter((c) => c.id !== id));
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          releaseCardAction({ patientId, id, expectedUpdatedAt }),
        );
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
        // network / unexpected / db_error 等。カードは一覧から消さない（消失の誤解を防ぐ）。
        setStatus("error");
        setMessage(`収集解除できませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
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
    collectMemo,
    collectSource,
    updateContent,
    release,
    reload,
    isCollectedBySource,
    clearMessage,
  };
}
