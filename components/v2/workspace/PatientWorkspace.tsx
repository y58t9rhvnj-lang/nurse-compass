"use client";

// Compass Version2 Sprint1 — Patient Workspace（Compass 最大画面）。
//
// One Workspace 原則: 学生の思考が 1 画面（縦フロー）で完結するよう構成する。
//   Header → Timeline → 会話(Evidence 収集) + Compass Coach → Evidence → Form2
//
// Sprint1 スコープ: Timeline / Evidence / Compass Coach / Form2 のみ。
//   Question / Reflection / Story Workspace / Patient Story は Sprint2（Architecture Freeze）。
//
// 再利用（V1 は改変しない）:
//   ・FacingPatient    … 患者との対話（Evidence の収集経路の一つ）
//   ・FacingCoachPanel … Compass Coach（問いを返すのみ。答えは書かない）
//   ・Form2EditForm / Form2SheetView … 精神様式2
// 保存の正は Supabase（Evidence: information_cards / Form2: form2_records）。

import { useCallback, useRef, useState } from "react";
import { ClipboardList, Compass, MessagesSquare } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import {
  type FacingConvoState,
  initialFacingState,
} from "@/lib/patientFacingData";
import type { InformationCard } from "@/lib/information/informationCard";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import FacingPatient from "@/components/patient/facing/FacingPatient";
import { useEvidenceSupabase } from "@/hooks/v2/useEvidenceSupabase";
import { useWorkspaceInspector } from "@/hooks/v2/useWorkspaceInspector";
import { useQuestionPanel } from "@/hooks/v2/useQuestionPanel";
import { getQuestionsForCase } from "@/lib/v2/question/questionFixtures";
import WorkspaceTimeline from "./WorkspaceTimeline";
import WorkspaceCoachPanel from "./WorkspaceCoachPanel";
import EvidencePane from "./EvidencePane";
import WorkspaceForm2Section from "./WorkspaceForm2Section";
import WorkspaceInspector from "./inspector/WorkspaceInspector";
import WorkspaceInspectorToggle from "./inspector/WorkspaceInspectorToggle";
import QuestionPanel from "./panels/QuestionPanel";

