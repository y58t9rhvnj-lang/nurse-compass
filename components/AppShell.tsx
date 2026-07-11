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
import CompassPatient from "@/components/patient/compass/CompassPatient";
import CompassAside from "@/components/patient/compass/CompassAside";
import type { CompassNavTarget } from "@/components/patient/compass/CompassNav";
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

  const selectedPatient = PATIENTS[selectedId];

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
  const goChart = () => {
    setNotice(null);
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
  // 気づきメモへスクロール＋フォーカス（問い文なし）。空文字で文脈バナーは非表示。
  const focusNotes = () => setPendingQuestion({ text: "", token: Date.now() });
  const handleCompassNav = (target: CompassNavTarget) => {
    if (target === "電子カルテ") {
      goChart();
      return;
    }
    if (target === "メモ") {
      focusNotes();
      return;
    }
    setNotice(`${target} は次のSprintで実装予定です`);
  };
  const handleSideNav = (view: AppView) => {
    if (view === "ward") goWard();
    else if (view === "patient") goPatientTop();
    else if (view === "chart") goChart();
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
                <CompassChart patient={selectedPatient} />
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
                    <CompassPatient
                      patient={selectedPatient}
                      onBack={goWard}
                      pendingQuestion={pendingQuestion}
                      onClearPendingQuestion={clearPendingQuestion}
                    />
                  </div>
                </div>
              )}
            </main>

            {/* 右ペイン */}
            <aside className="w-[288px] shrink-0 border-l border-[#E5E5EA] bg-white">
              {activeView === "ward" ? (
                <WardRightPanel
                  patient={selectedPatient}
                  onPatientTopRequest={goPatientTop}
                />
              ) : (
                <CompassAside
                  patient={selectedPatient}
                  onUseQuestion={useQuestionForNote}
                  onNavigate={handleCompassNav}
                />
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
