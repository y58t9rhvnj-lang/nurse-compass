"use client";

// Compass Version2 — 様式2 Workspace（Form2 Workspace / Learning Workspace の中核）。
//
// 設計（docs/version2/13_ui_architecture.md §4.1 / 16_workspace_mockups.md §3 / Sprint D-1）:
//   3 カラム構成の「様式2 フェーズ専用の思考空間」。主役は様式2で、常に中央に表示し続ける。
//     左  = 参照領域。患者情報 / 電子カルテ / 会話 を「左ペイン内だけ」で切り替える
//           （画面遷移はしない）。3 つとも常時 mount し、CSS の可視切替のみで行う
//           ＝ 電子カルテのタブ位置・会話の状態・スクロールを失わない。
//     中央 = 様式2 のみ（Workspace First。どの操作でも閉じない／隠さない）。
//     右  = Learning Inspector（Coach / Compass Note）。器は上位（LearningLayer）が
//           sibling として重畳するため、本コンポーネントは左＋中央のみを描画する。
//
// 幅（Sprint D-1 ⑦）:
//   左ペインは維持し、Inspector 開閉で縮小するのは中央（様式2）のみ。
//   そのため左ペインは固定幅（lg 以上）とし、中央を flex-1（残り幅を吸収）にする。
//   Inspector（sibling・固定幅）が開くと main が縮み、flex-1 の中央だけが縮む。
//
// 電子カルテ（Sprint D-1 ⑥）:
//   CompassChart は initialTab 未指定で常に「診療録」から開始する。key={patient.id} で
//   患者切替時は再マウントし、必ず診療録から開始する（タブ未選択状態は発生しない）。
//
// Evidence について（設計 §4.1 / §4.2）:
//   Evidence は本 Workspace の主役ではないため表示しない（様式3 Workspace で扱う）。
//   内部実装（EvidencePane / useEvidenceSupabase）は削除せず残す（表示のみ変更）。

import { useState } from "react";
import { FileText, MessagesSquare } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { FacingConvoState } from "@/lib/patientFacingData";
import CompassChart from "@/components/chart/CompassChart";
import WorkspaceConversation from "./WorkspaceConversation";
import WorkspaceForm2Section from "./WorkspaceForm2Section";

// 左ペインの参照タブ（画面遷移ではなくペイン内切替）。患者基本情報は患者トップで確認する役割とし、
// ワークスペース左では重複表示しない（Sprint D-1 追加修正2 ③）。
type RefTab = "chart" | "conversation";

export default function Form2Workspace({
  patient,
  userId,
  initialForm2,
  onForm2Persisted,
  facingState,
  onChangeFacingState,
}: {
  patient: Patient;
  userId: string;
  // 様式2 の初期表示（AppShell のセッション snapshot 優先・無ければサーバ値）。保存の正は Supabase。
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // 会話（患者との会話）の状態。Core の会話画面と同一 state を共有する（AppShell が患者別に保持）。
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
}) {
  // 左ペインの参照タブ。既定は電子カルテ（診療録本文の閲覧が起点）。
  const [refTab, setRefTab] = useState<RefTab>("chart");

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#F2F2F7]">
      {/* 左: 参照領域（電子カルテ / 会話をペイン内で切替）。読みやすさ優先で幅を広く確保
          （Desktop 約32% / iPad 約320px）。Inspector 開閉で縮小するのは中央のみ。 */}
      <section
        aria-label="参照"
        className="flex min-h-0 w-[300px] shrink-0 flex-col border-r border-[#E5E5EA] bg-white lg:w-[320px] xl:w-[380px]"
      >
        {/* ペイン内タブ（電子カルテ / 会話） */}
        <div className="no-print flex shrink-0 gap-1 border-b border-[#E5E5EA] bg-white px-2 py-2">
          <RefTabButton
            active={refTab === "chart"}
            onClick={() => setRefTab("chart")}
            icon={<FileText className="h-4 w-4" strokeWidth={2} />}
            label="電子カルテ"
          />
          <RefTabButton
            active={refTab === "conversation"}
            onClick={() => setRefTab("conversation")}
            icon={<MessagesSquare className="h-4 w-4" strokeWidth={2} />}
            label="会話"
          />
        </div>

        {/* 電子カルテ（Workspace 内は embedded 簡略表示: 水色バー無し・タブ compact・本文優先）。
            常に診療録から開始。患者切替時は key で再マウントし診療録へ戻す。 */}
        <div
          className={
            refTab === "chart"
              ? "flex min-h-0 flex-1 flex-col"
              : "hidden"
          }
        >
          <CompassChart key={patient.id} patient={patient} embedded />
        </div>

        {/* 患者との会話（Core と同一 state を共有）。会話履歴を主役にした簡略ビュー。 */}
        <div
          className={
            refTab === "conversation"
              ? "flex min-h-0 flex-1 flex-col"
              : "hidden"
          }
        >
          <WorkspaceConversation
            patient={patient}
            state={facingState}
            onChange={onChangeFacingState}
          />
        </div>
      </section>

      {/* 中央: 様式2（主役・常に表示）。Inspector 開閉で縮小するのはこの列のみ。 */}
      <section
        aria-label="様式2"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-[#F2F2F7]"
      >
        <div className="mx-auto w-full max-w-[900px] px-4 py-5">
          <header className="no-print mb-3">
            <h2 className="text-[15px] font-bold text-[#1D1D1F]">
              精神様式2 受け持ち対象記録
            </h2>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
              左の電子カルテ・患者との会話を参照しながら、受け持ち対象記録へ整理します。自動保存されます。
            </p>
          </header>
          <WorkspaceForm2Section
            patientId={patient.id}
            userId={userId}
            initial={initialForm2}
            onPersisted={onForm2Persisted}
          />
        </div>
      </section>
    </div>
  );
}

function RefTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] transition",
        active
          ? "bg-[#1D1D1F] font-semibold text-white"
          : "bg-white text-[#3A3A3C] hover:bg-[#F2F2F5]",
      ].join(" ")}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}
