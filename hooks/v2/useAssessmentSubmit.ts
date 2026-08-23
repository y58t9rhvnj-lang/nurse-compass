"use client";

import { useCallback, useState } from "react";
import {
  getAssessmentSubmitPreviewAction,
  submitAssessmentAction,
} from "@/app/v2/actions/assessmentSubmission";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";
import type {
  AssessmentSubmitPreview,
  AssessmentSubmitSuccess,
} from "@/lib/v2/assessment/types";

function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Form2 / Form3 共通の課題提出フロー。
 */
export function useAssessmentSubmit(patientId: string) {
  const localOnly = useLectureLocalOnly();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<AssessmentSubmitPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<AssessmentSubmitSuccess | null>(
    null,
  );
  const [historyKey, setHistoryKey] = useState(0);

  const closeDialog = useCallback(() => {
    if (submitting) return;
    setDialogOpen(false);
    setPreview(null);
  }, [submitting]);

  const beginSubmit = useCallback(async () => {
    if (localOnly) {
      window.alert("講義デモでは課題を提出できません。");
      return;
    }
    setSubmitting(true);
    const previewRes = await getAssessmentSubmitPreviewAction(patientId);
    setSubmitting(false);
    if (!previewRes.ok) {
      window.alert(previewRes.message);
      return;
    }
    setPreview(previewRes.data);
    setDialogOpen(true);
  }, [localOnly, patientId]);

  const confirmSubmit = useCallback(async () => {
    if (localOnly) {
      window.alert("講義デモでは課題を提出できません。");
      return;
    }
    setSubmitting(true);
    const requestId = newClientRequestId();
    const res = await submitAssessmentAction({
      patientId,
      clientRequestId: requestId,
    });
    setSubmitting(false);

    if (!res.ok) {
      window.alert(res.message);
      return;
    }

    setLastResult(res.data);
    setDialogOpen(false);
    setPreview(null);
    setHistoryKey((k) => k + 1);
  }, [localOnly, patientId]);

  return {
    dialogOpen,
    preview,
    submitting,
    lastResult,
    historyKey,
    beginSubmit,
    confirmSubmit,
    closeDialog,
  };
}
