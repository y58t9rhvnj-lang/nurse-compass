"use client";

// Compass Version2 — Workspace 抽象化（Architecture Migration / Sprint A）。
//
// 位置づけ（設計 docs/version2/13_ui_architecture.md, 16_workspace_mockups.md）:
//   Workspace は「学習フェーズ専用の思考空間」であり、フェーズごとに中央（主役）が変わる。
//   本コンポーネントは Learning Layer の「中央（主役）」だけを、フェーズ種別に応じて差し替える
//   共通の受け口（swap point）。将来 Form3 Workspace / Related Map Workspace をここへ登録する。
//
// 本 Sprint では画面・挙動を変えない。現行の 2 ビューを次の種別へ対応づけるのみ:
//   ・"clinical-workspace" … 現行の Clinical Thinking Workspace（左 Evidence / 右 様式2）。
//                            設計上の「様式2 Workspace」の途中形。
//   ・"form2"              … 単独様式2 ビュー。
//
// 器（サイドバー・通知・Inspector・受け持ちガード）は LearningLayer が担い、
// 本コンポーネントは中央本体のみを描画する（責務分離）。

import type { Patient } from "@/lib/wardData";
import type { FacingEntry } from "@/lib/patientFacingData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { UseEvidenceSupabaseResult } from "@/hooks/v2/useEvidenceSupabase";
import ClinicalWorkspace from "@/components/v2/workspace/ClinicalWorkspace";
import WorkspaceForm2Section from "@/components/v2/workspace/WorkspaceForm2Section";

// 現在サポートする Learning Workspace 種別（差し替え点）。
// 将来: "form3" / "related-map" をここへ追加する。
export type LearningWorkspaceView = "clinical-workspace" | "form2";

export function isLearningWorkspaceView(
  view: string,
): view is LearningWorkspaceView {
  return view === "clinical-workspace" || view === "form2";
}

export default function WorkspaceHost({
  view,
  patient,
  userId,
  evidence,
  initialForm2,
  onForm2Persisted,
  facingHistory,
}: {
  view: LearningWorkspaceView;
  patient: Patient;
  // ログイン済み学生 id（LearningLayer が userId 有無を判定した後のみ本体を描画する）。
  userId: string;
  evidence: UseEvidenceSupabaseResult;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  facingHistory: FacingEntry[];
}) {
  switch (view) {
    case "clinical-workspace":
      return (
        <ClinicalWorkspace
          patient={patient}
          userId={userId}
          evidence={evidence}
          initialForm2={initialForm2}
          onForm2Persisted={onForm2Persisted}
          facingHistory={facingHistory}
        />
      );
    case "form2":
      return (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto w-full max-w-[900px]">
            <WorkspaceForm2Section
              patientId={patient.id}
              userId={userId}
              initial={initialForm2}
              onPersisted={onForm2Persisted}
            />
          </div>
        </div>
      );
    // TODO(Workspace 拡張): case "form3" / case "related-map" をここに追加する
    //   （設計: docs/version2/16_workspace_mockups.md §4/§5）。器・Inspector は共通のまま。
  }
}
