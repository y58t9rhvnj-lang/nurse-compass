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
import { X } from "lucide-react";
import Notice from "@/components/Notice";
import WorkspaceHost, {
  type LearningWorkspaceView,
} from "@/components/v2/learning/workspace/WorkspaceHost";
import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { FacingConvoState } from "@/lib/patientFacingData";

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
  initialForm2,
  onForm2Persisted,
  onOpenEvidenceReview,
  facingState,
  onChangeFacingState,
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
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // 第2段階「Evidence 整理」ビューへの導線（様式2 ヘッダーの控えめなボタン）。
  onOpenEvidenceReview?: () => void;
  // 会話（患者との会話）の状態。Workspace 左ペインの「会話」タブが Core と同一 state を共有する。
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
}) {
  // 思考ワークスペースを開いたときの案内メッセージ（Sprint D-2D ③）。
  //   主ボタンは「閉じる」= メッセージのみを閉じ、そのまま思考ワークスペースを表示する
  //   （患者トップ・病棟ホームへは遷移しない）。右上の × も同じ動作。
  //   onBackToTarget は受け持ち患者を選択状態にして本ワークスペースを表示するだけで、画面遷移は行わない。
  const lockedView = (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6">
      <div className="relative w-full max-w-[440px] rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center shadow-sm">
        <button
          type="button"
          onClick={onBackToTarget}
          aria-label="閉じる"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-[#8E8E93] transition-colors hover:bg-[#F2F2F5]"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
        <h2 className="text-[15px] font-bold text-[#1D1D1F]">
          思考ワークスペース
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
          電子カルテや会話で集めた情報と Compassノートを見ながら、
          <br />
          受け持ち患者について様式2 へ整理していきましょう。
        </p>
        <button
          type="button"
          onClick={onBackToTarget}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0A5FCC] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0A54B5]"
        >
          閉じる
        </button>
      </div>
    </div>
  );

  // 様式2 Workspace は両ビュー（clinical-workspace / form2）で同一。未ログイン案内も統一する。
  const loginMessage = "様式2 Workspace を表示するにはログインが必要です。";

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
            initialForm2={initialForm2}
            onForm2Persisted={onForm2Persisted}
            onOpenEvidenceReview={onOpenEvidenceReview}
            facingState={facingState}
            onChangeFacingState={onChangeFacingState}
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
