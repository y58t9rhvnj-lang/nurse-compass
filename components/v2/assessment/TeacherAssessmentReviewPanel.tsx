"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  completeTeacherAssessmentReviewAction,
  getTeacherAssessmentReviewAction,
  reopenTeacherAssessmentReviewAction,
  saveAndCompleteTeacherAssessmentReviewAction,
  saveTeacherAssessmentReviewDraftAction,
} from "@/app/v2/actions/assessmentReviewWrite";
import type { AssessmentReviewRow } from "@/lib/v2/assessment/assessmentReviewRepository";
import {
  ASSESSMENT_RUBRIC_KEYS,
  ASSESSMENT_RUBRIC_LABELS,
  ASSESSMENT_RUBRIC_LEVELS,
  canCompleteAssessmentReview,
  emptyRubricScores,
  sanitizeComment,
  type AssessmentRubricKey,
  type AssessmentRubricScores,
} from "@/lib/v2/assessment/assessmentRubric";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  buildTeacherTimingDisplayLines,
  formatTeacherTimingDisplayText,
} from "@/lib/v2/assessment/teacherReviewTimingDisplay";
import type { AssessmentTimingStatus } from "@/lib/v2/assessment/types";

type CandidateInfo = {
  submissionId: string;
  submissionNumber: number;
  submittedAt: string;
  timingStatus: AssessmentTimingStatus;
  deadlineAtAtSubmit: string | null;
};

type FormBaseline = {
  rubricScores: AssessmentRubricScores;
  overallComment: string;
  strengthsComment: string;
  nextStepsComment: string;
  missingInformationComment: string;
  privateNote: string;
};

type PendingNav =
  | { kind: "close" }
  | { kind: "student"; studentId: string }
  | { kind: "list" };

type Props = {
  milestoneId: string;
  milestoneTitle: string;
  milestoneDeadlineAt: string;
  studentId: string;
  studentDisplayName: string;
  candidate: CandidateInfo | null;
  viewingSubmissionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIdsOrdered: string[];
  onNavigateStudent: (studentId: string) => void;
  onNavigateList: () => void;
  /** 親が dirty を知る（一覧戻るリンク等） */
  onDirtyChange?: (dirty: boolean) => void;
  /** インクリメントで一覧へ戻る dirty 確認を開く */
  listNavRequestId?: number;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string }
  | { kind: "conflict"; message: string };

function statusBadge(status: "draft" | "completed" | null) {
  if (status === "completed") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-900">
        評価確定
      </span>
    );
  }
  if (status === "draft") {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        下書き
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
      未作成
    </span>
  );
}

function buildBaseline(input: FormBaseline): FormBaseline {
  return {
    rubricScores: { ...emptyRubricScores(), ...input.rubricScores },
    overallComment: sanitizeComment(input.overallComment),
    strengthsComment: sanitizeComment(input.strengthsComment),
    nextStepsComment: sanitizeComment(input.nextStepsComment),
    missingInformationComment: sanitizeComment(
      input.missingInformationComment,
    ),
    privateNote: sanitizeComment(input.privateNote),
  };
}

function baselinesEqual(a: FormBaseline, b: FormBaseline): boolean {
  for (const key of ASSESSMENT_RUBRIC_KEYS) {
    const av = a.rubricScores[key] ?? null;
    const bv = b.rubricScores[key] ?? null;
    if (av !== bv) return false;
  }
  return (
    a.overallComment === b.overallComment &&
    a.strengthsComment === b.strengthsComment &&
    a.nextStepsComment === b.nextStepsComment &&
    a.missingInformationComment === b.missingInformationComment &&
    a.privateNote === b.privateNote
  );
}

function scoreChipClass(selected: boolean): string {
  if (selected) {
    return "border-2 border-slate-900 bg-slate-900 font-semibold text-white disabled:border-slate-900 disabled:bg-slate-900 disabled:font-semibold disabled:text-white disabled:opacity-100";
  }
  return "border border-slate-300 bg-white font-semibold text-slate-900 disabled:border-slate-300 disabled:bg-white disabled:text-slate-900 disabled:opacity-100";
}

