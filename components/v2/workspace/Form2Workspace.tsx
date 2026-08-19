"use client";

// Compass Version2 — 様式2 Workspace（Form2 Workspace / Learning Workspace の中核）。
//
// Phase C2 メモ（FormWorkspaceShell 未接続）:
//   Form2 を Shell に載せる際の必要 props / 障害:
//   - formTitle: 「様式2」（学生向け名称変更は C6）
//   - patientName: AppShell / LearningLayer から渡す必要あり（現状 Form2Workspace は未受領）
//   - onBack: C3 で患者トップへ（現状なし）
//   - saveStatus: WorkspaceForm2Section / useForm2Supabase の状態を slot 化
//   - headerActions: 「患者理解を深める」・将来の印刷/提出（C7）
//   - patientReference: WorkspacePatientReferencePane（tabs: chart|conversation）。
//     現状はインライン CompassChart + WorkspaceConversation（notes なし）
//   - 障害: LearningLayer Inspector（Coach/Note）が clinical-workspace 専用 sibling。
//     Shell 化するとメモ導線を左ペイン notes へ寄せるか Inspector を残すか C6 で決定が必要。
//   - 障害: 左ペイン固定幅 300–380px。Shell は 38% 固定。接続時に幅感が変わる。
//   - C2 では Form3 で Shell を先に検証するため、ここでは接続しない。
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
// Evidence について（Sprint D-2B 画面構成修正）:
//   学習過程を 2 段階に分ける。第1段階（本コンポーネント＝思考ワークスペース）は、電子カルテと
//   患者との会話を参照しながら「様式2 を作成する」ことに専念する。Evidence の整理（根拠リンク）は
//   様式2 の表示領域を圧迫しないよう、第2段階の専用ビュー（EvidenceReviewWorkspace）へ分離した。
//   ここでは様式2 ヘッダー右に「患者理解を深める」への控えめな導線だけを置き、様式2 を主役に保つ。
//   なお学生向け UI では Evidence／根拠 という語を出さず、気づき・情報・患者理解・全体像へ統一する
//   （内部実装・コメントは従来の開発用語を維持）。

import { useState } from "react";
import { FileText, MessagesSquare, Sparkles } from "lucide-react";
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
  onOpenEvidenceReview,
  facingState,
  onChangeFacingState,
}: {
  patient: Patient;
  userId: string;
  // 様式2 の初期表示（AppShell のセッション snapshot 優先・無ければサーバ値）。保存の正は Supabase。
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // 第2段階「Evidence 整理」ビューへの導線（様式2 ヘッダー右の控えめなボタン）。
  onOpenEvidenceReview?: () => void;
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
          <header className="no-print mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-[#1D1D1F]">
                精神様式2 受け持ち対象記録
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
                左の電子カルテ・患者との会話を参照しながら、受け持ち対象記録へ整理します。自動保存されます。
              </p>
            </div>
            {/* 第2段階「Evidence 整理」への控えめな導線（様式2 本文を押し下げない）。 */}
            {onOpenEvidenceReview && (
              <button
                type="button"
                onClick={onOpenEvidenceReview}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#D6E6FA] bg-[#F2F7FF] px-3 py-1.5 text-[12px] font-medium text-[#0A6CD6] transition hover:bg-[#E4EFFF]"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                患者理解を深める
              </button>
            )}
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