export default function PatientWorkspace({
  patient,
  userId,
  initialEvidence,
  initialForm2,
}: {
  patient: Patient;
  userId: string;
  initialEvidence: InformationCard[];
  initialForm2: Form2Snapshot | null;
}) {
  const [facingState, setFacingState] = useState<FacingConvoState>(() =>
    initialFacingState(),
  );
  const [conversationOpen, setConversationOpen] = useState(false);

  const evidence = useEvidenceSupabase({
    patientId: patient.id,
    initial: initialEvidence,
  });

  // 学習支援（Workspace Inspector）の開閉 state。Workspace 本体の state とは分離し、
  // 開閉しても会話・Evidence・様式2・スクロール位置を壊さない（CWDS §3/§4）。
  const inspector = useWorkspaceInspector();

  // Question（問い）は静的・決定論。選択・状態は Workspace 側で保持し、
  // Inspector を閉じても失わない（DB 保存はしない・リロードでリセット）。
  const questions = getQuestionsForCase();
  const questionPanel = useQuestionPanel();

  // フォーカス復帰用: トリガーボタンの ref。Close/Esc/背景タップで閉じたときは
  // トリガーへフォーカスを戻す（トグル自身で閉じたときはボタン上に残る）。
  const triggerRef = useRef<HTMLButtonElement>(null);
  const handleInspectorClose = useCallback(() => {
    inspector.close();
    // preventScroll: フォーカスを戻す際に Workspace のスクロール位置を動かさない
    // （フォーカス復帰とスクロール保持を両立する）。
    window.setTimeout(
      () => triggerRef.current?.focus({ preventScroll: true }),
      0,
    );
  }, [inspector]);

  return (
    // V1 アプリシェルは globals.css で html,body を height:100dvh + overflow:hidden に
    // 固定している。body スクロールに頼らず、このワークスペース専用の内部スクロール枠を
    // 設けることで、V1 の固定レイアウトを壊さずに全セクション（Timeline〜Form2）へ到達できる。
    // Inspector（補助領域）は lg 以上でこの flex 行の右にドックし、本体と横に共存する。
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[#F2F2F7]">
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        <div className="h-full min-h-0 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-8">
            {/* Header */}
            <header className="no-print rounded-3xl border border-[#EBEBF0] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[#8E8E93]">受け持ち対象</p>
                  <h1 className="mt-0.5 text-[22px] font-bold text-[#1D1D1F]">
                    {patient.name}
                  </h1>
                  <p className="mt-1 text-[13px] text-[#6E6E73]">
                    {patient.room}号室 ・ {patient.age}歳
                  </p>
                </div>
                <WorkspaceInspectorToggle
                  ref={triggerRef}
                  open={inspector.open}
                  onToggle={() => inspector.toggle("question")}
                />
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#8E8E93]">
                ここは、あなたが患者さんを理解していくためのワークスペースです。
                記録を読み、話を聴き、事実（Evidence）を集めて、様式2へ整理していきましょう。
              </p>
            </header>

        {/* Timeline */}
        <Section
          className="no-print"
          icon={<ClipboardList className="h-4 w-4 text-[#0A6CD6]" strokeWidth={2} />}
          title="Timeline"
          description="診療録と看護記録の経過（新しい順）。ここから事実を読み取りましょう。"
        >
          <WorkspaceTimeline patientId={patient.id} />
        </Section>

        {/* 会話 + Compass Coach */}
        <Section
          className="no-print"
          icon={<MessagesSquare className="h-4 w-4 text-[#0A84FF]" strokeWidth={2} />}
          title="患者さんと話す"
          description="会話は Evidence の大切な収集経路です。気になった発言は Evidence として集められます。"
        >
          <p className="mb-3 rounded-xl bg-[#FFF7E6] px-3.5 py-2.5 text-[12px] leading-relaxed text-[#8A6D3B]">
            会話の内容は、画面を離れたり再読み込みすると残りません。大切だと思った発言は、
            <span className="font-semibold">Evidence として収集</span>して残しましょう。
          </p>
          {conversationOpen ? (
            <div className="space-y-3">
              <div className="h-[560px] overflow-hidden rounded-3xl border border-[#EBEBF0] bg-white">
                <FacingPatient
                  patient={patient}
                  state={facingState}
                  onChange={setFacingState}
                  onBack={() => setConversationOpen(false)}
                />
              </div>
              <WorkspaceCoachPanel
                patient={patient}
                state={facingState}
                onChange={setFacingState}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConversationOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#C7D6EA] bg-white px-4 py-5 text-[13px] font-semibold text-[#0A84FF] transition hover:border-[#0A84FF] hover:bg-[#F2F7FF]"
            >
              <MessagesSquare className="h-4 w-4" strokeWidth={2} />
              患者さんと話す
            </button>
          )}
        </Section>

        {/* Evidence */}
        <Section
          className="no-print"
          icon={<Compass className="h-4 w-4 text-[#34C759]" strokeWidth={2} />}
          title="Evidence"
          description="集めた事実の一覧です。事実だけを残し、解釈は後のステップで整理します。"
        >
          <EvidencePane
            patientId={patient.id}
            history={facingState.history}
            evidence={evidence}
          />
        </Section>

        {/* Form2 */}
        <Section
          icon={<ClipboardList className="h-4 w-4 text-[#6B3FA0]" strokeWidth={2} />}
          title="精神様式2 受け持ち対象記録"
          description="集めた事実を見ながら、受け持ち対象記録へ整理します。自動保存されます。"
        >
          <WorkspaceForm2Section
            patientId={patient.id}
            userId={userId}
            initial={initialForm2}
          />
        </Section>
          </div>
        </div>
      </div>

      {/* 学習支援（補助領域）。開いている時だけ描画する。lg 以上は右にドックし、
          <lg では下シートになる。閉じても Workspace 本体・Question の state は失われない。
          器は汎用（children）。現状のパネルは Question のみ（将来 activePanel で切替）。 */}
      {inspector.open && (
        <WorkspaceInspector title="学習支援" onClose={handleInspectorClose}>
          <QuestionPanel questions={questions} controller={questionPanel} />
        </WorkspaceInspector>
      )}
    </div>
  );
}

const Section = function Section({
  icon,
  title,
  description,
  className = "",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mt-6 scroll-mt-4 ${className}`}>
      <div className="mb-2.5 flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F2F2F7]">
          {icon}
        </span>
        <div>
          <h2 className="text-[15px] font-bold text-[#1D1D1F]">{title}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
            {description}
          </p>
        </div>
      </div>
      <div className="rounded-3xl border border-[#EBEBF0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {children}
      </div>
    </section>
  );
};
