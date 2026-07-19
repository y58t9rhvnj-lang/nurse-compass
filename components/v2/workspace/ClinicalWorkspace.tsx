"use client";

// Compass — Clinical Thinking Workspace（Architecture Sprint 5: Minimal Learning Workspace Shell）。
//
// 位置づけ（docs/version2/14_learning_layer_architecture.md §6/§7）:
//   Core 左メニューから、選択中の患者文脈を保ったまま開く「患者単位の主要画面」。
//   別アプリ・別ルートではなく、共通 AppShell（Core Shell）の 1 ビューとして描画する。
//
// 左右2ペイン:
//   左 = Clinical Thinking / Evidence（既存 EvidencePane + useEvidenceSupabase）
//   右 = Learning Outcome / 様式2（既存 WorkspaceForm2Section + useForm2Supabase）
//   Inspector（Coach / Question）は AppShell が共有の sibling として重畳する。
//   本コンポーネントは Inspector を持たない（開閉で本体を再マウントさせないため）。
//
// Evidence store（Architecture Sprint 6）:
//   useEvidenceSupabase は AppShell へ持ち上げ、Core 収集導線と「同一の store」を共有する。
//   本コンポーネントは evidence コントローラを props で受け取るのみ（自前で hook を生成しない）。
//   これにより、Core（電子カルテ・会話）で収集した Evidence が再読み込みなしにここへ反映される。
//
// 再利用のみ（新規保存モデル・新規フォームは作らない）:
//   EvidencePane / useEvidenceSupabase / informationCards / InformationCard
//   WorkspaceForm2Section / useForm2Supabase / form2Repository / form2Draft
//
// レスポンシブ:
//   lg 以上（PC / iPad 横）: 左右2ペイン（おおむね 40:60）。各ペイン内で独立スクロール。
//   <lg（iPad 縦・狭幅）    : 「思考 / 様式2」セグメント切替。両ペインを常時 mount し
//                            CSS の可視切替のみで行う（様式2 を再マウントしない
//                            ＝入力内容・保存状態・スクロールを保持する）。

import { useState } from "react";
import { ClipboardList, Compass } from "lucide-react";
import type { Patient } from "@/lib/wardData";
import type { FacingEntry } from "@/lib/patientFacingData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { UseEvidenceSupabaseResult } from "@/hooks/v2/useEvidenceSupabase";
import EvidencePane from "./EvidencePane";
import WorkspaceForm2Section from "./WorkspaceForm2Section";

type Pane = "thinking" | "form2";

export default function ClinicalWorkspace({
  patient,
  userId,
  evidence,
  initialForm2,
  onForm2Persisted,
  facingHistory,
}: {
  patient: Patient;
  userId: string;
  // Evidence コントローラ（AppShell が保持し Core 収集導線と共有する）。
  evidence: UseEvidenceSupabaseResult;
  // 様式2 の初期表示（AppShell のセッション snapshot 優先・無ければサーバ値）。保存の正本は Supabase。
  initialForm2: Form2Snapshot | null;
  // 保存成功時に確定スナップショットを AppShell へ通知（単独様式2 と最新 state を共有する）。
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // Core「患者との会話」の履歴（AppShell が患者別に保持）。Evidence の会話収集候補に使う。
  facingHistory: FacingEntry[];
}) {
  // 狭幅時の表示ペイン。両ペインは常時 mount し、CSS で可視切替する（再マウントしない）。
  const [pane, setPane] = useState<Pane>("thinking");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F2F2F7]">
      {/* 狭幅用セグメント（思考 / 様式2）。lg 以上では非表示。 */}
      <div className="no-print flex shrink-0 gap-1 border-b border-[#E5E5EA] bg-white px-3 py-2 lg:hidden">
        <SegButton
          active={pane === "thinking"}
          onClick={() => setPane("thinking")}
          icon={<Compass className="h-4 w-4" strokeWidth={2} />}
          label="思考 / Evidence"
        />
        <SegButton
          active={pane === "form2"}
          onClick={() => setPane("form2")}
          icon={<ClipboardList className="h-4 w-4" strokeWidth={2} />}
          label="様式2"
        />
      </div>

      {/* 2ペイン本体。lg 以上=横並び（40:60）/ <lg=可視切替（両ペインとも mount 維持）。 */}
      <div className="flex min-h-0 flex-1">
        {/* 左: Clinical Thinking / Evidence */}
        <section
          aria-label="Clinical Thinking / Evidence"
          className={[
            "min-h-0 flex-col overflow-y-auto overscroll-contain",
            pane === "thinking" ? "flex flex-1" : "hidden",
            "lg:flex lg:w-[40%] lg:flex-none lg:border-r lg:border-[#E5E5EA]",
          ].join(" ")}
        >
          <div className="mx-auto w-full max-w-[560px] px-4 py-5">
            <header className="mb-3">
              <h2 className="text-[15px] font-bold text-[#1D1D1F]">
                Compassメモと Evidence
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-[#8E8E93]">
                Compassメモを振り返り、情報が示している意味や不足している情報を考えながら、
                看護問題の根拠になる情報を Evidence として整理します。
              </p>
            </header>
            <EvidencePane
              patientId={patient.id}
              history={facingHistory}
              evidence={evidence}
            />
          </div>
        </section>

        {/* 右: Learning Outcome / 様式2 */}
        <section
          aria-label="Learning Outcome / 様式2"
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
                整理した Evidence を見ながら、受け持ち対象記録へまとめます。自動保存されます。
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
