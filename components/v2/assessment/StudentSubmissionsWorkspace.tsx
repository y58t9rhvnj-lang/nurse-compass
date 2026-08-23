"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAssessmentSubmitPreviewAction,
  getSubmissionContentCheckAction,
  listStudentSubmissionTasksAction,
  submitAssessmentAction,
} from "@/app/v2/actions/assessmentSubmission";
import AssessmentSubmitDialog from "@/components/v2/assessment/AssessmentSubmitDialog";
import Form3SubmitConfirmDialog from "@/components/v2/form3/Form3SubmitConfirmDialog";
import { useLectureLocalOnly } from "@/components/v2/lecture/LectureLocalOnlyContext";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  evaluationTypeLabel,
  formatSubmissionScopeJa,
  milestoneTypeLabel,
} from "@/lib/v2/assessment/submissionScope";
import {
  STUDENT_TASK_BUCKET_ORDER,
  studentTaskSectionTitle,
} from "@/lib/v2/assessment/studentSubmissionTasks";
import type {
  AssessmentSubmitPreview,
  StudentSubmissionTask,
  StudentSubmissionTaskBucket,
} from "@/lib/v2/assessment/types";
import type { Form3MissingItem } from "@/lib/form3/v2/collectForm3Missing";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { AppView } from "@/components/SideNav";

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
  if (message.includes("受付を終了") || message.includes("受付開始前")) {
    return message;
  }
  if (/unauthorized|not_configured|failed|validation|db_error|invalid/i.test(message)) {
    return "提出に失敗しました。時間をおいて再度お試しください。";
  }
  return message;
}

function workspaceTarget(type: StudentSubmissionTask["milestoneType"]): {
  view: AppView;
  label: string;
} {
  switch (type) {
    case "form2":
      return { view: "clinical-workspace", label: "様式2を確認する" };
    case "form3_progress":
    case "form3_complete":
      return { view: "form3", label: "様式3を確認する" };
    case "final":
    case "custom":
      return { view: "clinical-workspace", label: "様式2を確認する" };
  }
}

function statusLines(task: StudentSubmissionTask): {
  badge: string;
  badgeClass: string;
  detail: string[];
} {
  const latest = task.latestSubmission;
  if (task.bucket === "not_yet_open") {
    return {
      badge: "受付開始前",
      badgeClass: "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73]",
      detail: [
        task.opensAt
          ? `受付開始：${formatAssessmentDateTimeJa(task.opensAt)}`
          : "",
      ].filter(Boolean),
    };
  }
  if (task.bucket === "closed") {
    return {
      badge: "受付終了",
      badgeClass: "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73]",
      detail: latest
        ? [
            `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
            `提出回数：${task.submissionCount}回`,
          ]
        : ["提出はありません"],
    };
  }
  if (task.bucket === "archived") {
    return {
      badge: "過去の提出課題",
      badgeClass: "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73]",
      detail: latest
        ? [
            `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
            `提出回数：${task.submissionCount}回`,
          ]
        : [],
    };
  }
  if (!latest) {
    const late = task.bucket === "open_late";
    return {
      badge: late ? "未提出・期限後" : "未提出",
      badgeClass: late
        ? "border-[#F0D9A8] bg-[#FFF8EC] text-[#8A5A12]"
        : "border-[#F0D9A8] bg-[#FFF8EC] text-[#8A5A12]",
      detail: [],
    };
  }
  if (latest.timingStatus === "on_time") {
    return {
      badge: "提出済み",
      badgeClass: "border-[#B7D7C2] bg-[#F3FAF4] text-[#2F6B3C]",
      detail: [
        `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
        `提出回数：${task.submissionCount}回`,
        "状態：期限内",
      ],
    };
  }
  if (latest.lateReviewStatus === "pending") {
    return {
      badge: "期限後提出済み",
      badgeClass: "border-[#F0D9A8] bg-[#FFF8EC] text-[#8A5A12]",
      detail: [
        `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
        `提出回数：${task.submissionCount}回`,
        "状態：教員確認待ち",
      ],
    };
  }
  if (latest.lateReviewStatus === "approved") {
    return {
      badge: "期限後提出・承認済み",
      badgeClass: "border-[#B7D7C2] bg-[#F3FAF4] text-[#2F6B3C]",
      detail: [
        `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
        `提出回数：${task.submissionCount}回`,
      ],
    };
  }
  if (latest.lateReviewStatus === "rejected") {
    return {
      badge: "期限後提出・評価対象外",
      badgeClass: "border-[#E5E5EA] bg-[#F5F5F7] text-[#6E6E73]",
      detail: [
        `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
        `提出回数：${task.submissionCount}回`,
      ],
    };
  }
  return {
    badge: "期限後提出済み",
    badgeClass: "border-[#F0D9A8] bg-[#FFF8EC] text-[#8A5A12]",
    detail: [
      `最新提出：${formatAssessmentDateTimeJa(latest.submittedAt)}`,
      `提出回数：${task.submissionCount}回`,
    ],
  };
}

