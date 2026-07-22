"use client";

// Compass Version2 — Patient Understanding Workspace（Sprint D-3A / 患者理解画面）。
//
// 学習フロー:
//   電子カルテ → Compassノート（情報収集） → 様式2（情報整理） → 患者理解（情報の意味づけ）
//     → 私が捉えた患者さん
//   患者理解画面は「様式2を見ながら考える」場。整理工程（Compassノート整理・気づき整理）を重複させない。
//
// レイアウト（Desktop / iPad Landscape）:
//   左 約60%: 様式2 を読み取り専用で表示（編集不可。事実の参照）。
//   右 約40%: 様式2 の各項目に対する「私が考えたこと」→ Compass Coach（問いのみ）→
//             最下部に「私が捉えた患者さん」（考察の最終統合・自動保存）。独立スクロール。
//
// スコープ:
//   ・様式2 の編集・保存・提出・印刷は本画面では行わない（通常ワークスペースの責務）。役割分担を崩さない。
//   ・様式2 データは本コンポーネントが一度だけ読み取り専用で読み込み、左右へ渡す。
//   ・onForm2Persisted は受け取るが本画面では使用しない（読み取り専用のため）。

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import { useForm2Supabase } from "@/hooks/v2/useForm2Supabase";
import { getQuestionsForCase } from "@/lib/v2/question/questionFixtures";
import Form2SheetView from "@/components/form2/Form2SheetView";
import Form2ReflectionSection from "./Form2ReflectionSection";
import PatientOverviewEditor from "./PatientOverviewEditor";

export default function EvidenceReviewWorkspace({
  patient,
  userId,
  initialForm2,
  onBackToWorkspace,
}: {
  patient: Patient;
  userId: string;
  initialForm2: Form2Snapshot | null;
  // 様式2 保存通知。本画面は読み取り専用のため受け取っても使用しない（親の呼び出し互換のため保持）。
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // 第1段階（思考ワークスペース）へ戻る導線。
  onBackToWorkspace: () => void;
}) {
  // 様式2 は読み取り専用で読み込む（編集・保存はしない＝通常ワークスペース側の責務）。
  const { data, hydrated } = useForm2Supabase({
    patientId: patient.id,
    userId,
    initial: initialForm2,
  });

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#F2F2F7]">
      {/* 左（約60%）: 様式2 を読み取り専用で表示（編集不可）。 */}
      <section
        aria-label="様式2（読み取り専用）"
        className="flex min-h-0 basis-[60%] flex-col overflow-y-auto overscroll-contain border-r border-[#E5E5EA] bg-[#F2F2F7]"
      >
        <div className="mx-auto w-full max-w-[820px] px-4 py-5">
          <header className="no-print mb-3 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[15px] font-bold text-[#1D1D1F]">
                患者理解を深める
              </h1>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
                様式2を見ながら、各項目について考えたことを右側に整理し、最後に患者さんの全体像を統合します。
              </p>
            </div>
            <button
              type="button"
              onClick={onBackToWorkspace}
              className="no-print inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3A3A3C] transition hover:bg-[#F2F2F5]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              ワークスペースへ戻る
            </button>
          </header>

          {hydrated ? (
            <div className="rounded-2xl border border-[#EBEBF0] bg-white p-3">
              <Form2SheetView data={data} />
            </div>
          ) : (
            <div className="rounded-2xl border border-[#EBEBF0] bg-white px-4 py-8 text-center text-[12.5px] text-[#8E8E93]">
              様式2を読み込んでいます…
            </div>
          )}
        </div>
      </section>

      {/* 右（約40%）: 各項目から考えたこと → 私が捉えた患者さん → Compass Coach（問いのみ）。 */}
      <aside
        aria-label="患者理解（意味づけ）"
        className="flex min-h-0 basis-[40%] flex-col overflow-y-auto overscroll-contain bg-white"
      >
        <div className="space-y-4 px-4 py-5">
          {/* 1. 各項目から考えたこと（様式2 各項目の意味づけ・自動保存） */}
          <Form2ReflectionSection
            patientId={patient.id}
            data={data}
            hydrated={hydrated}
          />

          {/* 2. 各項目の考察を読み返し、患者さんの全体像を自分の言葉で統合する（自動保存）。 */}
          <PatientOverviewEditor patientId={patient.id} />

          {/* 3. Compass Coach: 考察を深める問いのみ（答え・回答例・推測文は出さない）。折りたたみ可能。 */}
          <CoachPrompts />
        </div>
      </aside>
    </div>
  );
}

// Compass Coach（問いのみ・折りたたみ可能）。静的・決定論の問いを提示するだけで、
// 答え・回答例・推測文・観察項目・様式2 転記文は出さない。初期状態は開いた状態。
function CoachPrompts() {
  const [open, setOpen] = useState(true);
  const questions = getQuestionsForCase();
  return (
    <section
      aria-label="Compass Coach"
      className="overflow-hidden rounded-2xl border border-[#E4DAF7] bg-[#FBFAFF]"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-4 py-3 text-left transition-colors hover:bg-[#F5F1FE]"
      >
        <Sparkles className="h-4 w-4 text-[#AF52DE]" strokeWidth={2} />
        <h2 className="text-[13px] font-bold text-[#6B3FA0]">Compass Coach</h2>
        <span className="ml-auto text-[#AF52DE]/70">
          {open ? (
            <ChevronDown className="h-4 w-4" strokeWidth={2} />
          ) : (
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          )}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="mb-2.5 text-[11.5px] leading-relaxed text-[#8E8E93]">
            答えではなく、考察を深めるための問いです。気になる問いから考えてみましょう。
          </p>
          <ul className="space-y-1.5">
            {questions.map((q) => (
              <li
                key={q.id}
                className="rounded-xl border border-[#EBE4F7] bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[#3A3A3C]"
              >
                {q.prompt}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
