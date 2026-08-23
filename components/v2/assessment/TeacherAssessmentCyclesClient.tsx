"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createAssessmentCycleAction,
  updateAssessmentCycleAction,
} from "@/app/v2/actions/assessmentMilestones";
import { statusLabel } from "@/lib/v2/assessment/submissionScope";
import type {
  AssessmentCycleRow,
  AssessmentCycleStatus,
} from "@/lib/v2/assessment/types";

export default function TeacherAssessmentCyclesClient({
  initialCycles,
}: {
  initialCycles: AssessmentCycleRow[];
}) {
  const router = useRouter();
  const [cycles, setCycles] = useState(initialCycles);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [patientId, setPatientId] = useState("A");
  const [status, setStatus] = useState<AssessmentCycleStatus>("open");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetCreate = () => {
    setTitle("");
    setDescription("");
    setPatientId("A");
    setStatus("open");
    setEditingId(null);
    setError(null);
  };

  const startEdit = (c: AssessmentCycleRow) => {
    setEditingId(c.id);
    setTitle(c.title);
    setDescription(c.description ?? "");
    setStatus(c.status);
    setError(null);
  };

  const onSave = async () => {
    setBusy(true);
    setError(null);
    if (editingId) {
      const res = await updateAssessmentCycleAction({
        id: editingId,
        title,
        description,
        status,
      });
      setBusy(false);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setCycles((prev) =>
        prev.map((c) => (c.id === res.cycle.id ? res.cycle : c)),
      );
      resetCreate();
      return;
    }

    const res = await createAssessmentCycleAction({
      title,
      patientId,
      description,
      status,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setCycles((prev) => [res.cycle, ...prev]);
    resetCreate();
    router.push(`/v2/teacher/assessments/${res.cycle.id}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          {editingId
            ? "講義・課題グループを編集"
            : "講義・課題グループを新規作成"}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          親 Assessment Cycle を明示作成・選択します（自動選択しません）。
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            講義・課題グループ名
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例：精神看護学実習・2年A組・患者A"
            />
          </label>
          {!editingId ? (
            <label className="block text-sm font-medium text-slate-700">
              対象事例
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
              >
                <option value="A">患者 A（SP-001）</option>
              </select>
            </label>
          ) : null}
          <label className="block text-sm font-medium text-slate-700">
            説明（任意）
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            状態
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-[15px]"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as AssessmentCycleStatus)
              }
            >
              <option value="draft">下書き</option>
              <option value="open">公開中</option>
              <option value="closed">受付終了</option>
              <option value="archived">アーカイブ</option>
            </select>
          </label>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => void onSave()}
              className="flex h-12 min-w-[140px] items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy
                ? "保存中…"
                : editingId
                  ? "変更を保存"
                  : "作成して開く"}
            </button>
            {editingId ? (
              <button
                type="button"
                disabled={busy}
                onClick={resetCreate}
                className="flex h-12 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium"
              >
                キャンセル
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          課題グループ一覧
        </h2>
        {cycles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">まだありません。</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {cycles.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.title}</p>
                  <p className="text-xs text-slate-500">
                    事例 {c.caseId} ・ {statusLabel(c.status)}
                  </p>
                  {c.description ? (
                    <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    onClick={() => startEdit(c)}
                  >
                    編集
                  </button>
                  <Link
                    href={`/v2/teacher/assessments/${c.id}`}
                    className="flex h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                  >
                    マイルストーンを管理
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
