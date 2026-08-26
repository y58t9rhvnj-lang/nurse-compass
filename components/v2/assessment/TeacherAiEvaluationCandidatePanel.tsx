"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
import type { AssessmentRubricKey } from "@/lib/v2/assessment/assessmentRubric";
import TeacherAiEvaluationItemCard from "./TeacherAiEvaluationItemCard";
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
  const [candidate, setCandidate] =
    useState<AiEvaluationCandidateReadModel | null>(null);
  const [actorRole, setActorRole] = useState<"teacher" | "admin">("teacher");
  const [canAck, setCanAck] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  const reload = useCallback(() => {
    if (!submissionId) {
      setCandidate(null);
      return;
    }
    startTransition(async () => {
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
    });
  }, [submissionId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // 教員スコアが親から変わったら表示比較を更新（candidate 再構築は reload）
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
    startTransition(async () => {
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
      reload();
    });
  };

  const onAckAll = (family: "version" | "pii") => {
    if (!candidate) return;
    const list =
      family === "version" ? candidate.versionWarnings : candidate.piiWarnings;
    const unacked = list.filter((w) => !w.acknowledged);
    if (unacked.length === 0) return;
    startTransition(async () => {
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
      reload();
    });
  };

  const onAdopt = () => {
    if (!candidate || !submissionId) return;
    startTransition(async () => {
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
        `一部採用しました（履歴 #${res.adoptionSequence}）。AI原文は staging に保持されます。`,
      );
      setSelectedKeys(new Set());
      setSelectedBlocks(new Set());
      onAdopted({
        reviewId: res.reviewId,
        reviewUpdatedAt: res.reviewUpdatedAt,
      });
      reload();
    });
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

  return (
    <section className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/40 px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">AI評価候補</h3>
          <p className="mt-0.5 text-[11px] text-slate-600">
            参考情報です。自動採用されません。教員が選択した項目だけ下書きへ反映できます。
          </p>
        </div>
        <button
          type="button"
          className="min-h-9 text-xs text-indigo-800 underline"
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
        <div className="mt-3 space-y-3">
          <dl className="grid gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="inline text-slate-500">staging：</dt>
              <dd className="inline font-medium">{candidate.reviewStatus}</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">validation：</dt>
              <dd className="inline font-medium">
                {candidate.validationStatus}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">model：</dt>
              <dd className="inline">
                {candidate.sourceModel ?? "—"} /{" "}
                {candidate.sourceProvider ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">prompt：</dt>
              <dd className="inline">{candidate.promptVersion ?? "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline text-slate-500">versions：</dt>
              <dd className="inline">
                policy {candidate.versions.compassPolicyVersion} / rubric{" "}
                {candidate.versions.rubricVersion} / gold{" "}
                {candidate.versions.goldStandardVersion}
              </dd>
            </div>
            <div>
              <dt className="inline text-slate-500">採用履歴：</dt>
              <dd className="inline">{candidate.adoptionCount} 回</dd>
            </div>
            <div>
              <dt className="inline text-slate-500">権限：</dt>
              <dd className="inline">
                {actorRole === "teacher" ? "教員（採用可）" : "管理者（閲覧のみ）"}
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

          <TeacherAiEvaluationWarningList
            title="Version 警告"
            warnings={candidate.versionWarnings}
            canAcknowledge={canAck && !readOnly}
            pending={pending}
            onAcknowledge={onAck}
            onAcknowledgeAll={() => onAckAll("version")}
          />
          <TeacherAiEvaluationWarningList
            title="PII 警告"
            warnings={candidate.piiWarnings}
            canAcknowledge={canAck && !readOnly}
            pending={pending}
            onAcknowledge={onAck}
            onAcknowledgeAll={() => onAckAll("pii")}
          />

          {candidate.uncertainty ? (
            <section className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <h4 className="font-semibold text-slate-800">不確実性</h4>
              <p className="mt-1">
                信頼度: {candidate.uncertainty.overallConfidence ?? "—"}
              </p>
              {candidate.uncertainty.notes ? (
                <p className="mt-1 whitespace-pre-wrap">
                  {candidate.uncertainty.notes}
                </p>
              ) : null}
            </section>
          ) : null}

          {candidate.followUpChecks.length > 0 ? (
            <section className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <h4 className="font-semibold text-slate-800">追加確認事項</h4>
              <ul className="mt-1 space-y-1">
                {candidate.followUpChecks.map((f, i) => (
                  <li key={i}>
                    <p className="font-medium">{f.question}</p>
                    {f.reason ? (
                      <p className="text-slate-500">{f.reason}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-800">
              ルーブリック項目（候補）
            </h4>
            {itemsWithTeacher.map((item) => (
              <TeacherAiEvaluationItemCard
                key={item.rubricKey}
                item={item}
                selected={selectedKeys.has(item.rubricKey)}
                canSelect={
                  !readOnly &&
                  actorRole === "teacher" &&
                  candidate.canAdopt
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

          <section className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            <h4 className="font-semibold text-slate-800">
              学生コメント案（4ブロック）
            </h4>
            <p className="mt-0.5 text-[11px] text-slate-500">
              strengths / next_questions / gaps_or_alternatives
              のみ下書きへ反映できます。overall_comment
              は自動投入しません。supporting_information は表示のみです。
            </p>
            {(
              [
                ["strengths", "良かった点（strengths）", editedComments.strengths],
                [
                  "next_questions",
                  "次に考えてほしいこと（next_questions）",
                  editedComments.next_questions,
                ],
                [
                  "gaps_or_alternatives",
                  "不足・別の可能性（gaps_or_alternatives）",
                  editedComments.gaps_or_alternatives,
                ],
              ] as const
            ).map(([key, label, value]) => (
              <div key={key} className="mt-2">
                <label className="flex items-center gap-2 font-medium text-slate-800">
                  <input
                    type="checkbox"
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
                  {label}
                </label>
                <textarea
                  className="mt-1 min-h-16 w-full rounded border border-slate-300 px-2 py-1.5 text-xs disabled:bg-slate-50"
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
              <div className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
                <p className="font-medium">supporting_information（表示のみ）</p>
                <ul className="mt-1 list-disc pl-4">
                  {candidate.feedbackDraft.supportingInformation.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {candidate.teacherObservation ? (
            <section className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-xs text-violet-950">
              <h4 className="font-semibold">
                teacher_observation（教員専用・返却欄へ自動投入しません）
              </h4>
              <p className="mt-1 whitespace-pre-wrap">
                {candidate.teacherObservation.summary}
              </p>
              {candidate.teacherObservation.attentionPoints.length > 0 ? (
                <ul className="mt-1 list-disc pl-4">
                  {candidate.teacherObservation.attentionPoints.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              ) : null}
              {candidate.teacherObservation.suggestedFocusForFeedback ? (
                <p className="mt-1 text-violet-800">
                  焦点案:{" "}
                  {candidate.teacherObservation.suggestedFocusForFeedback}
                </p>
              ) : null}
            </section>
          ) : null}

          {candidate.history.length > 1 ? (
            <details className="text-[11px] text-slate-600">
              <summary className="cursor-pointer font-medium">
                候補履歴（adopted / rejected / superseded 等）
              </summary>
              <ul className="mt-1 space-y-0.5">
                {candidate.history.map((h) => (
                  <li key={h.id}>
                    {h.reviewStatus} / {h.validationStatus} /{" "}
                    {h.importedAt.slice(0, 19)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
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
            <p className="text-[11px] text-slate-500">
              overall_comment / teacher_observation / private_note
              は反映しません。確認完了（adopted）は次 Sprint です。
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
