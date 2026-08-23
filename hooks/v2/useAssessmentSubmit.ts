"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAssessmentSubmitPreviewAction,
  listMyAssessmentSubmissionsAction,
  listOpenAssessmentMilestonesAction,
  submitAssessmentAction,
} from "@/app/v2/actions/assessmentSubmission";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";
import {
  evaluationTypeLabel,
  prefersForm2,
  prefersForm3,
} from "@/lib/v2/assessment/submissionScope";
import type {
  AssessmentSubmissionListItem,
  AssessmentSubmitPreview,
  AssessmentSubmitSuccess,
  OpenAssessmentMilestoneItem,
} from "@/lib/v2/assessment/types";

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function studentFacingError(message: string, kind?: string): string {
  if (kind === "duplicate" || /duplicate/i.test(message)) {
    return "同じ提出処理がすでに受け付けられています。提出履歴をご確認ください。";
  }
  if (/unauthorized|not_configured|failed|validation|db_error|invalid/i.test(message)) {
    if (message.includes("受付を終了") || message.includes("受付開始前")) {
      return message;
    }
    if (message.includes("提出課題が見つかりません")) return message;
    if (message.includes("選択してください")) return message;
    return "提出に失敗しました。時間をおいて再度お試しください。";
  }
  return message;
}

