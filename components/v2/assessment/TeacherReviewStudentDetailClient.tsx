"use client";

import { useCallback, useEffect, useMemo, useState, useTransition, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getTeacherStudentSubmissionDetailAction,
  listTeacherStudentSubmissionRowsAction,
} from "@/app/v2/actions/assessmentReviews";
import type {
  TeacherReviewMilestoneSummary,
  TeacherStudentProfile,
  TeacherSubmissionHistoryItem,
} from "@/lib/v2/assessment/teacherReviewRepository";
import type { SnapshotReadModel } from "@/lib/v2/assessment/snapshotReadModel";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  evaluationTypeLabel,
  formatSubmissionScopeJa,
} from "@/lib/v2/assessment/submissionScope";
import {
  reviewDisplayStatusLabel,
  studentIdLabel,
} from "@/lib/v2/assessment/teacherReviewLabels";
import {
  loadTeacherReviewOrder,
} from "@/lib/v2/assessment/teacherReviewOrderStorage";
import {
  buildTeacherTimingDisplayLines,
  formatTeacherTimingDisplayText,
} from "@/lib/v2/assessment/teacherReviewTimingDisplay";
import { TeacherTimingDisplayBlock } from "@/components/v2/assessment/TeacherTimingDisplayBlock";
import LateSubmissionReviewActions from "@/components/v2/assessment/LateSubmissionReviewActions";
import TeacherAssessmentReviewPanel from "@/components/v2/assessment/TeacherAssessmentReviewPanel";
import TeacherAiExportDialog from "@/components/v2/assessment/TeacherAiExportDialog";
import TeacherAiEvaluationImportDialog from "@/components/v2/assessment/TeacherAiEvaluationImportDialog";
import {
  SnapshotEvidenceLinksReadonly,
  SnapshotFieldReflectionsReadonly,
  SnapshotForm2Readonly,
  SnapshotForm3Readonly,
  SnapshotInformationCardsReadonly,
  SnapshotOverviewPanel,
  SnapshotPatientUnderstandingReadonly,
  SnapshotUnsupportedMessage,
} from "@/components/v2/assessment/SnapshotReadonlyPanels";

type HistoryMeta = Omit<TeacherSubmissionHistoryItem, "snapshot">;

type TabKey =
  | "overview"
  | "form2"
  | "form3"
  | "cards"
  | "evidence"
  | "reflections"
  | "understanding"
  | "history";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "概要" },
  { key: "form2", label: "様式2" },
  { key: "form3", label: "様式3" },
  { key: "cards", label: "情報カード" },
  { key: "evidence", label: "Evidenceリンク" },
  { key: "reflections", label: "フィールド振り返り" },
  { key: "understanding", label: "患者理解" },
  { key: "history", label: "提出履歴" },
];

type Props = {
  milestoneId: string;
  studentId: string;
  initial: {
    milestone: TeacherReviewMilestoneSummary;
    student: TeacherStudentProfile;
    history: HistoryMeta[];
    candidateSubmissionId: string | null;
    viewingSubmissionId: string | null;
    isViewingCandidate: boolean;
    readModel: SnapshotReadModel | null;
  };
};

function sourceVersionsLabel(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "—";
  const o = raw as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.form2 === "number") parts.push(`様式2 v${o.form2}`);
  if (typeof o.form3 === "number") parts.push(`様式3 v${o.form3}`);
  if (typeof o.patientUnderstanding === "string") {
    parts.push("患者理解あり");
  }
  return parts.length > 0 ? parts.join("・") : "—";
}

