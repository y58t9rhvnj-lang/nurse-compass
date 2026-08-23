"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  duplicateAssessmentMilestoneAction,
  moveAssessmentMilestoneAction,
  setAssessmentMilestoneStatusAction,
  upsertAssessmentMilestoneAction,
} from "@/app/v2/actions/assessmentMilestones";
import { formatAssessmentDateTimeJa } from "@/lib/v2/assessment/formatAssessmentDate";
import {
  defaultScopeForType,
  evaluationTypeLabel,
  FORM3_PATTERN_ORDER,
  form3PatternShortLabel,
  milestoneTypeLabel,
  statusLabel,
} from "@/lib/v2/assessment/submissionScope";
import type {
  AssessmentCycleRow,
  AssessmentEvaluationType,
  AssessmentMilestoneRow,
  AssessmentMilestoneStatus,
  AssessmentMilestoneType,
} from "@/lib/v2/assessment/types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";

const TYPE_OPTIONS: AssessmentMilestoneType[] = [
  "form2",
  "form3_progress",
  "form3_complete",
  "final",
  "custom",
];

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

export default function TeacherAssessmentMilestonesClient({
  cycle,
  initialMilestones,
}: {
  cycle: AssessmentCycleRow;
  initialMilestones: AssessmentMilestoneRow[];
}) {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneType, setMilestoneType] =
    useState<AssessmentMilestoneType>("form2");
  const [evaluationType, setEvaluationType] =
    useState<AssessmentEvaluationType>("formative");
  const [opensAt, setOpensAt] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [status, setStatus] = useState<AssessmentMilestoneStatus>("draft");
  const [patternIds, setPatternIds] = useState<Form3PatternKey[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setMilestoneType("form2");
    setEvaluationType("formative");
    setOpensAt("");
    setDeadlineAt("");
    setStatus("draft");
    setPatternIds([]);
    setError(null);
  };

  const startEdit = (m: AssessmentMilestoneRow) => {
    setEditingId(m.id);
    setTitle(m.title);
    setDescription(m.description ?? "");
    setMilestoneType(m.milestoneType);
    setEvaluationType(m.evaluationType);
    setOpensAt(toLocalInputValue(m.opensAt));
    setDeadlineAt(toLocalInputValue(m.deadlineAt));
    setStatus(m.status);
    const scope = m.submissionScope.form3Scope;
    setPatternIds(
      scope?.mode === "selected_patterns" ? [...scope.patternIds] : [],
    );
  };

  const startCreate = () => {
    resetForm();
    setEditingId(""); // empty string means create mode
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setDeadlineAt(toLocalInputValue(nextWeek.toISOString()));
  };

  const togglePattern = (key: Form3PatternKey) => {
    setPatternIds((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const onSave = async () => {
    if (!deadlineAt) {
      setError("提出期限は必須です。");
      return;
    }
    setBusy(true);
    setError(null);
    const scope = defaultScopeForType(milestoneType, patternIds);
    const res = await upsertAssessmentMilestoneAction({
      id: editingId || undefined,
      assessmentCycleId: cycle.id,
      title,
      description: description || null,
      milestoneType,
      evaluationType,
      opensAt: opensAt ? fromLocalInputValue(opensAt) : null,
      deadlineAt: fromLocalInputValue(deadlineAt),
      status,
      patternIds,
      submissionScope: scope,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMilestones((prev) => {
      const others = prev.filter((m) => m.id !== res.milestone.id);
      return [...others, res.milestone].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber,
      );
    });
    resetForm();
  };

  const onMove = async (id: string, direction: "up" | "down") => {
    setBusy(true);
    const res = await moveAssessmentMilestoneAction({
      cycleId: cycle.id,
      milestoneId: id,
      direction,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMilestones(res.milestones);
  };

  const onStatus = async (id: string, next: AssessmentMilestoneStatus) => {
    setBusy(true);
    const res = await setAssessmentMilestoneStatusAction({ id, status: next });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? res.milestone : m)),
    );
  };

  const onDuplicate = async (id: string) => {
    setBusy(true);
    const res = await duplicateAssessmentMilestoneAction(id);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setMilestones((prev) =>
      [...prev, res.milestone].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber,
      ),
    );
  };

  const showPatterns = milestoneType === "form3_progress";

  const patternCards = useMemo(() => FORM3_PATTERN_ORDER, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/v2/teacher/assessments"
            className="text-sm text-slate-500 hover:underline"
          >
            ← 課題グループ一覧
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900">{cycle.title}</h1>
          <p className="text-sm text-slate-500">事例 {cycle.caseId}</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="flex h-12 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          マイルストーンを追加
        </button>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {(editingId !== null) ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {editingId ? "マイルストーンを編集" : "マイルストーンを新規作成"}
          </h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium text-slate-700">
              課題名
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              説明（任意）
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              提出種別
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={milestoneType}
                onChange={(e) =>
                  setMilestoneType(e.target.value as AssessmentMilestoneType)
                }
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {milestoneTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              形成評価／総括評価
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={evaluationType}
                onChange={(e) =>
                  setEvaluationType(e.target.value as AssessmentEvaluationType)
                }
              >
                <option value="formative">形成評価</option>
                <option value="summative">総括評価</option>
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              受付開始日時（任意）
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              提出期限
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={deadlineAt}
                onChange={(e) => setDeadlineAt(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              公開状態
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as AssessmentMilestoneStatus)
                }
              >
                <option value="draft">下書き</option>
                <option value="open">公開中</option>
                <option value="closed">受付終了</option>
                <option value="archived">アーカイブ</option>
              </select>
            </label>

            {showPatterns ? (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  対象パターン（1つ以上）
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {patternCards.map((key) => {
                    const checked = patternIds.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePattern(key)}
                        className={[
                          "flex min-h-[48px] items-center gap-2 rounded-xl border px-3 text-left text-sm",
                          checked
                            ? "border-sky-500 bg-sky-50 text-sky-900"
                            : "border-slate-200 bg-white text-slate-700",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "flex h-5 w-5 items-center justify-center rounded border text-[11px]",
                            checked
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300",
                          ].join(" ")}
                        >
                          {checked ? "✓" : ""}
                        </span>
                        {form3PatternShortLabel(key)}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  既存の Form3PatternKey（11パターン）から選択します。
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onSave()}
                className="flex h-12 items-center rounded-lg bg-[#0A84FF] px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                保存
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={resetForm}
                className="flex h-12 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium"
              >
                キャンセル
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          マイルストーン一覧
        </h2>
        {milestones.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">まだありません。</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {milestones.map((m, index) => (
              <li
                key={m.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {index + 1}. {m.title}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {milestoneTypeLabel(m.milestoneType)} ・{" "}
                      {evaluationTypeLabel(m.evaluationType)} ・{" "}
                      {statusLabel(m.status)}
                    </p>
                    <p className="text-sm text-slate-600">
                      期限：{formatAssessmentDateTimeJa(m.deadlineAt)}
                    </p>
                    <p className="text-xs text-slate-500">
                      提出 {m.submissionCount ?? 0} 件
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-40"
                      disabled={busy || index === 0}
                      onClick={() => void onMove(m.id, "up")}
                    >
                      上へ
                    </button>
                    <button
                      type="button"
                      className="flex h-11 min-w-[44px] items-center justify-center rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-40"
                      disabled={busy || index === milestones.length - 1}
                      onClick={() => void onMove(m.id, "down")}
                    >
                      下へ
                    </button>
                    <button
                      type="button"
                      className="flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm"
                      disabled={busy}
                      onClick={() => startEdit(m)}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm"
                      disabled={busy}
                      onClick={() => void onDuplicate(m.id)}
                    >
                      複製
                    </button>
                    {m.status !== "open" ? (
                      <button
                        type="button"
                        className="flex h-11 items-center rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white"
                        disabled={busy}
                        onClick={() => void onStatus(m.id, "open")}
                      >
                        公開
                      </button>
                    ) : null}
                    {m.status === "open" ? (
                      <button
                        type="button"
                        className="flex h-11 items-center rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm text-amber-900"
                        disabled={busy}
                        onClick={() => void onStatus(m.id, "closed")}
                      >
                        受付終了
                      </button>
                    ) : null}
                    {m.status !== "archived" ? (
                      <button
                        type="button"
                        className="flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm text-slate-600"
                        disabled={busy}
                        onClick={() => void onStatus(m.id, "archived")}
                      >
                        アーカイブ
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-slate-500">
          提出済みマイルストーンは物理削除できません。受付終了またはアーカイブしてください。
        </p>
      </section>
    </div>
  );
}
