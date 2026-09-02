"use client";

import { useCallback, useEffect, useId, useMemo, useState, useTransition } from "react";
import { getAiEvaluationCandidateForSubmissionAction } from "@/app/v2/actions/assessmentAiEvaluationCandidate";
import { adoptAiEvaluationCandidateAction } from "@/app/v2/actions/assessmentAiEvaluationAdopt";
import {
  acknowledgeAiEvaluationWarningAction,
  acknowledgeAllAiEvaluationWarningsAction,
} from "@/app/v2/actions/assessmentAiEvaluationWarnings";
import type {
  AiCandidateWarningView,
  AiEvaluationCandidateReadModel,
} from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";
import { feedbackBlockToReviewComment } from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";
import {
  AI_FEEDBACK_BLOCK_LABELS,
  aiReviewStatusLabel,
  aiValidationStatusLabel,
} from "@/lib/v2/assessment/aiEvaluationCandidateUiLabels";
import type { AssessmentRubricKey } from "@/lib/v2/assessment/assessmentRubric";
import TeacherAiEvaluationItemCard from "./TeacherAiEvaluationItemCard";
import TeacherAiEvaluationSection from "./TeacherAiEvaluationSection";
import TeacherAiEvaluationWarningList from "./TeacherAiEvaluationWarningList";

type Props = {
  milestoneId: string;
  studentId: string;
  submissionId: string | null;
  reviewId: string | null;
  reviewUpdatedAt: string | null;
  teacherScores: Partial<Record<AssessmentRubricKey, number | null>>;
  readOnly: boolean;
  onAdopted: (result: {
    reviewId: string;
    reviewUpdatedAt: string;
  }) => void;
};