export default function TeacherReviewStudentDetailClient({
  milestoneId,
  studentId: initialStudentId,
  initial,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listHref = `/v2/teacher/reviews/${milestoneId}`;

  const [studentId, setStudentId] = useState(initialStudentId);
  const [tab, setTab] = useState<TabKey>("overview");
  const [milestone, setMilestone] = useState(initial.milestone);
  const [student, setStudent] = useState(initial.student);
  const [history, setHistory] = useState(initial.history);
  const [candidateSubmissionId, setCandidateSubmissionId] = useState(
    initial.candidateSubmissionId,
  );
  const [viewingSubmissionId, setViewingSubmissionId] = useState(
    initial.viewingSubmissionId,
  );
  const [isViewingCandidate, setIsViewingCandidate] = useState(
    initial.isViewingCandidate,
  );
  const [readModel, setReadModel] = useState(initial.readModel);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [reviewOpen, setReviewOpen] = useState(
    () => searchParams.get("review") === "open",
  );
  const [studentIdsOrdered, setStudentIdsOrdered] = useState<string[]>([
    initialStudentId,
  ]);
  const [reviewDirty, setReviewDirty] = useState(false);
  const [listNavRequestId, setListNavRequestId] = useState(0);
  const [candidateChangeNotice, setCandidateChangeNotice] = useState<
    string | null
  >(null);

  const viewing = history.find((h) => h.id === viewingSubmissionId) ?? null;
  const candidate = history.find((h) => h.id === candidateSubmissionId) ?? null;

  const candidateInfo = useMemo(
    () =>
      candidate
        ? {
            submissionId: candidate.id,
            submissionNumber: candidate.submissionNumber,
            submittedAt: candidate.submittedAt,
            timingStatus: candidate.timingStatus,
            deadlineAtAtSubmit: candidate.deadlineAtAtSubmit,
          }
        : null,
    [
      candidate?.id,
      candidate?.submissionNumber,
      candidate?.submittedAt,
      candidate?.timingStatus,
      candidate?.deadlineAtAtSubmit,
    ],
  );

  // sessionStorage 順序（失敗時は一覧再取得で名前順）
  useEffect(() => {
    const fromStorage = loadTeacherReviewOrder(milestoneId, studentId);
    if (fromStorage) {
      setStudentIdsOrdered(fromStorage);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await listTeacherStudentSubmissionRowsAction(milestoneId);
      if (cancelled || !res.ok) {
        setStudentIdsOrdered([studentId]);
        return;
      }
      const ids = [...res.rows]
        .sort((a, b) =>
          a.student.displayName.localeCompare(b.student.displayName, "ja"),
        )
        .map((r) => r.student.id);
      setStudentIdsOrdered(ids.includes(studentId) ? ids : [studentId, ...ids]);
    })();
    return () => {
      cancelled = true;
    };
  }, [milestoneId, studentId]);

  // URL の review=open と同期
  useEffect(() => {
    const wantOpen = searchParams.get("review") === "open";
    setReviewOpen(wantOpen);
  }, [searchParams]);

  // サーバーから渡された studentId が変わった場合（直接 URL 移動）
  useEffect(() => {
    if (initialStudentId === studentId) return;
    setStudentId(initialStudentId);
    setMilestone(initial.milestone);
    setStudent(initial.student);
    setHistory(initial.history);
    setCandidateSubmissionId(initial.candidateSubmissionId);
    setViewingSubmissionId(initial.viewingSubmissionId);
    setIsViewingCandidate(initial.isViewingCandidate);
    setReadModel(initial.readModel);
    setTab("overview");
  }, [initialStudentId, initial, studentId]);

  const syncReviewOpenQuery = useCallback(
    (open: boolean, targetStudentId: string, mode: "push" | "replace") => {
      const path = `/v2/teacher/reviews/${milestoneId}/${targetStudentId}`;
      const url = open ? `${path}?review=open` : path;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [milestoneId, router],
  );

  const applyDetail = useCallback(
    (res: Extract<
      Awaited<ReturnType<typeof getTeacherStudentSubmissionDetailAction>>,
      { ok: true }
    >) => {
      setMilestone(res.milestone);
      setStudent(res.student);
      setHistory(res.history);
      setCandidateSubmissionId(res.candidateSubmissionId);
      setViewingSubmissionId(res.viewingSubmissionId);
      setIsViewingCandidate(res.isViewingCandidate);
      setReadModel(res.readModel);
      setTab("overview");
      setError(null);
    },
    [],
  );

  const loadStudentDetail = useCallback(
    (nextStudentId: string) => {
      startTransition(async () => {
        setError(null);
        const res = await getTeacherStudentSubmissionDetailAction({
          milestoneId,
          studentId: nextStudentId,
        });
        if (!res.ok) {
          setError("学生データを読み込めませんでした。");
          return;
        }
        setStudentId(nextStudentId);
        applyDetail(res);
      });
    },
    [applyDetail, milestoneId],
  );

  const loadSubmission = useCallback(
    (submissionId: string) => {
      startTransition(async () => {
        setError(null);
        const res = await getTeacherStudentSubmissionDetailAction({
          milestoneId,
          studentId,
          submissionId,
        });
        if (!res.ok) {
          setError("提出データを読み込めませんでした。");
          return;
        }
        applyDetail(res);
      });
    },
    [applyDetail, milestoneId, studentId],
  );

  const onOpenChange = (open: boolean) => {
    setReviewOpen(open);
    syncReviewOpenQuery(open, studentId, "replace");
  };

  const onNavigateStudent = (nextId: string) => {
    syncReviewOpenQuery(true, nextId, "replace");
    loadStudentDetail(nextId);
  };

  const onNavigateList = () => {
    router.push(listHref);
  };

  const reloadCurrentStudent = useCallback(() => {
    startTransition(async () => {
      setError(null);
      const res = await getTeacherStudentSubmissionDetailAction({
        milestoneId,
        studentId,
        submissionId: viewingSubmissionId,
      });
      if (!res.ok) {
        setError("学生データを読み込めませんでした。");
        return;
      }
      applyDetail(res);
    });
  }, [applyDetail, milestoneId, studentId, viewingSubmissionId]);

  const onLateReviewDone = useCallback(
    (result: {
      candidateChanged: boolean;
      previousCandidateSubmissionId: string | null;
      newCandidateSubmissionId: string | null;
      submissionNumber: number;
      decision: "approved" | "rejected";
    }) => {
      if (result.decision === "approved" && result.candidateChanged) {
        const prev = history.find(
          (h) => h.id === result.previousCandidateSubmissionId,
        );
        const prevLabel = prev
          ? `第${prev.submissionNumber}回提出`
          : "以前の評価対象";
        setCandidateChangeNotice(
          `期限後提出の承認により、評価対象が第${result.submissionNumber}回提出へ変更されました。\n${prevLabel}の評価は履歴として保持されています。`,
        );
      } else {
        setCandidateChangeNotice(null);
      }
      reloadCurrentStudent();
    },
    [history, reloadCurrentStudent],
  );

  const onListLinkClick = (e: MouseEvent) => {
    if (!reviewDirty) return;
    e.preventDefault();
    if (!reviewOpen) {
      setReviewOpen(true);
      syncReviewOpenQuery(true, studentId, "replace");
    }
    setListNavRequestId((n) => n + 1);
  };

  const candidateTimingText = candidate
    ? formatTeacherTimingDisplayText(
        buildTeacherTimingDisplayLines({
          timingStatus: candidate.timingStatus,
          submittedAt: candidate.submittedAt,
          currentDeadlineAt: milestone.deadlineAt,
          deadlineAtAtSubmit: candidate.deadlineAtAtSubmit,
        }),
      )
    : "—";

  const viewingTimingText = viewing
    ? formatTeacherTimingDisplayText(
        buildTeacherTimingDisplayLines({
          timingStatus: viewing.timingStatus,
          submittedAt: viewing.submittedAt,
          currentDeadlineAt: milestone.deadlineAt,
          deadlineAtAtSubmit: viewing.deadlineAtAtSubmit,
        }),
      )
    : "—";

  const headerMeta: Array<{
    label: string;
    value: string;
    preLine?: boolean;
  }> = [
    { label: "学籍番号 / ID", value: studentIdLabel(student) },
    { label: "講義・課題グループ", value: milestone.cycleTitle },
    { label: "課題名", value: milestone.title },
    {
      label: "評価種別",
      value: evaluationTypeLabel(milestone.evaluationType),
    },
    {
      label: "提出回数",
      value: String(history.length),
    },
    {
      label: "評価対象提出日時",
      value: candidate
        ? formatAssessmentDateTimeJa(candidate.submittedAt)
        : "評価対象なし",
    },
    {
      label: "提出時判定 / 現在期限との関係（評価対象）",
      value: candidateTimingText,
      preLine: true,
    },
    {
      label: "評価対象の提出ID",
      value: candidateSubmissionId ?? "—",
    },
    {
      label: "提出範囲",
      value: formatSubmissionScopeJa(
        milestone.milestoneType,
        milestone.submissionScope,
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={listHref}
          onClick={onListLinkClick}
          className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:underline"
        >
          ← 学生提出一覧
        </Link>
      </div>

      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">
          {student.displayName}
        </h1>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {headerMeta.map((m) => (
            <div key={m.label}>
              <dt className="text-xs text-slate-500">{m.label}</dt>
              <dd
                className={`text-sm text-slate-900 break-all ${
                  "preLine" in m && m.preLine ? "whitespace-pre-line" : ""
                }`}
              >
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {candidateSubmissionId ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-900">
              評価対象提出あり
              {candidate ? `（第${candidate.submissionNumber}回）` : ""}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
              評価対象なし
            </span>
          )}
          {viewing ? (
            <span
              className={`rounded-full px-3 py-1 font-medium ${
                isViewingCandidate
                  ? "bg-sky-100 text-sky-900"
                  : "bg-amber-100 text-amber-950"
              }`}
            >
              閲覧中：第{viewing.submissionNumber}回
              {isViewingCandidate ? "（評価対象）" : "（履歴）"}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
              提出なし
            </span>
          )}
        </div>
        {viewingSubmissionId ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <TeacherAiExportDialog
              mode={{
                kind: "submission",
                milestoneId,
                studentId,
                submissionId: viewingSubmissionId,
              }}
              buttonLabel="この提出をAI解析用エクスポート"
            />
            <TeacherAiEvaluationImportDialog buttonLabel="AI評価結果を取込" />
          </div>
        ) : null}
      </header>

      {candidateChangeNotice ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm whitespace-pre-line text-amber-950">
          {candidateChangeNotice}
        </div>
      ) : null}

      <div className="space-y-4">
        <TeacherAssessmentReviewPanel
          milestoneId={milestoneId}
          milestoneTitle={milestone.title}
          milestoneDeadlineAt={milestone.deadlineAt}
          studentId={studentId}
          studentDisplayName={student.displayName}
          candidate={candidateInfo}
          viewingSubmissionId={viewingSubmissionId}
          open={reviewOpen}
          onOpenChange={onOpenChange}
          studentIdsOrdered={studentIdsOrdered}
          onNavigateStudent={onNavigateStudent}
          onNavigateList={onNavigateList}
          onDirtyChange={setReviewDirty}
          listNavRequestId={listNavRequestId}
        />

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${
                  tab === t.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700"
                }`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
              {error}
            </p>
          ) : null}
          {pending ? (
            <p className="text-sm text-slate-500">読み込み中…</p>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            {history.length === 0 ? (
              <p className="text-sm text-slate-600">この学生は未提出です。</p>
            ) : readModel == null ? (
              <p className="text-sm text-slate-600">
                表示できる提出データがありません。
              </p>
            ) : !readModel.ok ? (
              <SnapshotUnsupportedMessage message={readModel.message} />
            ) : (
              <>
                {tab === "overview" ? (
                  <SnapshotOverviewPanel
                    model={readModel}
                    submissionNumber={history.length}
                    candidateSubmissionNumber={
                      candidate?.submissionNumber ?? null
                    }
                    timingDisplayText={viewingTimingText}
                    evaluationType={milestone.evaluationType}
                    milestoneType={milestone.milestoneType}
                    submissionScope={milestone.submissionScope}
                  />
                ) : null}
                {tab === "form2" ? (
                  <SnapshotForm2Readonly data={readModel.form2} />
                ) : null}
                {tab === "form3" ? (
                  <SnapshotForm3Readonly
                    data={readModel.form3}
                    meta={{
                      studentName: student.displayName.trim(),
                      studentNumber: studentIdLabel(student).trim(),
                    }}
                  />
                ) : null}
                {tab === "cards" ? (
                  <SnapshotInformationCardsReadonly
                    items={readModel.informationCards}
                  />
                ) : null}
                {tab === "evidence" ? (
                  <SnapshotEvidenceLinksReadonly
                    items={readModel.form2EvidenceLinks}
                  />
                ) : null}
                {tab === "reflections" ? (
                  <SnapshotFieldReflectionsReadonly
                    items={readModel.fieldReflections}
                  />
                ) : null}
                {tab === "understanding" ? (
                  <SnapshotPatientUnderstandingReadonly
                    value={readModel.patientUnderstanding}
                  />
                ) : null}
                {tab === "history" ? (
                  <ul className="space-y-3">
                    {history.map((item) => {
                      const isCand = item.id === candidateSubmissionId;
                      const isView = item.id === viewingSubmissionId;
                      return (
                        <li
                          key={item.id}
                          className={`rounded-lg border px-3 py-2 ${
                            isView
                              ? "border-sky-400 bg-sky-50"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <button
                            type="button"
                            className="flex min-h-11 w-full flex-col items-start text-left text-sm"
                            onClick={() => loadSubmission(item.id)}
                          >
                            <span className="font-semibold text-slate-900">
                              第{item.submissionNumber}回 ・{" "}
                              {formatAssessmentDateTimeJa(item.submittedAt)}
                            </span>
                            <span className="mt-1 text-slate-600">
                              <TeacherTimingDisplayBlock
                                timingStatus={item.timingStatus}
                                submittedAt={item.submittedAt}
                                currentDeadlineAt={milestone.deadlineAt}
                                deadlineAtAtSubmit={item.deadlineAtAtSubmit}
                                className="whitespace-pre-line text-xs leading-snug text-slate-600"
                              />
                              <span className="mt-1 block">
                                版：
                                {sourceVersionsLabel(item.sourceVersions)}
                              </span>
                            </span>
                            <span className="mt-1 flex flex-wrap gap-2">
                              {isCand ? (
                                <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">
                                  現在の評価対象
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                  過去の提出
                                </span>
                              )}
                              {item.reviewDisplayStatus !== "none" ? (
                                <span
                                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                                    item.reviewDisplayStatus === "returned"
                                      ? "bg-sky-100 text-sky-900"
                                      : item.reviewDisplayStatus ===
                                          "return_revoked"
                                        ? "bg-amber-100 text-amber-900"
                                        : item.reviewDisplayStatus ===
                                            "completed"
                                          ? "bg-emerald-100 text-emerald-900"
                                          : "bg-slate-100 text-slate-700"
                                  }`}
                                >
                                  {isCand
                                    ? reviewDisplayStatusLabel(
                                        item.reviewDisplayStatus,
                                      )
                                    : item.reviewDisplayStatus === "returned"
                                      ? "過去に返却済み"
                                      : `過去の評価・${reviewDisplayStatusLabel(item.reviewDisplayStatus)}`}
                                </span>
                              ) : null}
                              {isView ? (
                                <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">
                                  閲覧中
                                </span>
                              ) : null}
                            </span>
                          </button>
                          <div className="mt-2 border-t border-slate-100 pt-2">
                            <LateSubmissionReviewActions
                              submissionId={item.id}
                              lateReviewStatus={item.lateReviewStatus}
                              timingIsLate={item.timingStatus === "late"}
                              onDone={onLateReviewDone}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
