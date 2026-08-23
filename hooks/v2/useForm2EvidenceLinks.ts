"use client";

// Compass Version2 — Learning Layer (Sprint D-2B)
// Evidence–様式2 の根拠リンク（form2_evidence_links）の Supabase 接続フック。
//
// 責務:
//   ・リンク一覧を保持する（マウント時にサーバから取得 → 再読み込み後も状態を保持）。
//   ・「様式2で使う」= addLink（Evidence を様式2 の項目の根拠として紐づける）。
//   ・「根拠から外す」= removeLink / removeLinksForEvidence（Evidence 解除時の後始末）。
//   ・未整理／整理済みは「リンクの有無」から導出する（linksForEvidence / linksForField）。
//
// 方針（既存 useEvidenceSupabase の設計を踏襲）:
//   ・Server Action は callAction 経由（通信断・reject を安全に正規化）。
//   ・busyRef で二重送信を防ぐ。失敗時は既存リンク表示を壊さない（成功時のみ反映）。
//   ・様式2 レコードが未作成のままリンクした場合、Action が空レコードを用意して snapshot を返す。
//     その snapshot は onForm2Ensured で親（AppShell セッション）へ同期し、様式2 初回保存の
//     競合を避ける。Evidence 本文は様式2 へ自動転記しない（リンクは関係のみ）。

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createForm2EvidenceLinkAction,
  deleteForm2EvidenceLinkAction,
  deleteForm2EvidenceLinksByEvidenceAction,
  listForm2EvidenceLinksAction,
} from "@/app/v2/actions/form2EvidenceLinks";
import { callAction } from "@/lib/v2/callAction";
import type { Form2EvidenceLink } from "@/lib/v2/notebook/form2EvidenceLinkMapper";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";

const NETWORK_HINT = "通信状況を確認して、もう一度お試しください。";

export type LinksStatus = "idle" | "working" | "error";

export interface UseForm2EvidenceLinksResult {
  links: Form2EvidenceLink[];
  status: LinksStatus;
  message: string | null;
  linksForField: (fieldKey: string) => Form2EvidenceLink[];
  linksForEvidence: (evidenceId: string) => Form2EvidenceLink[];
  addLink: (evidenceId: string, fieldKey: string) => Promise<boolean>;
  removeLink: (linkId: string) => Promise<boolean>;
  removeLinksForEvidence: (evidenceId: string) => Promise<void>;
  reload: () => Promise<void>;
  clearMessage: () => void;
}

export function useForm2EvidenceLinks({
  patientId,
  onForm2Ensured,
}: {
  patientId: string;
  // リンクのために様式2 の空レコードを新規作成したとき、確定 snapshot を親へ通知する。
  onForm2Ensured?: (snapshot: Form2Snapshot) => void;
}): UseForm2EvidenceLinksResult {
  const localOnly = useLectureLocalOnly();
  const [links, setLinks] = useState<Form2EvidenceLink[]>([]);
  const [status, setStatus] = useState<LinksStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const busyRef = useRef(false);
  const onEnsuredRef = useRef(onForm2Ensured);
  useEffect(() => {
    onEnsuredRef.current = onForm2Ensured;
  }, [onForm2Ensured]);

  const clearMessage = useCallback(() => setMessage(null), []);

  const reload = useCallback(async () => {
    if (localOnly) return;
    const res = await callAction(() => listForm2EvidenceLinksAction(patientId));
    if (res.ok) setLinks(res.data);
  }, [patientId, localOnly]);

  // マウント時（患者切替時）にサーバから取得する（再読み込み後も状態を保持）。
  useEffect(() => {
    if (localOnly) return;
    let alive = true;
    void (async () => {
      const res = await callAction(() => listForm2EvidenceLinksAction(patientId));
      if (alive && res.ok) setLinks(res.data);
    })();
    return () => {
      alive = false;
    };
  }, [patientId, localOnly]);

  const linksForField = useCallback(
    (fieldKey: string) => links.filter((l) => l.formFieldKey === fieldKey),
    [links],
  );
  const linksForEvidence = useCallback(
    (evidenceId: string) => links.filter((l) => l.evidenceId === evidenceId),
    [links],
  );

  const addLink = useCallback(
    async (evidenceId: string, fieldKey: string): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          const created: Form2EvidenceLink = {
            id: `lecture-link-${Date.now()}`,
            evidenceId,
            formFieldKey: fieldKey,
            createdAt: new Date().toISOString(),
          };
          setLinks((prev) =>
            prev.some(
              (l) =>
                l.evidenceId === evidenceId && l.formFieldKey === fieldKey,
            )
              ? prev
              : [...prev, created],
          );
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          createForm2EvidenceLinkAction({ patientId, evidenceId, fieldKey }),
        );
        if (res.ok) {
          if (res.form2Ensured) onEnsuredRef.current?.(res.form2Ensured);
          if (res.duplicate || !res.data) {
            // 既に同じリンクがある → 最新へ合わせる。
            await reload();
          } else {
            const created = res.data;
            setLinks((prev) =>
              prev.some((l) => l.id === created.id) ? prev : [...prev, created],
            );
          }
          setStatus("idle");
          return true;
        }
        setStatus("error");
        setMessage(`様式2 に紐づけできませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, reload, localOnly],
  );

  const removeLink = useCallback(
    async (linkId: string): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setStatus("working");
      setMessage(null);
      try {
        if (localOnly) {
          setLinks((prev) => prev.filter((l) => l.id !== linkId));
          setStatus("idle");
          return true;
        }
        const res = await callAction(() =>
          deleteForm2EvidenceLinkAction({ patientId, id: linkId }),
        );
        if (res.ok) {
          setLinks((prev) => prev.filter((l) => l.id !== linkId));
          setStatus("idle");
          return true;
        }
        setStatus("error");
        setMessage(`根拠から外せませんでした。${NETWORK_HINT}`);
        return false;
      } finally {
        busyRef.current = false;
      }
    },
    [patientId, localOnly],
  );

  // Evidence 解除（論理削除）時に、その Evidence のリンクをまとめて外す。
  const removeLinksForEvidence = useCallback(
    async (evidenceId: string): Promise<void> => {
      // 楽観的にローカルからも除く（表示の整合）。
      setLinks((prev) => prev.filter((l) => l.evidenceId !== evidenceId));
      if (localOnly) return;
      await callAction(() =>
        deleteForm2EvidenceLinksByEvidenceAction({ patientId, evidenceId }),
      );
    },
    [patientId, localOnly],
  );

  return {
    links,
    status,
    message,
    linksForField,
    linksForEvidence,
    addLink,
    removeLink,
    removeLinksForEvidence,
    reload,
    clearMessage,
  };
}