export default function TeacherAiEvaluationCandidatePanel({
  milestoneId,
  studentId,
  submissionId,
  reviewId,
  reviewUpdatedAt,
  teacherScores,
  readOnly,
  onAdopted,
}: Props) {
  const panelDomId = useId();
  const panelTopId = `${panelDomId}-top`;

  const [candidate, setCandidate] =
    useState<AiEvaluationCandidateReadModel | null>(null);
  const [actorRole, setActorRole] = useState<"teacher" | "admin">("teacher");
  const [canAck, setCanAck] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  /** async Server Action 用。startTransition(async) だと pending が張り付くことがある */
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const pending = busy;

  const [selectedKeys, setSelectedKeys] = useState<Set<AssessmentRubricKey>>(
    () => new Set(),
  );
  const [editedScores, setEditedScores] = useState<
    Partial<Record<AssessmentRubricKey, number | null>>
  >({});
  const [selectedBlocks, setSelectedBlocks] = useState<
    Set<"strengths" | "next_questions" | "gaps_or_alternatives">
  >(() => new Set());
  const [editedComments, setEditedComments] = useState<{
    strengths: string;
    next_questions: string;
    gaps_or_alternatives: string;
  }>({ strengths: "", next_questions: "", gaps_or_alternatives: "" });

  const loadCandidate = useCallback(async () => {
    if (!submissionId) {
      setCandidate(null);
      return;
    }
    setLoadError(null);
    const res = await getAiEvaluationCandidateForSubmissionAction({
      submissionId,
    });
    if (!res.ok) {
      setLoadError(res.message);
      setCandidate(null);
      return;
    }
    setActorRole(res.actorRole);
    setCanAck(res.canAcknowledgeWarnings);
    setCandidate(res.candidate);
    if (res.candidate) {
      const scores: Partial<Record<AssessmentRubricKey, number | null>> = {};
      for (const item of res.candidate.items) {
        scores[item.rubricKey] = item.score;
      }
      setEditedScores(scores);
      setEditedComments({
        strengths: feedbackBlockToReviewComment(
          "strengths",
          res.candidate.feedbackDraft,
        ),
        next_questions: feedbackBlockToReviewComment(
          "next_questions",
          res.candidate.feedbackDraft,
        ),
        gaps_or_alternatives: feedbackBlockToReviewComment(
          "gaps_or_alternatives",
          res.candidate.feedbackDraft,
        ),
      });
    }
  }, [submissionId]);

  const reload = useCallback(() => {
    setBusy(true);
    void loadCandidate().finally(() => setBusy(false));
  }, [loadCandidate]);

  useEffect(() => {
    reload();
  }, [reload]);

  const itemsWithTeacher = useMemo(() => {
    if (!candidate) return [];
    return candidate.items.map((item) => ({
      ...item,
      teacherScore:
        typeof teacherScores[item.rubricKey] === "number"
          ? (teacherScores[item.rubricKey] as number)
          : item.teacherScore,
    }));
  }, [candidate, teacherScores]);

  const onAck = (w: AiCandidateWarningView) => {
    if (!candidate) return;
    setBusy(true);
    void (async () => {
      try {
        setActionError(null);
        setActionOk(null);
        const res = await acknowledgeAiEvaluationWarningAction({
          stagingId: candidate.stagingId,
          warningFamily: w.family,
          warningCode: w.code,
          warningPayloadHash: w.payloadHash,
        });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
        setActionOk("警告を確認しました。");
        await loadCandidate();
      } finally {
        setBusy(false);
      }
    })();
  };

  const onAckAll = (family: "version" | "pii") => {
    if (!candidate) return;
    const list =
      family === "version" ? candidate.versionWarnings : candidate.piiWarnings;
    const unacked = list.filter((w) => !w.acknowledged);
    if (unacked.length === 0) return;
    setBusy(true);
    void (async () => {
      try {
        setActionError(null);
        setActionOk(null);
        const res = await acknowledgeAllAiEvaluationWarningsAction({
          stagingId: candidate.stagingId,
          warnings: unacked.map((w) => ({
            warningFamily: w.family,
            warningCode: w.code,
            warningPayloadHash: w.payloadHash,
          })),
        });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
        setActionOk(`${res.acknowledgedCount}件の警告を確認しました。`);
        await loadCandidate();
      } finally {
        setBusy(false);
      }
    })();
  };

  const onAdopt = () => {
    if (!candidate || !submissionId) return;
    setBusy(true);
    void (async () => {
      try {
        setActionError(null);
        setActionOk(null);
        const res = await adoptAiEvaluationCandidateAction({
          stagingId: candidate.stagingId,
          milestoneId,
          studentId,
          submissionId,
          reviewId,
          baseUpdatedAt: reviewUpdatedAt,
          adoptedRubricKeys: [...selectedKeys],
          adoptedCommentBlocks: [...selectedBlocks],
          appliedRubricScores: editedScores,
          appliedComments: editedComments,
        });
        if (!res.ok) {
          setActionError(res.message);
          return;
        }
        setActionOk(
          `一部採用しました（履歴 #${res.adoptionSequence}）。AIの原文はこの候補に保持されます。`,
        );
        setSelectedKeys(new Set());
        setSelectedBlocks(new Set());
        startTransition(() => {
          onAdopted({
            reviewId: res.reviewId,
            reviewUpdatedAt: res.reviewUpdatedAt,
          });
        });
        await loadCandidate();
      } finally {
        setBusy(false);
      }
    })();
  };

  const scrollToPanelTop = () => {
    const el = document.getElementById(panelTopId);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!submissionId) {
    return (
      <section className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
        <h3 className="text-sm font-semibold text-slate-800">AI評価候補</h3>
        <p className="mt-1 text-xs text-slate-500">
          評価対象の提出がありません。
        </p>
      </section>
    );
  }

  const warningCount =
    (candidate?.versionWarnings.length ?? 0) +
    (candidate?.piiWarnings.length ?? 0);
  const unackedCount = candidate?.unackedWarningCount ?? 0;
  const hasUncertaintyOrFollowUp = Boolean(
    candidate?.uncertainty || (candidate?.followUpChecks.length ?? 0) > 0,
  );

  return (
    <section
      id={panelTopId}
      className="mb-5 scroll-mt-2 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">AI評価候補</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
            参考情報です。自動採用されません。教員が選択した項目だけ下書きへ反映できます。
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 shrink-0 px-1 text-xs text-indigo-800 underline"
          disabled={pending}
          onClick={reload}
        >
          再読込
        </button>
      </div>

      {loadError ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {loadError}
        </p>
      ) : null}
      {actionError ? (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {actionError}
        </p>
      ) : null}
      {actionOk ? (
        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
          {actionOk}
        </p>
      ) : null}

      {!candidate ? (
        <p className="mt-2 text-xs text-slate-600">
          確認中の AI 評価候補はありません。取込後にここに表示されます。
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {/* 優先サマリー（状態） */}
          <dl className="grid gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="inline text-slate-500">状態：</dt>
              <dd className="inline font-medium text-slate-900">
                {aiReviewStatusLabel(candidate.reviewStatus)}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">検証結果：</dt>
              <dd className="inline font-medium text-slate-900">
                {aiValidationStatusLabel(candidate.validationStatus)}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">採用履歴：</dt>
              <dd className="inline">{candidate.adoptionCount} 回</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">操作：</dt>
              <dd className="inline">
                {actorRole === "teacher"
                  ? "教員（採用可）"
                  : "管理者（閲覧のみ）"}
              </dd>
            </div>
          </dl>

          {candidate.adoptBlockedReasons.length > 0 ? (
            <ul className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
              {candidate.adoptBlockedReasons.map((r) => (
                <li key={r}>・{r}</li>
              ))}
            </ul>
          ) : null}

          {/* 警告 */}
          <TeacherAiEvaluationSection
            id={`${panelDomId}-warnings`}
            title="警告"
            defaultOpen
            badge={
              warningCount === 0
                ? "なし"
                : unackedCount > 0
                  ? `未確認 ${unackedCount}`
                  : `確認済 ${warningCount}`
            }
          >
            {warningCount === 0 ? (
              <p className="text-xs text-slate-500">警告はありません。</p>
            ) : (
              <div className="space-y-3">
                <TeacherAiEvaluationWarningList
                  family="version"
                  warnings={candidate.versionWarnings}
                  canAcknowledge={canAck && !readOnly}
                  pending={pending}
                  onAcknowledge={onAck}
                  onAcknowledgeAll={() => onAckAll("version")}
                  compactEmpty
                />
                <TeacherAiEvaluationWarningList
                  family="pii"
                  warnings={candidate.piiWarnings}
                  canAcknowledge={canAck && !readOnly}
                  pending={pending}
                  onAcknowledge={onAck}
                  onAcknowledgeAll={() => onAckAll("pii")}
                  compactEmpty
                />
              </div>
            )}
          </TeacherAiEvaluationSection>

          {/* 不確実性・追加確認事項 */}
          <TeacherAiEvaluationSection
            id={`${panelDomId}-uncertainty`}
            title="不確実性・追加確認事項"
            defaultOpen={false}
            badge={hasUncertaintyOrFollowUp ? null : "なし"}
          >
            {!hasUncertaintyOrFollowUp ? (
              <p className="text-xs text-slate-500">該当する情報はありません。</p>
            ) : (
              <div className="space-y-3 text-xs text-slate-700">
                {candidate.uncertainty ? (
                  <div>
                    <p className="font-medium text-slate-800">不確実性</p>
                    <p className="mt-1">
                      信頼度: {candidate.uncertainty.overallConfidence ?? "—"}
                    </p>
                    {candidate.uncertainty.notes ? (
                      <p className="mt-1 whitespace-pre-wrap break-words">
                        {candidate.uncertainty.notes}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {candidate.followUpChecks.length > 0 ? (
                  <div>
                    <p className="font-medium text-slate-800">追加確認事項</p>
                    <ul className="mt-1 space-y-1.5">
                      {candidate.followUpChecks.map((f, i) => (
                        <li key={i}>
                          <p className="font-medium break-words">{f.question}</p>
                          {f.reason ? (
                            <p className="break-words text-slate-500">
                              {f.reason}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </TeacherAiEvaluationSection>

          {/* ルーブリック評価候補 */}
          <TeacherAiEvaluationSection
            id={`${panelDomId}-rubric`}
            title="ルーブリック評価候補"
            defaultOpen
            badge={`${itemsWithTeacher.length}項目`}
          >
            <div className="space-y-2">
              {itemsWithTeacher.map((item) => (
                <TeacherAiEvaluationItemCard
                  key={item.rubricKey}
                  item={item}
                  selected={selectedKeys.has(item.rubricKey)}
                  canSelect={
                    !readOnly && actorRole === "teacher" && candidate.canAdopt
                  }
                  editedScore={editedScores[item.rubricKey] ?? null}
                  onToggle={(on) => {
                    setSelectedKeys((prev) => {
                      const next = new Set(prev);
                      if (on) next.add(item.rubricKey);
                      else next.delete(item.rubricKey);
                      return next;
                    });
                  }}
                  onScoreChange={(score) => {
                    setEditedScores((prev) => ({
                      ...prev,
                      [item.rubricKey]: score,
                    }));
                  }}
                />
              ))}
            </div>
          </TeacherAiEvaluationSection>

          {/* 学生コメント案 */}
          <TeacherAiEvaluationSection
            id={`${panelDomId}-comments`}
            title="学生コメント案"
            defaultOpen={false}
          >
            <p className="text-[11px] leading-snug text-slate-500">
              「各項目で考えられている点」「患者理解を深めるために考えてほしいこと」「まだ十分関連づけられていない点」のみ下書きへ反映できます。総合コメントは自動反映しません。「現時点で読み取れる患者像」は表示のみです。
            </p>
            {(
              [
                ["strengths", editedComments.strengths],
                ["next_questions", editedComments.next_questions],
                ["gaps_or_alternatives", editedComments.gaps_or_alternatives],
              ] as const
            ).map(([key, value]) => (
              <div key={key} className="mt-2.5">
                <label className="flex min-h-11 items-center gap-2.5 font-medium text-slate-800">
                  <span className="flex min-h-11 min-w-11 items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-slate-800"
                      checked={selectedBlocks.has(key)}
                      disabled={
                        readOnly ||
                        actorRole !== "teacher" ||
                        !candidate.canAdopt
                      }
                      onChange={(e) => {
                        setSelectedBlocks((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(key);
                          else next.delete(key);
                          return next;
                        });
                      }}
                    />
                  </span>
                  {AI_FEEDBACK_BLOCK_LABELS[key]}
                </label>
                <textarea
                  className="mt-1 min-h-16 w-full break-words rounded border border-slate-300 px-2 py-1.5 text-xs leading-relaxed disabled:bg-slate-50"
                  value={value}
                  disabled={
                    readOnly ||
                    actorRole !== "teacher" ||
                    !selectedBlocks.has(key)
                  }
                  onChange={(e) =>
                    setEditedComments((prev) => ({
                      ...prev,
                      [key]: e.target.value,
                    }))
                  }
                />
              </div>
            ))}
            {candidate.feedbackDraft.supportingInformation.length > 0 ? (
              <div className="mt-2.5 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                <p className="font-medium text-slate-700">
                  {AI_FEEDBACK_BLOCK_LABELS.supporting_information}
                  <span className="ml-1 font-normal text-slate-500">
                    （表示のみ・採用対象外）
                  </span>
                </p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {candidate.feedbackDraft.supportingInformation.map((s, i) => (
                    <li key={i} className="break-words">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </TeacherAiEvaluationSection>

          {/* 教員専用所見 */}
          {candidate.teacherObservation ? (
            <TeacherAiEvaluationSection
              id={`${panelDomId}-observation`}
              title="教員専用所見"
              defaultOpen={false}
              badge="学生非表示・採用対象外"
            >
              <div className="space-y-2 text-xs text-violet-950">
                <p className="rounded border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] leading-snug">
                  学生には表示されません。下書きへの採用対象外です（自動反映しません）。
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {candidate.teacherObservation.summary}
                </p>
                {candidate.teacherObservation.attentionPoints.length > 0 ? (
                  <ul className="list-disc space-y-0.5 pl-4">
                    {candidate.teacherObservation.attentionPoints.map(
                      (a, i) => (
                        <li key={i} className="break-words">
                          {a}
                        </li>
                      ),
                    )}
                  </ul>
                ) : null}
                {candidate.teacherObservation.suggestedFocusForFeedback ? (
                  <p className="break-words text-violet-800">
                    フィードバックの焦点案:{" "}
                    {candidate.teacherObservation.suggestedFocusForFeedback}
                  </p>
                ) : null}
              </div>
            </TeacherAiEvaluationSection>
          ) : null}

          {/* 技術情報 */}
          <TeacherAiEvaluationSection
            id={`${panelDomId}-tech`}
            title="技術情報"
            defaultOpen={false}
          >
            <dl className="grid gap-1.5 text-[11px] text-slate-600 sm:grid-cols-2">
              <div className="break-all">
                <dt className="inline text-slate-500">model / provider：</dt>
                <dd className="inline">
                  {candidate.sourceModel ?? "—"} /{" "}
                  {candidate.sourceProvider ?? "—"}
                </dd>
              </div>
              <div className="break-all">
                <dt className="inline text-slate-500">prompt：</dt>
                <dd className="inline">{candidate.promptVersion ?? "—"}</dd>
              </div>
              <div className="sm:col-span-2 break-all">
                <dt className="inline text-slate-500">versions：</dt>
                <dd className="inline">
                  policy {candidate.versions.compassPolicyVersion} / rubric{" "}
                  {candidate.versions.rubricVersion} / gold{" "}
                  {candidate.versions.goldStandardVersion} / case{" "}
                  {candidate.versions.caseVersion}
                </dd>
              </div>
              <div className="sm:col-span-2 break-all">
                <dt className="inline text-slate-500">schema：</dt>
                <dd className="inline">
                  package {candidate.versions.packageSchemaVersion} / result{" "}
                  {candidate.versions.resultSchemaVersion} / export{" "}
                  {candidate.versions.exportSchemaVersion}
                </dd>
              </div>
              <div className="sm:col-span-2 break-all font-mono text-[10px]">
                <dt className="inline font-sans text-slate-500">result hash：</dt>
                <dd className="inline">{candidate.resultHash}</dd>
              </div>
              <div className="break-all font-mono text-[10px]">
                <dt className="inline font-sans text-slate-500">staging id：</dt>
                <dd className="inline">{candidate.stagingId}</dd>
              </div>
              <div className="break-all font-mono text-[10px]">
                <dt className="inline font-sans text-slate-500">request id：</dt>
                <dd className="inline">{candidate.requestId}</dd>
              </div>
            </dl>
            {candidate.history.length > 0 ? (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="text-[11px] font-medium text-slate-600">
                  候補履歴
                </p>
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-500">
                  {candidate.history.map((h) => (
                    <li key={h.id} className="break-all">
                      {aiReviewStatusLabel(h.reviewStatus)} /{" "}
                      {aiValidationStatusLabel(h.validationStatus)} /{" "}
                      {h.importedAt.slice(0, 19)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </TeacherAiEvaluationSection>

          {/* 採用アクション（親の固定フッターと重ねないため sticky にしない） */}
          <div className="space-y-2 border-t border-indigo-100 pt-2.5 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="min-h-11 rounded-lg bg-indigo-800 px-3 text-sm font-medium text-white disabled:opacity-50"
                disabled={
                  pending ||
                  readOnly ||
                  actorRole !== "teacher" ||
                  !candidate.canAdopt ||
                  (selectedKeys.size === 0 && selectedBlocks.size === 0)
                }
                onClick={onAdopt}
              >
                選択項目を下書きへ反映
              </button>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700"
                onClick={scrollToPanelTop}
              >
                上へ戻る
              </button>
            </div>
            <p className="text-[11px] leading-snug text-slate-500">
              総合コメント・教員専用所見は反映しません。確認完了（採用確定）は次のSprintです。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
