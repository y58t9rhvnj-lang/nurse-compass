"use client";

import type { AiCandidateWarningView } from "@/lib/v2/assessment/aiEvaluationCandidateReadModel";
import {
  aiWarningCodeLabel,
  aiWarningFamilyTitle,
} from "@/lib/v2/assessment/aiEvaluationCandidateUiLabels";

type Props = {
  family: "version" | "pii";
  warnings: AiCandidateWarningView[];
  canAcknowledge: boolean;
  pending: boolean;
  onAcknowledge: (w: AiCandidateWarningView) => void;
  onAcknowledgeAll?: () => void;
  /** 単独表示時に見出しを出す（統合セクション内では false） */
  showTitle?: boolean;
  compactEmpty?: boolean;
};

export default function TeacherAiEvaluationWarningList({
  family,
  warnings,
  canAcknowledge,
  pending,
  onAcknowledge,
  onAcknowledgeAll,
  showTitle = true,
  compactEmpty = false,
}: Props) {
  const title = aiWarningFamilyTitle(family);

  if (warnings.length === 0) {
    if (compactEmpty) return null;
    return (
      <div className="text-xs text-slate-500">
        {showTitle ? <p className="font-medium text-slate-700">{title}</p> : null}
        <p className={showTitle ? "mt-0.5" : undefined}>該当する警告はありません。</p>
      </div>
    );
  }

  const unacked = warnings.filter((w) => !w.acknowledged);

  return (
    <div className={showTitle ? "space-y-2" : undefined}>
      {showTitle || (canAcknowledge && unacked.length > 1 && onAcknowledgeAll) ? (
        <div className="flex items-center justify-between gap-2">
          {showTitle ? (
            <h5 className="text-xs font-semibold text-amber-950">
              {title}
              {unacked.length > 0 ? (
                <span className="ml-1 font-normal text-amber-800">
                  （未確認 {unacked.length}）
                </span>
              ) : (
                <span className="ml-1 font-normal text-emerald-800">
                  （確認済）
                </span>
              )}
            </h5>
          ) : (
            <span className="text-xs text-amber-900">{title}</span>
          )}
          {canAcknowledge && unacked.length > 1 && onAcknowledgeAll ? (
            <button
              type="button"
              className="min-h-11 rounded border border-amber-300 bg-white px-3 text-xs text-amber-950 disabled:opacity-50"
              disabled={pending}
              onClick={onAcknowledgeAll}
            >
              すべて確認
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className="space-y-2">
        {warnings.map((w) => (
          <li
            key={`${w.family}:${w.code}:${w.payloadHash}`}
            className="rounded border border-amber-100 bg-white px-2.5 py-2 text-xs text-slate-800"
          >
            <p className="font-medium text-slate-900">
              {aiWarningCodeLabel(w.family, w.code)}
            </p>
            {w.message ? (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">
                {w.message}
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-end gap-2">
              {w.acknowledged ? (
                <span className="text-[11px] text-emerald-700">確認済み</span>
              ) : canAcknowledge ? (
                <button
                  type="button"
                  className="min-h-11 rounded bg-amber-800 px-3 text-[11px] font-medium text-white disabled:opacity-50"
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
    </div>
  );
}
