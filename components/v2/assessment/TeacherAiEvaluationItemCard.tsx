"use client";

import type { AiCandidateItem } from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";
import {
  AI_CITATION_ADOPT_NOTE,
  aiCitationFieldPathLabel,
  aiCitationResolveDisplay,
} from "@/lib/v2/assessment/aiEvaluationCandidateUiLabels";

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
      c.resolveStatus === "excluded_evidence_links" ||
      c.resolveStatus === "unknown",
  );

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50/40 px-2.5 py-2.5">
      <div className="flex items-start gap-2.5">
        <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center [-webkit-tap-highlight-color:transparent]">
          <input
            type="checkbox"
            className="h-5 w-5 accent-slate-800"
            checked={selected}
            disabled={!canSelect}
            onChange={(e) => onToggle(e.target.checked)}
            aria-label={`${item.label}を採用候補にする`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h4 className="text-sm font-medium leading-snug text-slate-900">
              {item.label}
            </h4>
            <p className="text-[11px] text-slate-500">参考候補</p>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
            <span>
              AIスコア:{" "}
              <span className="font-semibold text-slate-900">
                {item.score ?? "—"}
              </span>
              {item.levelLabel ? (
                <span className="text-slate-500">（{item.levelLabel}）</span>
              ) : null}
            </span>
            <span>
              現在の教員スコア:{" "}
              <span className="font-semibold text-slate-900">
                {item.teacherScore ?? "—"}
              </span>
            </span>
          </div>

          {selected ? (
            <label className="mt-2 flex min-h-11 flex-wrap items-center gap-2 text-xs text-slate-600">
              採用するスコア（編集可）
              <select
                className="min-h-11 rounded border border-slate-300 bg-white px-2 text-sm"
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
            <div className="mt-2">
              <p className="text-[11px] font-medium text-slate-500">AIの理由</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">
                {item.rationale}
              </p>
            </div>
          ) : null}

          {item.uncertaintyNote ? (
            <p className="mt-1.5 break-words text-xs text-amber-800">
              不確実性: {item.uncertaintyNote}
            </p>
          ) : null}

          {item.citations.length > 0 ? (
            <details className="mt-2 rounded border border-slate-200 bg-white">
              <summary className="flex min-h-10 cursor-pointer list-none items-center px-2.5 text-[11px] font-medium text-slate-600 [&::-webkit-details-marker]:hidden">
                引用・根拠（{item.citations.length}）
              </summary>
              <ul className="space-y-2 border-t border-slate-100 px-2.5 py-2 text-[11px] text-slate-600">
                {item.citations.map((c, i) => {
                  const resolve = aiCitationResolveDisplay(c);
                  return (
                    <li key={i} className="break-words">
                      <p className="font-medium text-slate-800">
                        {aiCitationFieldPathLabel(c.fieldPath)}
                      </p>
                      {c.excerpt ? (
                        <p className="mt-0.5 text-slate-500">「{c.excerpt}」</p>
                      ) : null}
                      {c.note ? (
                        <p className="mt-0.5 text-slate-500">{c.note}</p>
                      ) : null}
                      {resolve ? (
                        <p className="mt-1 text-amber-800">
                          ⚠ {resolve.message}
                          <span className="mt-0.5 block text-amber-700/90">
                            {resolve.adoptNote}
                          </span>
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}

          {missingCitations.length > 0 ? (
            <p className="mt-1.5 text-[11px] leading-snug text-amber-800">
              一部の引用を提出時点の記録から確認できません。
              {AI_CITATION_ADOPT_NOTE}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
