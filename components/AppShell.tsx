"use client";

import { useState } from "react";
import OutsideWardArea from "@/components/OutsideWardArea";
import SideNav, { type AppView } from "@/components/SideNav";
import WardMap from "@/components/WardMap";
import WardRightPanel from "@/components/WardRightPanel";
import WardHomeTopBar from "@/components/ward/WardHomeTopBar";
import CompassChart from "@/components/chart/CompassChart";
import ChartAside from "@/components/chart/ChartAside";
import ChartSideNav from "@/components/chart/ChartSideNav";
import FacingPatient from "@/components/patient/facing/FacingPatient";
import FacingCoachPanel from "@/components/patient/facing/FacingCoachPanel";
import NoteZone from "@/components/patient/notes/NoteZone";
import ClinicalThinkingWorkspace from "@/components/thinking-workspace/ClinicalThinkingWorkspace";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";
import {
  type FacingConvoState,
  initialFacingState,
} from "@/lib/patientFacingData";
import { DEFAULT_PATIENT_ID, PATIENTS } from "@/lib/wardData";

// Compass の問い → 気づきメモへの誘導用。token でクリック毎に再フォーカス/スクロールを発火させる。
type PendingQuestion = { text: string; token: number };

export default function AppShell() {
  const [activeView, setActiveView] = useState<AppView>("ward");
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PATIENT_ID);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(
    null,
  );
  // 患者画面の Compass Coach 導線から開いたときの電子カルテ初期タブ／フォーカス。
  const [chartInitialTab, setChartInitialTab] = useState<ChartTabId | undefined>(
    undefined,
  );
  const [chartInitialFocus, setChartInitialFocus] = useState<
    ChartFocus | undefined
  >(undefined);
  // 「患者と向き合う」会話状態を患者別に保持。カルテ往復しても維持し、患者ごとに独立。
  const [facingConvos, setFacingConvos] = useState<
    Record<string, FacingConvoState>
  >({});

  const selectedPatient = PATIENTS[selectedId];
  const facingState = facingConvos[selectedId] ?? initialFacingState();
  const setFacingState = (next: FacingConvoState) =>
    setFacingConvos((prev) => ({ ...prev, [selectedId]: next }));

  const goPatientTop = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("patient");
  };
  const goWard = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("ward");
  };
  // 情報整理ノート（Clinical Thinking Workspace）。現在の患者を保持したまま遷移する。
  const goWorkspace = () => {
    setNotice(null);
    setPendingQuestion(null);
    setActiveView("workspace");
  };
  // 電子カルテを開く。tab 指定時はそのタブから、focus 指定時は該当記録へ移動・強調。
  const goChart = (tab?: ChartTabId, focus?: ChartFocus) => {
    setNotice(null);
    setChartInitialTab(tab);
    setChartInitialFocus(focus);
    setActiveView("chart");
  };
  // 患者切替時は誘導中の問いをクリア
  const selectPatient = (id: string) => {
    setSelectedId(id);
    setPendingQuestion(null);
  };
  const useQuestionForNote = (text: string) => {
    setPendingQuestion({ text, token: Date.now() });
  };
  const clearPendingQuestion = () => setPendingQuestion(null);
  const handleSideNav = (view: AppView) => {
    if (view === "ward") goWard();
    else if (view === "patient") goPatientTop();
    else if (view === "chart") goChart();
    else if (view === "workspace") goWorkspace();
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[#EDEDF0] text-[#1D1D1F]">
      <div className="flex min-h-0 flex-1">
        {activeView === "chart" ? (
          <>
            {/* 電子カルテ専用左メニュー */}
            <aside className="w-[168px] shrink-0 border-r border-[#E5E5EA]">
              <ChartSideNav
                onBackToCompass={goPatientTop}
                onMenuSelect={(item) => {
                  if (item !== "カルテ画面") {
                    setNotice(
                      `「${item}」は準備中です。情報は上部のタブから確認できます。`,
                    );
                  }
                }}
              />
            </aside>

            {/* 電子カルテ中央 */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {notice && (
                <div className="shrink-0 px-3 pt-2">
                  <Notice text={notice} onClose={() => setNotice(null)} />
                </div>
              )}
              <div className="flex min-h-0 flex-1 flex-col">
                <CompassChart
                  patient={selectedPatient}
                  initialTab={chartInitialTab}
                  initialFocus={chartInitialFocus}
                />
              </div>
            </main>

            {/* 右ペイン（補助） */}
            <aside className="w-[240px] shrink-0 border-l border-[#E5E5EA] bg-white">
              <ChartAside
                patient={selectedPatient}
                pendingQuestion={pendingQuestion}
                onClearPendingQuestion={clearPendingQuestion}
                onUseQuestion={useQuestionForNote}
              />
            </aside>
          </>
        ) : activeView === "workspace" ? (
          <>
            {/* 通常 Compass 左サイドバー */}
            <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
              <SideNav activeView={activeView} onNavigate={handleSideNav} />
            </aside>

            {/* 情報整理ノート（3領域は Workspace 内で構成） */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <ClinicalThinkingWorkspace
                patient={selectedPatient}
                onBack={goPatientTop}
              />
            </main>
          </>
        ) : (
          <>
            {/* 通常 Compass 左サイドバー */}
            <aside className="w-[204px] shrink-0 border-r border-[#E5E5EA] bg-white">
              <SideNav activeView={activeView} onNavigate={handleSideNav} />
            </aside>

            {/* 中央メイン */}
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {activeView === "ward" ? (
                <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3.5">
                  {notice && (
                    <Notice text={notice} onClose={() => setNotice(null)} />
                  )}
                  <WardHomeTopBar />
                  <WardMap
                    selectedId={selectedId}
                    onSelectPatient={selectPatient}
                  />
                  <OutsideWardArea />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {notice && (
                    <div className="px-5 pt-3">
                      <Notice text={notice} onClose={() => setNotice(null)} />
                    </div>
                  )}
                  <div className="min-h-0 flex-1">
                    <FacingPatient
                      patient={selectedPatient}
                      onBack={goWard}
                      state={facingState}
                      onChange={setFacingState}
                      onOpenWorkspace={goWorkspace}
                    />
                  </div>
                </div>
              )}
            </main>

            {/* 右ペイン（288px） */}
            <aside className="w-[288px] shrink-0 border-l border-[#E5E5EA] bg-white">
              {activeView === "ward" ? (
                <WardRightPanel
                  patient={selectedPatient}
                  onPatientTopRequest={goPatientTop}
                />
              ) : (
                // Sprint10.8A（修正）: 主役は NoteZone（情報整理ノートの前身）。
                // Compass Coach はその下にコンパクトな補助ウィジェットとして配置する。
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    <NoteZone patientId={selectedId} />
                  </div>
                  <div className="shrink-0">
                    <FacingCoachPanel
                      patient={selectedPatient}
                      state={facingState}
                      onChange={setFacingState}
                      onOpenChart={goChart}
                    />
                  </div>
                </div>
              )}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

function Notice({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between rounded-2xl bg-[#EAF3FF] px-4 py-2">
      <p className="text-xs font-medium text-[#0A5FCC]">{text}</p>
      <button
        type="button"
        onClick={onClose}
        className="min-h-[44px] text-[11px] text-[#6E6E73] hover:text-[#1D1D1F]"
      >
        閉じる
      </button>
    </div>
  );
}