export function useAssessmentSubmit(
  patientId: string,
  surface: "form2" | "form3" = "form2",
) {
  const localOnly = useLectureLocalOnly();
  const [milestones, setMilestones] = useState<OpenAssessmentMilestoneItem[]>(
    [],
  );
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(
    null,
  );
  const [loadingList, setLoadingList] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<AssessmentSubmitPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<AssessmentSubmitSuccess | null>(
    null,
  );
  const [historyKey, setHistoryKey] = useState(0);
  const [historyOpenKey, setHistoryOpenKey] = useState(0);
  /** 同一送信の再試行時のみ再利用。成功／失敗後のボタン再押下では破棄する */
  const inFlightClientRequestId = useRef<string | null>(null);

  const mergeSubmissionStats = useCallback(
    (
      items: OpenAssessmentMilestoneItem[],
      submissions: AssessmentSubmissionListItem[],
    ): OpenAssessmentMilestoneItem[] => {
      const latest = new Map<string, AssessmentSubmissionListItem>();
      const counts = new Map<string, number>();
      for (const s of submissions) {
        counts.set(
          s.assessmentMilestoneId,
          (counts.get(s.assessmentMilestoneId) ?? 0) + 1,
        );
        const prev = latest.get(s.assessmentMilestoneId);
        if (
          !prev ||
          new Date(s.submittedAt).getTime() > new Date(prev.submittedAt).getTime()
        ) {
          latest.set(s.assessmentMilestoneId, s);
        }
      }
      return items.map((m) => ({
        ...m,
        latestSubmission: latest.get(m.milestoneId) ?? null,
        submissionCount: counts.get(m.milestoneId) ?? 0,
      }));
    },
    [],
  );

  const reloadMilestones = useCallback(async () => {
    if (localOnly) {
      setMilestones([]);
      return;
    }
    setLoadingList(true);
    const [listRes, histRes] = await Promise.all([
      listOpenAssessmentMilestonesAction(patientId),
      listMyAssessmentSubmissionsAction(patientId),
    ]);
    setLoadingList(false);
    if (!listRes.ok) {
      setMilestones([]);
      return;
    }
    const sorted = [...listRes.items].sort((a, b) => {
      const ap =
        surface === "form2"
          ? prefersForm2(a.milestoneType)
            ? 0
            : 1
          : prefersForm3(a.milestoneType)
            ? 0
            : 1;
      const bp =
        surface === "form2"
          ? prefersForm2(b.milestoneType)
            ? 0
            : 1
          : prefersForm3(b.milestoneType)
            ? 0
            : 1;
      if (ap !== bp) return ap - bp;
      return a.sequenceNumber - b.sequenceNumber;
    });
    const withStats = mergeSubmissionStats(
      sorted,
      histRes.ok ? histRes.items : [],
    );
    setMilestones(withStats);
    // 複数あるときは推測選択しない（1件のみなら確定）
    setSelectedMilestoneId((prev) => {
      if (prev && withStats.some((m) => m.milestoneId === prev)) return prev;
      if (withStats.length === 1) return withStats[0]!.milestoneId;
      return null;
    });
  }, [localOnly, patientId, surface, mergeSubmissionStats]);

  useEffect(() => {
    void reloadMilestones();
  }, [reloadMilestones, historyKey]);

  const selected = useMemo(
    () => milestones.find((m) => m.milestoneId === selectedMilestoneId) ?? null,
    [milestones, selectedMilestoneId],
  );

  const closeDialog = useCallback(() => {
    if (submitting) return;
    setDialogOpen(false);
    setPreview(null);
    inFlightClientRequestId.current = null;
  }, [submitting]);

  const beginSubmit = useCallback(
    async (milestoneId?: string) => {
      if (localOnly) {
        window.alert("講義デモでは課題を提出できません。");
        return;
      }
      const id = milestoneId ?? selectedMilestoneId;
      if (!id) {
        window.alert("提出する課題を選択してください。");
        return;
      }
      // 新しい提出操作の開始 → 前回の client_request_id は破棄
      inFlightClientRequestId.current = null;
      setSubmitting(true);
      const previewRes = await getAssessmentSubmitPreviewAction({
        patientId,
        assessmentMilestoneId: id,
      });
      setSubmitting(false);
      if (!previewRes.ok) {
        window.alert(studentFacingError(previewRes.message, previewRes.kind));
        return;
      }
      // プレビューで返った ID を正とする（カード選択と一致を保証）
      setSelectedMilestoneId(previewRes.data.assessmentMilestoneId);
      setPreview(previewRes.data);
      setDialogOpen(true);
    },
    [localOnly, patientId, selectedMilestoneId],
  );

  const confirmSubmit = useCallback(async () => {
    if (localOnly) {
      window.alert("講義デモでは課題を提出できません。");
      return;
    }
    const milestoneId =
      preview?.assessmentMilestoneId ?? selectedMilestoneId;
    if (!milestoneId) {
      window.alert("提出する課題を選択してください。");
      return;
    }

    // 同一送信の再試行時のみ同じ ID。初回ボタン押下では新規生成。
    const clientRequestId =
      inFlightClientRequestId.current ?? newClientRequestId();
    inFlightClientRequestId.current = clientRequestId;

    setSubmitting(true);
    const res = await submitAssessmentAction({
      patientId,
      assessmentMilestoneId: milestoneId,
      clientRequestId,
    });
    setSubmitting(false);

    if (!res.ok) {
      // ユーザーが再度ボタンを押す場合は新しい ID を使う
      inFlightClientRequestId.current = null;
      window.alert(studentFacingError(res.message, res.kind));
      return;
    }

    inFlightClientRequestId.current = null;
    setLastResult(res.data);
    setDialogOpen(false);
    setPreview(null);
    setSelectedMilestoneId(res.data.assessmentMilestoneId);
    // DB 最新を再取得（カード表示・履歴）
    setHistoryKey((k) => k + 1);
  }, [localOnly, patientId, preview, selectedMilestoneId]);

  const openHistory = useCallback(() => {
    setHistoryOpenKey((k) => k + 1);
  }, []);

  return {
    milestones,
    selectedMilestoneId,
    setSelectedMilestoneId,
    selected,
    loadingList,
    dialogOpen,
    preview,
    submitting,
    lastResult,
    historyKey,
    historyOpenKey,
    beginSubmit,
    confirmSubmit,
    closeDialog,
    openHistory,
    evaluationTypeLabel,
  };
}
