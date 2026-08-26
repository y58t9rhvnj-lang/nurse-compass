"use client";

import type { AiCandidateWarningView } from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";

type Props = {
  title: string;
  warnings: AiCandidateWarningView[];
  canAcknowledge: boolean;
  pending: boolean;
  onAcknowledge: (w: AiCandidateWarningView) => void;
  onAcknowledgeAll?: () => void;
};

export default function TeacherAiEvaluationWarningList({
  title,
  warnings,
  canAcknowledge,
  pending,
  onAcknowledge,
  onAcknowledgeAll,
}: Props) {
  if (warnings.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white px-3 py-2">
        <h4 className="text-xs font-semibold text-slate-700">{title}</h4>
        <p className="mt-1 text-xs text-slate-500">該当する警告はありません。</p>
      </section>
    );
  }

  const unacked = warnings.filter((w) => !w.acknowledged);

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold text-amber-950">
          {title}
          {unacked.length > 0 ? (
            <span className="ml-1 font-normal text-amber-800">
              （未確認 {unacked.length}）
            </span>
          ) : (
            <span className="ml-1 font-normal text-emerald-800">（確認済）</span>
          )}
        </h4>
        {canAcknowledge && unacked.length > 1 && onAcknowledgeAll ? (
          <button
            type="button"
            className="min-h-9 rounded border border-amber-300 bg-white px-2 text-xs text-amber-950 disabled:opacity-50"
            disabled={pending}
            onClick={onAcknowledgeAll}
          >
            すべて確認
          </button>
        ) : null}
      </div>
      <ul className="mt-2 space-y-2">
        {warnings.map((w) => (
          <li
            key={`${w.family}:${w.code}:${w.payloadHash}`}
            className="rounded border border-amber-100 bg-white px-2 py-2 text-xs text-slate-800"
          >
            <p className="font-medium text-slate-900">{w.code}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{w.message}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] text-slate-400">
                hash:{w.payloadHash.slice(0, 12)}…
              </p>
              {w.acknowledged ? (
                <span className="text-[11px] text-emerald-700">確認済み</span>
              ) : canAcknowledge ? (
                <button
                  type="button"
                  className="min-h-9 rounded bg-amber-800 px-2 text-[11px] font-medium text-white disabled:opacity-50"
                  disabled={pending}
                  onClick={() => onAcknowledge(w)}
                >
                  確認する
                </button>
              ) : (
                <span className="text-[11px] text-slate-500">未確認</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
