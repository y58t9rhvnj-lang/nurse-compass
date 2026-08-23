"use client";

// Compass Version2 — Patient Understanding Workspace（Sprint D-3A / 患者理解画面）。
//
// 学習フロー:
//   電子カルテ → Compassノート（情報収集） → 様式2（情報整理） → 患者理解（情報の意味づけ）
//     → 私が捉えた患者さん
//   患者理解画面は「様式2を見ながら考える」場。整理工程（Compassノート整理・気づき整理）を重複させない。
//
// Round 3: Form2Workspace の Shell 2ペインでは layout="formOnly"。
//   左ペイン（様式2プレビュー）は Form2ReadonlyPreviewPane が担当。
//   standalone（旧 evidence-review）は layout="split" で従来の左右分割を維持。

import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { Form2Data } from "@/lib/form2/form2Types";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import { useForm2Supabase } from "@/hooks/v2/useForm2Supabase";
import { getQuestionsForCase } from "@/lib/v2/question/questionFixtures";
import Form2SheetView from "@/components/form2/Form2SheetView";
import Form2ReflectionSection from "./Form2ReflectionSection";
import PatientOverviewEditor from "./PatientOverviewEditor";

export type EvidenceReviewLayout = "split" | "formOnly";

export type EvidenceReviewBodyProps = {
  patientId: string;
  data: Form2Data;
  hydrated: boolean;
  /** split=自前で様式2+フォーム / formOnly=記入のみ（Shell 左が様式2） */
  layout?: EvidenceReviewLayout;
  /** standalone のときだけヘッダー戻るを出す（embedded は Shell 側） */
  showBackButton?: boolean;
  onBackToWorkspace?: () => void;
  className?: string;
};

function UnderstandingFormColumns({
  patientId,
  data,
  hydrated,
  showIntro = false,
}: {
  patientId: string;
  data: Form2Data;
  hydrated: boolean;
  showIntro?: boolean;
}) {
  return (
    <div className="space-y-4 px-4 py-5">
      {showIntro ? (
        <header className="no-print">
          <h2 className="text-[15px] font-bold text-[#1D1D1F]">
            患者理解を深める
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
            様式2を見ながら、各項目について考えたことを整理し、最後に患者さんの全体像を統合します。
          </p>
        </header>
      ) : null}
      <Form2ReflectionSection
        patientId={patientId}
        data={data}
        hydrated={hydrated}
      />
      <PatientOverviewEditor patientId={patientId} />
      <CoachPrompts />
    </div>
  );
}

/** 患者理解の本体。Shell 内外で共用。 */
export function EvidenceReviewBody({
  patientId,
  data,
  hydrated,
  layout = "split",
  showBackButton = false,
  onBackToWorkspace,
  className = "",
}: EvidenceReviewBodyProps) {
  if (layout === "formOnly") {
    return (
      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-white ${className}`.trim()}
        data-evidence-review=""
        data-evidence-layout="formOnly"
      >
        <UnderstandingFormColumns
          patientId={patientId}
          data={data}
          hydrated={hydrated}
          showIntro
        />
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-0 flex-1 overflow-hidden bg-[#F2F2F7] ${className}`.trim()}
      data-evidence-review=""
      data-evidence-layout="split"
    >
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
            {showBackButton && onBackToWorkspace ? (
              <button
                type="button"
                onClick={onBackToWorkspace}
                className="no-print inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D1D1D6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#3A3A3C] transition hover:bg-[#F2F2F5]"
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
                様式2へ戻る
              </button>
            ) : null}
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

      <aside
        aria-label="患者理解（意味づけ）"
        className="flex min-h-0 basis-[40%] flex-col overflow-y-auto overscroll-contain bg-white"
      >
        <UnderstandingFormColumns
          patientId={patientId}
          data={data}
          hydrated={hydrated}
        />
      </aside>
    </div>
  );
}

export default function EvidenceReviewWorkspace({
  patient,
  userId,
  initialForm2,
  onBackToWorkspace,
}: {
  patient: Patient;
  userId: string;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  onBackToWorkspace: () => void;
}) {
  const { data, hydrated } = useForm2Supabase({
    patientId: patient.id,
    userId,
    initial: initialForm2,
  });

  return (
    <EvidenceReviewBody
      patientId={patient.id}
      data={data}
      hydrated={hydrated}
      layout="split"
      showBackButton
      onBackToWorkspace={onBackToWorkspace}
    />
  );
}

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
