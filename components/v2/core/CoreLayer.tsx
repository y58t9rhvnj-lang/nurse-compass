"use client";

// Compass Version2 — Core Layer（Architecture Migration / Sprint A）。
//
// 目標構成（設計 13/16）:
//   AppShell → Core Layer（Patient / Chart / Conversation）。
//   Core Layer は「臨床世界の閲覧」のみを担い、学習支援（Workspace / Inspector /
//   Coach 学習支援 / Compass Note の学習整理 / Evidence 整理）を混在させない。
//
// 責務（この層）:
//   ・病棟ホーム（ward）… 病棟マップ / 右ペイン。
//   ・患者トップ（patient-top）… 受け持ち患者の入口。
//   ・電子カルテ（chart）… ChartSideNav + CompassChart + ChartAside。
//   ・患者との会話（conversation）… FacingPatient + Compassメモ + Compass Coach。
//   ※ NoteZone（Compassメモ）は Core の会話画面に置くが、その学習整理（Evidence 化）は
//     Learning Layer 側で行う（本層は Core の記録面として配置するのみ）。
//
// 挙動・DOM は Architecture Migration 前の AppShell mode==="v2" 分岐と同一（UI 変更なし）。
//   状態・遷移ハンドラは上位 AppShell が保持し、本層は props 経由で受け取るのみ。

import type { ReactNode } from "react";
import Notice from "@/components/Notice";
import OutsideWardArea from "@/components/OutsideWardArea";
import WardMap from "@/components/WardMap";
import WardRightPanel from "@/components/WardRightPanel";
import WardHomeTopBar from "@/components/ward/WardHomeTopBar";
import CompassChart from "@/components/chart/CompassChart";
import ChartAside from "@/components/chart/ChartAside";
import ChartSideNav from "@/components/chart/ChartSideNav";
import FacingPatient from "@/components/patient/facing/FacingPatient";
import FacingCoachPanel from "@/components/patient/facing/FacingCoachPanel";
import FirstAssignmentSheet from "@/components/patient/FirstAssignmentSheet";
import NoteZone from "@/components/patient/notes/NoteZone";
import StudentPatientTop from "@/components/v2/student-shell/StudentPatientTop";
import type { AppView } from "@/components/SideNav";
import type { Patient } from "@/lib/wardData";
import type { FacingConvoState } from "@/lib/patientFacingData";
import type { ChartTabId } from "@/lib/chartTabs";
import type { ChartFocus } from "@/lib/chartNav";

export default function CoreLayer({
  activeView,
  sideNav,
  notice,
  onNotice,
  onCloseNotice,
  selectedPatient,
  selectedId,
  pendingQuestion,
  onClearPendingQuestion,
  onUseQuestion,
  chartInitialTab,
  chartInitialFocus,
  facingState,
  onChangeFacingState,
  onBackToPatientTop,
  onOpenChart,
  onOpenConversation,
  onOpenForm2,
  onSelectPatientToTop,
}: {
  // ここへ来るのは Core ビューのみ（chart / conversation / patient-top / ward）。
  // それ以外（既定）は病棟ホームとして描画する。
  activeView: AppView;
  sideNav: ReactNode;
  notice: string | null;
  // 電子カルテ左メニューの準備中通知など、Core からの通知表示。
  onNotice: (text: string) => void;
  onCloseNotice: () => void;
  selectedPatient: Patient;
  selectedId: string;
  pendingQuestion: { text: string; token: number } | null;
  onClearPendingQuestion: () => void;
  onUseQuestion: (question: string) => void;
  chartInitialTab?: ChartTabId;
  chartInitialFocus?: ChartFocus;
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
  // 患者トップへ戻る（カルテ戻る / 会話戻る / 右ペイン→患者トップ で共通）。
  onBackToPatientTop: () => void;
  onOpenChart: (tab?: ChartTabId, focus?: ChartFocus) => void;
  onOpenConversation: () => void;
  onOpenForm2: () => void;
  // 病棟マップからの患者選択 → 患者トップへ。
  onSelectPatientToTop: (id: string) => void;
}) {
  if (activeView === "chart") {
    // 電子カルテ: V1 と同じ 3 カラム（専用左メニュー + カルテ + 補助右ペイン）。
    return (
      <>
        <aside className="w-[168px] shrink-0 border-r border-[#E5E5EA]">
          <ChartSideNav
            onBackToCompass={onBackToPatientTop}
            onMenuSelect={(item) => {
              if (item !== "カルテ画面") {
                onNotice(
                  `「${item}」は準備中です。情報は上部のタブから確認できます。`,
                );
              }
            }}
          />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {notice && (
            <div className="shrink-0 px-3 pt-2">
              <Notice text={notice} onClose={onCloseNotice} />
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
        <aside className="w-[240px] shrink-0 border-l border-[#E5E5EA] bg-white">
          <ChartAside
            patient={selectedPatient}
            pendingQuestion={pendingQuestion}
            onClearPendingQuestion={onClearPendingQuestion}
            onUseQuestion={onUseQuestion}
          />
        </aside>
      </>
    );
  }

  if (activeView === "conversation") {
    // 患者との会話: V1 と同じ構成（会話 + Compassメモ NoteZone + Compass Coach）。
    return (
      <>
        {sideNav}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {notice && (
            <div className="px-5 pt-3">
              <Notice text={notice} onClose={onCloseNotice} />
            </div>
          )}
          <div className="min-h-0 flex-1">
            <FacingPatient
              patient={selectedPatient}
              onBack={onBackToPatientTop}
              state={facingState}
              onChange={onChangeFacingState}
            />
          </div>
          <FirstAssignmentSheet patientId={selectedId} />
        </main>
        <aside className="w-[288px] shrink-0 border-l border-[#E5E5EA] bg-white">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <NoteZone patientId={selectedId} />
            </div>
            <div className="shrink-0">
              <FacingCoachPanel
                patient={selectedPatient}
                state={facingState}
                onChange={onChangeFacingState}
                onOpenChart={onOpenChart}
              />
            </div>
          </div>
        </aside>
      </>
    );
  }

  if (activeView === "patient-top") {
    // 患者トップ（V2 ランディング）。電子カルテ・会話・様式2 への入口。
    return (
      <>
        {sideNav}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {notice && (
            <div className="shrink-0 px-4 pt-3">
              <Notice text={notice} onClose={onCloseNotice} />
            </div>
          )}
          <StudentPatientTop
            patient={selectedPatient}
            onOpenChart={() => onOpenChart()}
            onOpenConversation={onOpenConversation}
            onOpenForm2={onOpenForm2}
          />
        </main>
      </>
    );
  }

  // 病棟ホーム（既定・学習起点）: V1 と同じ 3 カラム
  //（SideNav + WardHomeTopBar/WardMap/OutsideWardArea + WardRightPanel）。
  return (
    <>
      {sideNav}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3.5">
          {notice && <Notice text={notice} onClose={onCloseNotice} />}
          <WardHomeTopBar />
          <WardMap selectedId={selectedId} onSelectPatient={onSelectPatientToTop} />
          <OutsideWardArea />
        </div>
      </main>
      <aside className="w-[288px] shrink-0 border-l border-[#E5E5EA] bg-white">
        <WardRightPanel
          patient={selectedPatient}
          onPatientTopRequest={onBackToPatientTop}
        />
      </aside>
    </>
  );
}
