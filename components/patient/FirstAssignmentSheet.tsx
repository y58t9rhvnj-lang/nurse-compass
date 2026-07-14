"use client";

import { useSyncExternalStore } from "react";
import { ArrowRight, ClipboardList } from "lucide-react";

// Sprint A-2: 受け持ち患者を初めて開いたとき、一度だけ表示する課題シート。
// 「どこから始めるか」を学生が自然に理解できるようにする。
// 表示は患者ごとに一度だけ（localStorage で永続化）。第1回講義は Aさんのみ定義。
interface Assignment {
  patientLine: string;
  diagnosis: string;
  goal: string[];
  firstToSee: string[];
  hints: string[];
  buttonLabel: string;
}

const ASSIGNMENTS: Record<string, Assignment> = {
  A: {
    patientLine: "Aさん（47歳・男性）",
    diagnosis: "統合失調症",
    goal: [
      "Aさんがどのような人で、",
      "どのような生活を送り、",
      "何に困り、",
      "どのような思いで入院生活を送っているかを理解しましょう。",
    ],
    firstToSee: ["①生活歴", "②現病歴", "③現在サマリー"],
    hints: [
      "病気だけでなく生活にも注目しましょう。",
      "カルテだけで判断せず本人の話も聞いてみましょう。",
      "一つの情報だけで結論を出さず、複数の情報をつなげて考えてみましょう。",
    ],
    buttonLabel: "Aさんのところへ行く",
  },
};

function storageKey(patientId: string): string {
  return `compass:firstAssignment:${patientId}`;
}

// 課題シートの既読状態を localStorage に永続化する軽量ストア。
// useSyncExternalStore で購読し、SSR/ハイドレーション時は「既読扱い（非表示）」にして
// ミスマッチを避け、クライアントで実際の値へ切り替える。
const seenListeners = new Set<() => void>();

function subscribeSeen(cb: () => void): () => void {
  seenListeners.add(cb);
  return () => seenListeners.delete(cb);
}

function getSeen(patientId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(patientId)) === "1";
  } catch {
    return false;
  }
}

function markSeen(patientId: string): void {
  try {
    window.localStorage.setItem(storageKey(patientId), "1");
  } catch {
    // localStorage が使えない環境でも購読者へ通知し UI を閉じる。
  }
  seenListeners.forEach((l) => l());
}

export default function FirstAssignmentSheet({
  patientId,
}: {
  patientId: string;
}) {
  const assignment = ASSIGNMENTS[patientId];
  const seen = useSyncExternalStore(
    subscribeSeen,
    () => getSeen(patientId),
    () => true,
  );

  if (!assignment || seen) return null;

  const dismiss = () => markSeen(patientId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assignment-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        {/* ヘッダー */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[#EBEBF0] px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3FF]">
            <ClipboardList className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
          </span>
          <h2
            id="assignment-title"
            className="text-[17px] font-semibold text-[#1D1D1F]"
          >
            あなたの受け持ち患者
          </h2>
        </div>

        {/* 本文（縦スクロールのみ・横スクロールなし） */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl bg-[#F7F9FC] px-4 py-3">
            <p className="text-[16px] font-semibold text-[#1D1D1F]">
              {assignment.patientLine}
            </p>
            <p className="mt-1 text-[13px] text-[#3A3A3C]">
              診断：{assignment.diagnosis}
            </p>
          </div>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#0A5FCC]">
              学習の目標
            </h3>
            <p className="text-[13.5px] leading-relaxed text-[#3A3A3C]">
              {assignment.goal.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </p>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#0A5FCC]">
              最初に見るとよい情報
            </h3>
            <ul className="flex flex-wrap gap-2">
              {assignment.firstToSee.map((item, i) => (
                <li
                  key={i}
                  className="rounded-full bg-[#EAF3FF] px-3 py-1.5 text-[13px] font-medium text-[#0A5FCC]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#0A5FCC]">
              情報収集のヒント
            </h3>
            <ul className="space-y-1.5">
              {assignment.hints.map((hint, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] leading-relaxed text-[#3A3A3C]"
                >
                  <span aria-hidden="true" className="text-[#0A84FF]">
                    ・
                  </span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* フッター（44px タップ領域） */}
        <div className="shrink-0 border-t border-[#EBEBF0] px-5 py-4">
          <button
            type="button"
            onClick={dismiss}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#0A84FF] px-5 text-[15px] font-semibold text-white transition hover:bg-[#0A6CD6]"
          >
            {assignment.buttonLabel}
            <ArrowRight className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
