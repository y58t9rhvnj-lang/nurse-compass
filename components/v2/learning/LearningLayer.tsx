"use client";

// Compass Version2 — Learning Layer（Architecture Migration / Sprint A）。
//
// 目標構成（設計 13/16）:
//   AppShell → Learning Layer（Workspace ＋ Learning Inspector）。
//   Learning Layer は「学習支援のみ」を担当し、Core（患者情報・電子カルテ・会話）を混在させない。
//
// 責務（この層）:
//   ・学習画面の共通シェル（サイドバー ＋ 中央 ＋ Learning Inspector の重畳）。
//   ・受け持ち患者ガード（受け持ち以外は実データを描画せず案内を出す）。
//   ・未ログイン時の案内。
//   中央（主役）の中身は WorkspaceHost が種別ごとに差し替える（責務分離）。
//
// 挙動・DOM は Architecture Migration 前の AppComponent と同一（UI 変更なし）。
//   Inspector の状態（open / activePanel / width）は上位 AppShell が保持し、
//   本層はその成果物（inspectorHeader / inspectorOverlay ノード）を配置するのみ。

import type { ReactNode } from "react";
import Notice from "@/components/Notice";
import WorkspaceHost, {
  type LearningWorkspaceView,
} from "@/components/v2/learning/workspace/WorkspaceHost";
import type { Patient } from "@/lib/wardData";
import type { FacingEntry } from "@/lib/patientFacingData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { UseEvidenceSupabaseResult } from "@/hooks/v2/useEvidenceSupabase";

export default function LearningLayer({
  view,
  sideNav,
  notice,
  onCloseNotice,
  inspectorHeader,
  inspectorOverlay,
  isTargetPatient,
  onBackToTarget,
  userId,
  patient,
  evidence,
  initialForm2,
  onForm2Persisted,
  facingHistory,
}: {
  view: LearningWorkspaceView;
  sideNav: ReactNode;
  notice: string | null;
  onCloseNotice: () => void;
  // Learning Inspector の器（開閉トグル / オーバーレイ）。状態は上位 AppShell が保持する。
  inspectorHeader: ReactNode;
  inspectorOverlay: ReactNode;
  // 受け持ち患者ガード。false（他患者選択中）は実データを描画しない。
  isTargetPatient: boolean;
  onBackToTarget: () => void;
  userId?: string;
  patient: Patient;
  evidence: UseEvidenceSupabaseResult;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  facingHistory: FacingEntry[];
}) {
  // 他患者選択中に Learning 画面へ進んだときの案内（受け持ち患者へ戻る導線のみ）。
  const lockedView = (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center shadow-sm">
        <h2 className="text-[15px] font-bold text-[#1D1D1F]">
          受け持ち患者の学習画面です
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
          思考ワークスペースと様式は、受け持ち患者について利用できます。
          <br />
          受け持ち患者に戻って、情報を振り返りましょう。
        </p>
        <button
          type="button"
          onClick={onBackToTarget}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0A5FCC] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0A54B5]"
        >
          受け持ち患者に戻る
        </button>
      </div>
    </div>
  );

  const loginMessage =
    view === "clinical-workspace"
      ? "思考ワークスペースを表示するにはログインが必要です。"
      : "様式2 を表示するにはログインが必要です。";

  return (
    <>
      {sideNav}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {notice && (
          <div className="shrink-0 px-4 pt-3">
            <Notice text={notice} onClose={onCloseNotice} />
          </div>
        )}
        {inspectorHeader}
        {!isTargetPatient ? (
          lockedView
        ) : userId ? (
          <WorkspaceHost
            view={view}
            patient={patient}
            userId={userId}
            evidence={evidence}
            initialForm2={initialForm2}
            onForm2Persisted={onForm2Persisted}
            facingHistory={facingHistory}
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-[13px] text-[#6E6E73]">
            {loginMessage}
          </div>
        )}
      </main>
      {inspectorOverlay}
    </>
  );
}