/** 評価パネル表示中に背景スクロールを止め、閉じたら位置を復元する */
function useBodyScrollLock(
  locked: boolean,
  anchorRef: React.RefObject<HTMLElement | null>,
) {
  const scrollYRef = useRef(0);
  const ancestorScrollRef = useRef<
    Array<{ el: HTMLElement; top: number; overflow: string; overscroll: string }>
  >([]);

  useEffect(() => {
    if (!locked) return;

    scrollYRef.current = window.scrollY;
    const { body, documentElement } = document;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overscrollBehavior: body.style.overscrollBehavior,
      htmlOverscroll: documentElement.style.overscrollBehavior,
      touchAction: body.style.touchAction,
    };

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";
    documentElement.style.overscrollBehavior = "none";

    const lockedAncestors: typeof ancestorScrollRef.current = [];
    let cur: HTMLElement | null = anchorRef.current?.parentElement ?? null;
    while (cur && cur !== document.documentElement) {
      const cs = window.getComputedStyle(cur);
      if (
        /(auto|scroll)/.test(cs.overflowY) ||
        /(auto|scroll)/.test(cs.overflow)
      ) {
        lockedAncestors.push({
          el: cur,
          top: cur.scrollTop,
          overflow: cur.style.overflow,
          overscroll: cur.style.overscrollBehavior,
        });
        cur.style.overflow = "hidden";
        cur.style.overscrollBehavior = "none";
      }
      cur = cur.parentElement;
    }
    ancestorScrollRef.current = lockedAncestors;

    return () => {
      body.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overscrollBehavior = previous.overscrollBehavior;
      body.style.touchAction = previous.touchAction;
      documentElement.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(0, scrollYRef.current);
      for (const item of ancestorScrollRef.current) {
        item.el.style.overflow = item.overflow;
        item.el.style.overscrollBehavior = item.overscroll;
        item.el.scrollTop = item.top;
      }
      ancestorScrollRef.current = [];
    };
  }, [locked, anchorRef]);
}

