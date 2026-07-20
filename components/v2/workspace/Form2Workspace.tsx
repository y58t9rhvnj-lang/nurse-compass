"use client";

// Compass Version2 — 様式2 Workspace（Form2 Workspace）。
//
// 設計（docs/version2/13_ui_architecture.md §4.1 / 16_workspace_mockups.md §3）:
//   3 カラム構成の「様式2 フェーズ専用の思考空間」。主役は様式2。
//     左  = 患者情報（患者トップを起点に、電子カルテ・患者との会話へアクセスできる一次情報の参照領域）
//     中央 = 様式2 のみ（Workspace の主役。Evidence も Compass Note も中央に置かない）
//     右  = Learning Inspector（Coach / Compass Note のタブ）。器は上位（LearningLayer）が
//           sibling として重畳するため、本コンポーネントは左＋中央のみを描画する。
//
// Evidence について（設計 §4.1 / §4.2）:
//   Evidence は本 Workspace の主役ではないため、ここでは表示しない（様式3 Workspace で扱う）。
//   内部実装（EvidencePane / useEvidenceSupabase / informationCards）は削除せず残す（表示のみ変更）。
//
// 移行元: 旧 ClinicalWorkspace（左 Evidence ／ 右 様式2）。本 Sprint（Form2 Workspace Migration）で
//   設計どおりのレイアウト（左 患者情報 ／ 中央 様式2）へ移行し、名称も Form2 Workspace へ改める。
//
// レスポンシブ（旧 ClinicalWorkspace の実績パターンを踏襲）:
//   lg 以上（PC / iPad 横）: 左（患者情報）と中央（様式2）を横並び。各ペイン内で独立スクロール。
//   <lg（iPad 縦・狭幅）    : 「患者情報 / 様式2」セグメント切替。両ペインを常時 mount し
//                            CSS の可視切替のみで行う（様式2 を再マウントしない＝入力・保存・スクロール保持）。

import { useState } from "react";
import { ClipboardList, User } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import StudentPatientTop from "@/components/v2/student-shell/StudentPatientTop";
import WorkspaceForm2Section from "./WorkspaceForm2Section";

type Pane = "info" | "form2";

export default function Form2Workspace({
  patient,
  userId,
  initialForm2,
  onForm2Persisted,
  onOpenChart,
  onOpenConversation,
}: {
  patient: Patient;
  userId: string;
  // 様式2 の初期表示（AppShell のセッション snapshot 優先・無ければサーバ値）。保存の正は Supabase。
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // 左カラム（患者情報）からの一次情報アクセス。既存 Core ビューへ遷移する（現行導線を再利用）。
  onOpenChart: () => void;
  onOpenConversation: () => void;
}) {
  // 中央（様式2）が主役。狭幅では 患者情報 / 様式2 を切替（両方 mount 維持で入力・スクロールを保持）。
  const [pane, setPane] = useState<Pane>("form2");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F2F2F7]">
      {/* 狭幅用セグメント（患者情報 / 様式2）。lg 以上では非表示。 */}
      <div className="no-print flex shrink-0 gap-1 border-b border-[#E5E5EA] bg-white px-3 py-2 lg:hidden">
        <SegButton
          active={pane === "info"}
          onClick={() => setPane("info")}
          icon={<User className="h-4 w-4" strokeWidth={2} />}
          label="患者情報"
        />
        <SegButton
          active={pane === "form2"}
          onClick={() => setPane("form2")}
          icon={<ClipboardList className="h-4 w-4" strokeWidth={2} />}
          label="様式2"
        />
      </div>

      {/* 2ペイン本体。lg 以上=横並び（左 患者情報 / 中央 様式2）/ <lg=可視切替（両ペイン mount 維持）。 */}
      <div className="flex min-h-0 flex-1">
        {/* 左: 患者情報（患者トップ起点・電子カルテ/会話へアクセス） */}
        <section
          aria-label="患者情報"
          className={[
            "min-h-0 flex-col overflow-y-auto overscroll-contain bg-white",
            pane === "info" ? "flex flex-1" : "hidden",
            "lg:flex lg:w-[30%] lg:max-w-[380px] lg:flex-none lg:border-r lg:border-[#E5E5EA]",
          ].join(" ")}
        >
          <StudentPatientTop
            patient={patient}
            onOpenChart={onOpenChart}
            onOpenConversation={onOpenConversation}
            // Workspace 内では既に様式2 が中央にあるため、狭幅では様式2 ペインへ切替える。
            onOpenForm2={() => setPane("form2")}
          />
        </section>

        {/* 中央: 様式2（主役） */}
        <section
          aria-label="様式2"
          className={[
            "min-h-0 flex-col overflow-y-auto overscroll-contain bg-[#F2F2F7]",
            pane === "form2" ? "flex flex-1" : "hidden",
            "lg:flex lg:flex-1",
          ].join(" ")}
        >
          <div className="mx-auto w-full max-w-[900px] px-4 py-5">
            <header className="no-print mb-3">
              <h2 className="text-[15px] font-bold text-[#1D1D1F]">
                精神様式2 受け持ち対象記録
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
                左の患者情報（電子カルテ・患者との会話）を参照しながら、受け持ち対象記録へ整理します。自動保存されます。
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
    </div>
  );
}

function SegButton({
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
        "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] transition",
        active
          ? "bg-[#1D1D1F] font-semibold text-white"
          : "bg-white text-[#3A3A3C] hover:bg-[#F2F2F5]",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}
