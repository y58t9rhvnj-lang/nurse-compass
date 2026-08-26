"use client";

import type { AiCandidateItem } from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";

type Props = {
  item: AiCandidateItem;
  selected: boolean;
  canSelect: boolean;
  editedScore: number | null;
  onToggle: (selected: boolean) => void;
  onScoreChange: (score: number | null) => void;
};

export default function TeacherAiEvaluationItemCard({
  item,
  selected,
  canSelect,
  editedScore,
  onToggle,
  onScoreChange,
}: Props) {
  const missingCitations = item.citations.filter(
    (c) =>
      c.resolveStatus === "missing" ||
      c.resolveStatus === "excluded_evidence_links",
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={selected}
          disabled={!canSelect}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={`${item.label}を採用候補にする`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-medium text-slate-900">{item.label}</h4>
            <p className="text-xs text-slate-500">参考候補</p>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-700">
            <span>
              AIスコア:{" "}
              <strong className="font-semibold text-slate-900">
                {item.score ?? "—"}
              </strong>
              {item.levelLabel ? `（${item.levelLabel}）` : null}
            </span>
            <span>
              教員スコア:{" "}
              <strong className="font-semibold text-slate-900">
                {item.teacherScore ?? "—"}
              </strong>
            </span>
          </div>
          {selected ? (
            <label className="mt-2 block text-xs text-slate-600">
              採用するスコア（編集可）
              <select
                className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
                value={editedScore ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  onScoreChange(v === "" ? null : Number(v));
                }}
              >
                <option value="">未選択</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {item.rationale ? (
            <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
              {item.rationale}
            </p>
          ) : null}
          {item.uncertaintyNote ? (
            <p className="mt-1 text-xs text-amber-800">
              不確実性: {item.uncertaintyNote}
            </p>
          ) : null}
          {item.citations.length > 0 ? (
            <ul className="mt-2 space-y-1 rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
              {item.citations.map((c, i) => (
                <li key={i}>
                  <span className="font-mono">
                    {c.fieldPath ?? "(pathなし)"}
                  </span>
                  {c.anonymousObjectId ? (
                    <span className="ml-1 text-slate-500">
                      id:{c.anonymousObjectId}
                    </span>
                  ) : null}
                  {c.excerpt ? (
                    <span className="block text-slate-500">「{c.excerpt}」</span>
                  ) : null}
                  {c.resolveStatus !== "ok" && c.resolveMessage ? (
                    <span className="mt-0.5 block text-amber-800">
                      ⚠ {c.resolveMessage}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {missingCitations.length > 0 ? (
            <p className="mt-1 text-[11px] text-amber-800">
              引用先の一部を snapshot で確認できません。採用は可能ですが内容を目視確認してください。
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