export default function StudentSubmissionsWorkspace({
  patientId,
  onNavigateWorkspace,
  onPendingCountChange,
  onNotify,
}: {
  patientId: string;
  onNavigateWorkspace: (view: AppView) => void;
  onPendingCountChange?: (count: number) => void;
  onNotify?: (message: string) => void;
}) {
  const localOnly = useLectureLocalOnly();
  const [tasks, setTasks] = useState<StudentSubmissionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<AssessmentSubmitPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [form3ConfirmOpen, setForm3ConfirmOpen] = useState(false);
  const [form3Missing, setForm3Missing] = useState<Form3MissingItem[]>([]);
  const [pendingMilestoneId, setPendingMilestoneId] = useState<string | null>(
    null,
  );
  const inFlightClientRequestId = useRef<string | null>(null);

  const reload = useCallback(async () => {
    if (localOnly) {
      setTasks([]);
      setLoading(false);
      onPendingCountChange?.(0);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await listStudentSubmissionTasksAction(patientId);
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      setTasks([]);
      onPendingCountChange?.(0);
      return;
    }
    setTasks(res.tasks);
    onPendingCountChange?.(res.pendingBadgeCount);
  }, [localOnly, patientId, onPendingCountChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sections = useMemo(() => {
    const map = new Map<StudentSubmissionTaskBucket, StudentSubmissionTask[]>();
    for (const b of STUDENT_TASK_BUCKET_ORDER) map.set(b, []);
    for (const t of tasks) {
      map.get(t.bucket)?.push(t);
    }
    return STUDENT_TASK_BUCKET_ORDER.map((bucket) => ({
      bucket,
      title: studentTaskSectionTitle(bucket),
      items: map.get(bucket) ?? [],
    })).filter((s) => s.items.length > 0);
  }, [tasks]);

  const openPreview = useCallback(
    async (milestoneId: string) => {
      if (localOnly) {
        window.alert("講義デモでは課題を提出できません。");
        return;
      }
      inFlightClientRequestId.current = null;
      setSubmittingId(milestoneId);
      const previewRes = await getAssessmentSubmitPreviewAction({
        patientId,
        assessmentMilestoneId: milestoneId,
      });
      setSubmittingId(null);
      if (!previewRes.ok) {
        window.alert(studentFacingError(previewRes.message, previewRes.kind));
        return;
      }
      setPreview(previewRes.data);
      setDialogOpen(true);
    },
    [localOnly, patientId],
  );

  const beginSubmitFlow = useCallback(
    async (task: StudentSubmissionTask) => {
      if (!task.canSubmit) return;
      if (localOnly) {
        window.alert("講義デモでは課題を提出できません。");
        return;
      }
      setSubmittingId(task.milestoneId);
      const check = await getSubmissionContentCheckAction({
        patientId,
        milestoneType: task.milestoneType,
      });
      setSubmittingId(null);
      if (!check.ok) {
        window.alert(check.message);
        return;
      }
      if (check.form2Missing.length > 0 && !check.needsForm3Confirm) {
        const ok = window.confirm(
          `未入力の項目が ${check.form2Missing.length} 件あります。内容を確認したうえで提出しますか？`,
        );
        if (!ok) return;
      }
      if (check.needsForm3Confirm) {
        setForm3Missing(check.form3Missing);
        setPendingMilestoneId(task.milestoneId);
        setForm3ConfirmOpen(true);
        return;
      }
      await openPreview(task.milestoneId);
    },
    [localOnly, patientId, openPreview],
  );

  const confirmSubmit = useCallback(async () => {
    if (!preview) return;
    const milestoneId = preview.assessmentMilestoneId;
    const clientRequestId =
      inFlightClientRequestId.current ?? newClientRequestId();
    inFlightClientRequestId.current = clientRequestId;
    setSubmittingId(milestoneId);
    const res = await submitAssessmentAction({
      patientId,
      assessmentMilestoneId: milestoneId,
      clientRequestId,
    });
    setSubmittingId(null);
    if (!res.ok) {
      inFlightClientRequestId.current = null;
      window.alert(studentFacingError(res.message, res.kind));
      return;
    }
    inFlightClientRequestId.current = null;
    setDialogOpen(false);
    setPreview(null);
    onNotify?.("提出が完了しました");
    await reload();
  }, [preview, patientId, onNotify, reload]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F2F2F7]">
      <header className="shrink-0 border-b border-[#E5E5EA] bg-white px-5 py-4">
        <h1 className="text-[20px] font-bold text-[#1D1D1F]">提出</h1>
        <p className="mt-1 text-[13px] text-[#6E6E73]">
          提出課題・期限・提出状態をここで確認し、提出・再提出できます。
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-[13px] text-[#8E8E93]">読み込み中…</p>
        ) : error ? (
          <p className="text-[13px] text-[#C0392B]">{error}</p>
        ) : tasks.length === 0 ? (
          <p className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-6 text-center text-[13px] text-[#8E8E93]">
            現在、表示できる提出課題はありません。
          </p>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {sections.map((section) => (
              <section key={section.bucket} className="space-y-2">
                <h2 className="px-1 text-[13px] font-semibold text-[#6E6E73]">
                  {section.title}
                </h2>
                <ul className="space-y-3">
                  {section.items.map((task) => {
                    const status = statusLines(task);
                    const target = workspaceTarget(task.milestoneType);
                    const scopeJa = formatSubmissionScopeJa(
                      task.milestoneType,
                      task.submissionScope,
                    );
                    const busy = submittingId === task.milestoneId;
                    const historyOpen = historyOpenId === task.milestoneId;
                    return (
                      <li
                        key={task.milestoneId}
                        className="rounded-2xl border border-[#E5E5EA] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                      >
                        <p className="text-[11px] font-medium text-[#6E86A8]">
                          {task.cycleTitle}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-[#1D1D1F]">
                            {task.title}
                          </h3>
                          <span
                            className={[
                              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                              status.badgeClass,
                            ].join(" ")}
                          >
                            {status.badge}
                          </span>
                        </div>
                        {task.description ? (
                          <p className="mt-1 text-[12px] text-[#6E6E73]">
                            {task.description}
                          </p>
                        ) : null}
                        <p className="mt-2 text-[12px] text-[#6E6E73]">
                          {milestoneTypeLabel(task.milestoneType)} ・{" "}
                          {evaluationTypeLabel(task.evaluationType)}
                        </p>
                        <p className="mt-0.5 text-[12px] text-[#3A3A3C]">
                          提出範囲：{scopeJa}
                        </p>
                        {task.opensAt ? (
                          <p className="mt-0.5 text-[12px] text-[#6E6E73]">
                            受付開始：{formatAssessmentDateTimeJa(task.opensAt)}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-[12px] text-[#3A3A3C]">
                          提出期限：{formatAssessmentDateTimeJa(task.deadlineAt)}
                        </p>
                        {status.detail.map((line) => (
                          <p
                            key={line}
                            className="mt-0.5 text-[12px] text-[#3A3A3C]"
                          >
                            {line}
                          </p>
                        ))}

                        {busy ? (
                          <p className="mt-3 text-[13px] font-medium text-[#0A84FF]">
                            提出しています…
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-col gap-1.5">
                          <button
                            type="button"
                            className="flex h-11 w-full items-center justify-center rounded-xl border border-[#E5E5EA] bg-white text-[13px] font-medium text-[#0A84FF]"
                            onClick={() => onNavigateWorkspace(target.view)}
                          >
                            {target.label}
                          </button>
                          {task.canSubmit ? (
                            <button
                              type="button"
                              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0A84FF] text-[13px] font-semibold text-white disabled:opacity-50"
                              disabled={busy || Boolean(submittingId)}
                              onClick={() => void beginSubmitFlow(task)}
                            >
                              {task.latestSubmission
                                ? task.latestSubmission.timingStatus === "late"
                                  ? "再提出"
                                  : "修正後に再提出"
                                : "提出する"}
                            </button>
                          ) : null}
                          {task.submissionCount > 0 ? (
                            <button
                              type="button"
                              className="flex h-11 w-full items-center justify-center rounded-xl border border-[#E5E5EA] bg-white text-[13px] font-medium text-[#3A3A3C]"
                              onClick={() =>
                                setHistoryOpenId((id) =>
                                  id === task.milestoneId
                                    ? null
                                    : task.milestoneId,
                                )
                              }
                            >
                              {historyOpen ? "提出履歴を閉じる" : "提出履歴"}
                            </button>
                          ) : null}
                        </div>

                        {historyOpen ? (
                          <ul className="mt-3 space-y-2 rounded-xl border border-[#F0F0F3] bg-[#FAFAFC] p-2.5">
                            {task.submissions.map((s) => (
                              <li
                                key={s.id}
                                className="text-[12px] text-[#3A3A3C]"
                              >
                                <p className="font-medium">
                                  {s.submissionNumber}回目 ・{" "}
                                  {formatAssessmentDateTimeJa(s.submittedAt)}
                                </p>
                                <p className="text-[#6E6E73]">
                                  {s.timingStatus === "on_time"
                                    ? "期限内"
                                    : s.lateReviewStatus === "pending"
                                      ? "期限後・教員確認待ち"
                                      : s.lateReviewStatus === "approved"
                                        ? "期限後・承認済み"
                                        : s.lateReviewStatus === "rejected"
                                          ? "期限後・評価対象外"
                                          : "期限後"}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <AssessmentSubmitDialog
        open={dialogOpen}
        preview={preview}
        submitting={Boolean(submittingId)}
        onCancel={() => {
          if (submittingId) return;
          setDialogOpen(false);
          setPreview(null);
          inFlightClientRequestId.current = null;
        }}
        onConfirm={() => void confirmSubmit()}
      />

      <Form3SubmitConfirmDialog
        open={form3ConfirmOpen}
        missing={form3Missing}
        saveLabel="保存済みデータを確認しました"
        onClose={() => {
          setForm3ConfirmOpen(false);
          setPendingMilestoneId(null);
          setForm3Missing([]);
        }}
        onSubmitAnyway={() => {
          const id = pendingMilestoneId;
          setForm3ConfirmOpen(false);
          setPendingMilestoneId(null);
          setForm3Missing([]);
          if (id) void openPreview(id);
        }}
        onJumpToPattern={(_key: Form3PatternKey) => {
          setForm3ConfirmOpen(false);
          setPendingMilestoneId(null);
          onNavigateWorkspace("form3");
        }}
      />
    </main>
  );
}