export default function TeacherAssessmentReviewPanel({
  milestoneId,
  milestoneTitle,
  milestoneDeadlineAt,
  studentId,
  studentDisplayName,
  candidate,
  viewingSubmissionId,
  open,
  onOpenChange,
  studentIdsOrdered,
  onNavigateStudent,
  onNavigateList,
  onDirtyChange,
  listNavRequestId = 0,
}: Props) {
  const [review, setReview] = useState<AssessmentReviewRow | null>(null);
  const [rubricScores, setRubricScores] =
    useState<AssessmentRubricScores>(emptyRubricScores());
  const [overallComment, setOverallComment] = useState("");
  const [strengthsComment, setStrengthsComment] = useState("");
  const [nextStepsComment, setNextStepsComment] = useState("");
  const [missingInformationComment, setMissingInformationComment] =
    useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [baseUpdatedAt, setBaseUpdatedAt] = useState<string | null>(null);
  const [completedByName, setCompletedByName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
  const [showLegend, setShowLegend] = useState(false);
  const [pending, startTransition] = useTransition();
  const [baseline, setBaseline] = useState<FormBaseline>(() =>
    buildBaseline({
      rubricScores: emptyRubricScores(),
      overallComment: "",
      strengthsComment: "",
      nextStepsComment: "",
      missingInformationComment: "",
      privateNote: "",
    }),
  );
  const [pendingNav, setPendingNav] = useState<PendingNav | null>(null);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /** 進行中の get を無効化するための世代。mutation 成功時に進めて stale 上書きを防ぐ */
  const fetchGenRef = useRef(0);

  useBodyScrollLock(open, rootRef);

  const readOnly = review?.status === "completed";
  const candidateSubmissionId = candidate?.submissionId ?? null;

  const currentForm = useMemo(
    () =>
      buildBaseline({
        rubricScores,
        overallComment,
        strengthsComment,
        nextStepsComment,
        missingInformationComment,
        privateNote,
      }),
    [
      rubricScores,
      overallComment,
      strengthsComment,
      nextStepsComment,
      missingInformationComment,
      privateNote,
    ],
  );

  const dirty = !readOnly && !baselinesEqual(baseline, currentForm);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const viewingIsCandidate = Boolean(
    candidate &&
      viewingSubmissionId &&
      viewingSubmissionId === candidate.submissionId,
  );

  const navIndex = studentIdsOrdered.indexOf(studentId);
  const prevStudentId =
    navIndex > 0 ? studentIdsOrdered[navIndex - 1] ?? null : null;
  const nextStudentId =
    navIndex >= 0 && navIndex < studentIdsOrdered.length - 1
      ? studentIdsOrdered[navIndex + 1] ?? null
      : null;

  const applyReview = useCallback(
    (
      row: AssessmentReviewRow | null,
      names?: { completedByDisplayName?: string | null },
    ) => {
      setReview(row);
      if (names && "completedByDisplayName" in names) {
        setCompletedByName(names.completedByDisplayName ?? null);
      }
      if (row) {
        const nextScores = { ...emptyRubricScores(), ...row.rubricScores };
        setRubricScores(nextScores);
        setOverallComment(row.overallComment);
        setStrengthsComment(row.strengthsComment);
        setNextStepsComment(row.nextStepsComment);
        setMissingInformationComment(row.missingInformationComment);
        setPrivateNote(row.privateNote);
        setBaseUpdatedAt(row.updatedAt);
        setBaseline(
          buildBaseline({
            rubricScores: nextScores,
            overallComment: row.overallComment,
            strengthsComment: row.strengthsComment,
            nextStepsComment: row.nextStepsComment,
            missingInformationComment: row.missingInformationComment,
            privateNote: row.privateNote,
          }),
        );
      } else {
        const empty = emptyRubricScores();
        setRubricScores(empty);
        setOverallComment("");
        setStrengthsComment("");
        setNextStepsComment("");
        setMissingInformationComment("");
        setPrivateNote("");
        setBaseUpdatedAt(null);
        setCompletedByName(null);
        setBaseline(
          buildBaseline({
            rubricScores: empty,
            overallComment: "",
            strengthsComment: "",
            nextStepsComment: "",
            missingInformationComment: "",
            privateNote: "",
          }),
        );
      }
    },
    [],
  );

  /** Action が返した review を正本にする（進行中 fetch を無効化） */
  const commitReviewFromAction = useCallback(
    (
      row: AssessmentReviewRow,
      names?: { completedByDisplayName?: string | null },
    ) => {
      fetchGenRef.current += 1;
      applyReview(row, names);
    },
    [applyReview],
  );

  const loadReviewFromServer = useCallback(() => {
    const submissionId = candidateSubmissionId;
    if (!submissionId) {
      fetchGenRef.current += 1;
      applyReview(null);
      setLoadError(null);
      return;
    }
    const gen = ++fetchGenRef.current;
    startTransition(async () => {
      setLoadError(null);
      const res = await getTeacherAssessmentReviewAction({
        milestoneId,
        studentId,
        submissionId,
      });
      if (gen !== fetchGenRef.current) return;
      if (!res.ok) {
        setLoadError(res.message);
        return;
      }
      applyReview(res.review, {
        completedByDisplayName: res.completedByDisplayName,
      });
      setSaveState({ kind: "idle" });
    });
  }, [
    applyReview,
    candidateSubmissionId,
    milestoneId,
    studentId,
  ]);

  // candidate / student 変更時のみサーバから再取得（object 参照ではなく id）
  useEffect(() => {
    loadReviewFromServer();
  }, [loadReviewFromServer]);

  const reload = loadReviewFromServer;

  useEffect(() => {
    if (!open) return;
    panelScrollRef.current?.scrollTo({ top: 0 });
  }, [open, studentId]);

  const requestClose = useCallback(() => {
    if (dirty) {
      setPendingNav({ kind: "close" });
      return;
    }
    onOpenChange(false);
  }, [dirty, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  useEffect(() => {
    if (!open || !dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, dirty]);

  const setScore = (key: AssessmentRubricKey, value: number | null) => {
    if (readOnly) return;
    setRubricScores((prev) => ({ ...prev, [key]: value }));
  };

  const payload = () => ({
    milestoneId,
    studentId,
    submissionId: candidate!.submissionId,
    reviewId: review?.id ?? null,
    baseUpdatedAt,
    rubricScores,
    overallComment,
    strengthsComment,
    nextStepsComment,
    missingInformationComment,
    privateNote,
  });

  const saveDraftAsync = async (): Promise<boolean> => {
    if (!candidate || readOnly) return false;
    setSaveState({ kind: "saving" });
    const res = await saveTeacherAssessmentReviewDraftAction(payload());
    if (!res.ok) {
      setSaveState(
        res.kind === "conflict"
          ? { kind: "conflict", message: res.message }
          : { kind: "error", message: res.message },
      );
      return false;
    }
    commitReviewFromAction(res.review, {
      completedByDisplayName: completedByName,
    });
    setSaveState({
      kind: "saved",
      at: formatAssessmentDateTimeJa(res.review.updatedAt),
    });
    return true;
  };

  const onSaveDraft = () => {
    if (!candidate || readOnly || pending) return;
    startTransition(async () => {
      await saveDraftAsync();
    });
  };

  const onComplete = () => {
    if (!candidate || readOnly || pending) return;
    if (
      !canCompleteAssessmentReview({
        overallComment,
        rubricScores,
      })
    ) {
      setSaveState({
        kind: "error",
        message:
          "評価を確定するには、総合コメントまたは評価項目を1つ以上入力してください。",
      });
      return;
    }
    const ok = window.confirm(
      "この評価を確定します。\n学生への返却はまだ行われません。",
    );
    if (!ok) return;
    setSaveState({ kind: "saving" });
    startTransition(async () => {
      const res = review?.id
        ? await completeTeacherAssessmentReviewAction({
            ...payload(),
            reviewId: review.id,
            baseUpdatedAt: baseUpdatedAt!,
          })
        : await saveAndCompleteTeacherAssessmentReviewAction(payload());
      if (!res.ok) {
        setSaveState(
          res.kind === "conflict"
            ? { kind: "conflict", message: res.message }
            : { kind: "error", message: res.message },
        );
        return;
      }
      commitReviewFromAction(res.review);
      setSaveState({
        kind: "saved",
        at: formatAssessmentDateTimeJa(res.review.updatedAt),
      });
      // 確定者名のみ補完（applyReview はしない）
      const gen = fetchGenRef.current;
      const named = await getTeacherAssessmentReviewAction({
        milestoneId,
        studentId,
        submissionId: candidate.submissionId,
      });
      if (gen !== fetchGenRef.current || !named.ok) return;
      setCompletedByName(named.completedByDisplayName);
    });
  };

  const onReopen = () => {
    if (!candidate || !review || review.status !== "completed" || pending) {
      return;
    }
    const ok = window.confirm(
      "評価を下書きに戻して編集できるようにしますか？",
    );
    if (!ok) return;
    setSaveState({ kind: "saving" });
    startTransition(async () => {
      const res = await reopenTeacherAssessmentReviewAction({
        milestoneId,
        studentId,
        submissionId: candidate.submissionId,
        reviewId: review.id,
        baseUpdatedAt: baseUpdatedAt!,
      });
      if (!res.ok) {
        setSaveState(
          res.kind === "conflict"
            ? { kind: "conflict", message: res.message }
            : { kind: "error", message: res.message },
        );
        return;
      }
      // Action 戻り値を正本。stale get を無効化し、reload しない
      commitReviewFromAction(res.review, {
        completedByDisplayName: completedByName,
      });
      setSaveState({ kind: "idle" });
    });
  };

  const executePendingNav = (nav: PendingNav) => {
    setPendingNav(null);
    if (nav.kind === "close") {
      onOpenChange(false);
      return;
    }
    if (nav.kind === "list") {
      onNavigateList();
      return;
    }
    onNavigateStudent(nav.studentId);
  };

  const requestNav = (nav: PendingNav) => {
    if (dirty) {
      setPendingNav(nav);
      return;
    }
    executePendingNav(nav);
  };

  useEffect(() => {
    if (listNavRequestId <= 0) return;
    if (dirty) {
      setPendingNav({ kind: "list" });
      return;
    }
    onNavigateList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- signal only
  }, [listNavRequestId]);

  const onConfirmSaveAndGo = () => {
    if (!pendingNav) return;
    const nav = pendingNav;
    startTransition(async () => {
      const ok = await saveDraftAsync();
      if (!ok) return;
      executePendingNav(nav);
    });
  };

  const onConfirmDiscardAndGo = () => {
    if (!pendingNav) return;
    const nav = pendingNav;
    applyReview(review, { completedByDisplayName: completedByName });
    // baseline を現 review に戻す（破棄）
    if (review) {
      applyReview(review, { completedByDisplayName: completedByName });
    } else {
      applyReview(null);
    }
    executePendingNav(nav);
  };

  const completedBanner =
    readOnly && review ? (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
        <p className="font-semibold">評価確定済み</p>
        <p className="mt-1">
          確定日時：
          {review.completedAt
            ? formatAssessmentDateTimeJa(review.completedAt)
            : "—"}
        </p>
        <p>確定者：{completedByName ?? "—"}</p>
        <p className="mt-1 text-emerald-900/90">
          この評価を編集する場合は、下書きに戻してください。
        </p>
      </div>
    ) : null;

  const scoreButtons = (key: AssessmentRubricKey) => (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={readOnly || pending}
        aria-pressed={rubricScores[key] == null}
        className={`flex h-11 min-w-11 items-center justify-center rounded-lg text-sm ${scoreChipClass(
          rubricScores[key] == null,
        )}`}
        onClick={() => setScore(key, null)}
        title="未入力"
      >
        —
      </button>
      {ASSESSMENT_RUBRIC_LEVELS.map((l) => {
        const selected = rubricScores[key] === l.value;
        return (
          <button
            key={l.value}
            type="button"
            disabled={readOnly || pending}
            aria-pressed={selected}
            title={l.label}
            className={`flex h-11 min-w-11 items-center justify-center rounded-lg text-sm ${scoreChipClass(
              selected,
            )}`}
            onClick={() => setScore(key, l.value)}
          >
            {l.value}
          </button>
        );
      })}
    </div>
  );

  const formBody: ReactNode = !candidate ? (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
      現在、評価対象となる提出はありません。
    </p>
  ) : (
    <>
      {completedBanner}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-700">評価項目</p>
        <button
          type="button"
          className="min-h-11 text-xs text-sky-700 underline"
          onClick={() => setShowLegend((v) => !v)}
        >
          {showLegend ? "段階の説明を閉じる" : "段階の説明"}
        </button>
      </div>
      {showLegend ? (
        <ul className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {ASSESSMENT_RUBRIC_LEVELS.map((l) => (
            <li key={l.value}>
              {l.value}：{l.label}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-4">
        {ASSESSMENT_RUBRIC_KEYS.map((key) => (
          <div key={key}>
            <p className="text-sm font-medium text-slate-900">
              {ASSESSMENT_RUBRIC_LABELS[key]}
            </p>
            {scoreButtons(key)}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <CommentField
          label="総合コメント"
          value={overallComment}
          onChange={setOverallComment}
          readOnly={readOnly || pending}
        />
        <CommentField
          label="良かった点"
          value={strengthsComment}
          onChange={setStrengthsComment}
          readOnly={readOnly || pending}
        />
        <CommentField
          label="次に考えてほしいこと"
          value={nextStepsComment}
          onChange={setNextStepsComment}
          readOnly={readOnly || pending}
        />
        <CommentField
          label="不足情報・再確認事項"
          value={missingInformationComment}
          onChange={setMissingInformationComment}
          readOnly={readOnly || pending}
        />
        <div>
          <label className="text-sm font-medium text-slate-900">
            教員メモ
            <span className="ml-1 text-xs font-normal text-slate-500">
              （内部専用・学生返却対象外）
            </span>
          </label>
          <textarea
            className="mt-1 min-h-24 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
            value={privateNote}
            disabled={readOnly || pending}
            maxLength={3000}
            onChange={(e) => setPrivateNote(e.target.value)}
          />
        </div>
      </div>
    </>
  );

  const timingText = candidate
    ? formatTeacherTimingDisplayText(
        buildTeacherTimingDisplayLines({
          timingStatus: candidate.timingStatus,
          submittedAt: candidate.submittedAt,
          currentDeadlineAt: milestoneDeadlineAt,
          deadlineAtAtSubmit: candidate.deadlineAtAtSubmit,
        }),
      )
    : null;

  const footerActions: ReactNode = (
    <div className="sticky bottom-0 shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {candidate && readOnly ? completedBanner : null}
      {saveState.kind === "saving" || pending ? (
        <p className="text-xs text-slate-500">保存中…</p>
      ) : null}
      {saveState.kind === "saved" ? (
        <p className="text-xs text-emerald-800">保存済み（{saveState.at}）</p>
      ) : null}
      {review && saveState.kind === "idle" && review.status === "draft" ? (
        <p className="text-xs text-slate-500">
          最終保存：{formatAssessmentDateTimeJa(review.updatedAt)}
        </p>
      ) : null}
      {saveState.kind === "error" || saveState.kind === "conflict" ? (
        <p className="text-xs text-rose-800">{saveState.message}</p>
      ) : null}
      {saveState.kind === "conflict" ? (
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 text-sm"
          onClick={() => reload()}
        >
          再読み込み
        </button>
      ) : null}

      {candidate && !readOnly ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={pending}
            className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 disabled:opacity-50"
            onClick={onSaveDraft}
          >
            下書き保存
          </button>
          <button
            type="button"
            disabled={pending}
            className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-emerald-700 text-sm font-medium text-white disabled:opacity-50"
            onClick={onComplete}
          >
            評価を確定
          </button>
        </div>
      ) : null}
      {candidate && readOnly ? (
        <button
          type="button"
          disabled={pending}
          className="flex min-h-11 w-full items-center justify-center rounded-lg border border-slate-300 text-sm font-medium disabled:opacity-50"
          onClick={onReopen}
        >
          下書きに戻して編集
        </button>
      ) : null}
    </div>
  );

  const dirtyDialog =
    pendingNav != null ? (
      <div className="absolute inset-0 z-20 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center">
        <div
          role="alertdialog"
          aria-labelledby="dirty-nav-title"
          className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl"
        >
          <p id="dirty-nav-title" className="text-sm font-semibold text-slate-900">
            保存していない評価内容があります。
            <br />
            このまま移動すると入力内容は失われます。
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {candidate && !readOnly ? (
              <button
                type="button"
                disabled={pending}
                className="flex min-h-11 items-center justify-center rounded-lg bg-slate-900 text-sm font-medium text-white disabled:opacity-50"
                onClick={onConfirmSaveAndGo}
              >
                下書き保存して移動
              </button>
            ) : null}
            <button
              type="button"
              className="flex min-h-11 items-center justify-center rounded-lg border border-slate-300 text-sm font-medium"
              onClick={onConfirmDiscardAndGo}
            >
              保存せず移動
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center rounded-lg text-sm text-slate-600"
              onClick={() => setPendingNav(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div ref={rootRef}>
      <div className="flex flex-wrap items-center gap-2">
        {open ? (
          <button
            type="button"
            className="flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800"
            onClick={requestClose}
          >
            評価を閉じる
          </button>
        ) : (
          <button
            type="button"
            className="flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white"
            onClick={() => onOpenChange(true)}
          >
            評価を開く
          </button>
        )}
        {!candidate ? (
          <span className="rounded-full bg-slate-50 px-2.5 py-0.5 text-xs text-slate-500">
            評価対象なし
          </span>
        ) : (
          statusBadge(
            review?.status === "completed"
              ? "completed"
              : review
                ? "draft"
                : null,
          )
        )}
        {loadError ? (
          <span className="text-xs text-rose-700">{loadError}</span>
        ) : null}
      </div>
      {!open && !candidate ? (
        <p className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          現在、評価対象となる提出はありません。
        </p>
      ) : null}

      <div
        className={
          open
            ? "fixed inset-0 z-50 flex flex-col lg:flex-row"
            : "pointer-events-none fixed inset-0 z-50 hidden"
        }
        aria-hidden={!open}
      >
        <button
          type="button"
          aria-label="評価パネルを閉じる"
          className="absolute inset-0 bg-slate-900/40"
          onClick={requestClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="評価入力"
          className="relative z-10 ml-auto flex w-full flex-col bg-white shadow-xl max-lg:mt-auto max-lg:h-[min(92dvh,100%)] max-lg:rounded-t-2xl lg:h-full lg:w-96 xl:w-[28rem]"
          onClick={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 shrink-0 space-y-2 border-b border-slate-100 bg-white px-3 py-2.5">
            {/* 1行目: 閉じる + 前後ナビ + 学生 */}
            <div className="flex flex-nowrap items-center gap-1.5">
              <button
                type="button"
                className="flex h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-2.5 text-sm font-medium text-slate-800"
                onClick={requestClose}
              >
                閉じる
              </button>
              <button
                type="button"
                aria-label="前の学生"
                disabled={!prevStudentId || pending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-base font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (!prevStudentId) return;
                  requestNav({ kind: "student", studentId: prevStudentId });
                }}
              >
                ←
              </button>
              <div className="min-w-0 flex-1 px-1 text-center">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {studentDisplayName}
                </p>
                <p className="text-[11px] tabular-nums text-slate-500">
                  {navIndex >= 0
                    ? `${navIndex + 1} / ${studentIdsOrdered.length}`
                    : `— / ${studentIdsOrdered.length}`}
                </p>
              </div>
              <button
                type="button"
                aria-label="次の学生"
                disabled={!nextStudentId || pending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-base font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (!nextStudentId) return;
                  requestNav({ kind: "student", studentId: nextStudentId });
                }}
              >
                →
              </button>
            </div>

            {/* 2行目: 状態・課題・提出回 */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              {!candidate ? (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-slate-500">
                  評価対象なし
                </span>
              ) : (
                statusBadge(
                  review?.status === "completed"
                    ? "completed"
                    : review
                      ? "draft"
                      : null,
                )
              )}
              <span className="truncate">{milestoneTitle}</span>
              {candidate ? (
                <span className="shrink-0 text-slate-500">
                  第{candidate.submissionNumber}回
                </span>
              ) : null}
            </div>

            {candidate ? (
              <details className="text-xs text-slate-600">
                <summary className="cursor-pointer select-none text-slate-500">
                  評価対象の詳細
                </summary>
                <dl className="mt-1.5 space-y-1 rounded-lg bg-slate-50 px-2.5 py-2">
                  <div>
                    <dt className="inline text-slate-500">提出日時：</dt>
                    <dd className="inline">
                      {formatAssessmentDateTimeJa(candidate.submittedAt)}
                    </dd>
                  </div>
                  <div className="break-all">
                    <dt className="inline text-slate-500">提出ID：</dt>
                    <dd className="inline font-mono text-[11px]">
                      {candidate.submissionId}
                    </dd>
                  </div>
                  {timingText ? (
                    <dd className="whitespace-pre-line leading-snug text-slate-700">
                      {timingText}
                    </dd>
                  ) : null}
                </dl>
              </details>
            ) : null}

            {candidate && !viewingIsCandidate ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
                現在閲覧中の提出は評価対象ではありません。
                <br />
                評価は第{candidate.submissionNumber}
                回提出に対して記録されます。
              </p>
            ) : null}
            {candidate && readOnly ? completedBanner : null}
          </div>

          <div
            ref={panelScrollRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 [-webkit-overflow-scrolling:touch]"
            style={{ touchAction: "pan-y" }}
          >
            {formBody}
          </div>

          {footerActions}
          {dirtyDialog}
        </div>
      </div>
    </div>
  );
}

/** 親から一覧へ戻る前に dirty 確認させるためのヘルパー型 */
export type ReviewPanelNavRequest = PendingNav;

function CommentField({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-900">{label}</label>
      <textarea
        className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
        value={value}
        disabled={readOnly}
        maxLength={3000}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
