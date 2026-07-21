"use client";

// Compass Version2 — Workspace 抽象化（Architecture Migration / Sprint A で導入）。
//
// 位置づけ（設計 docs/version2/13_ui_architecture.md, 16_workspace_mockups.md）:
//   Workspace は「学習フェーズ専用の思考空間」であり、フェーズごとに中央（主役）が変わる。
//   本コンポーネントは Learning Layer の「中央（主役）」だけを、フェーズ種別に応じて差し替える
//   共通の受け口（swap point）。将来 Form3 Workspace / Related Map Workspace をここへ登録する。
//
// Form2 Workspace Migration（Sprint B）:
//   現行の 2 つの学習ビュー（"clinical-workspace" / "form2"）は、設計上ひとつの「様式2 Workspace」に
//   あたる。両ビューとも同じ Form2Workspace を描画し、様式2 フェーズの思考空間へ統一する
//   （同一コンポーネントのため、ビュー間切替で様式2 入力・スクロール等の state を保持できる）。
//
// 器（サイドバー・通知・Inspector・受け持ちガード）は LearningLayer が担い、
// 本コンポーネントは中央本体のみを描画する（責務分離）。

import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { FacingConvoState } from "@/lib/patientFacingData";
import Form2Workspace from "@/components/v2/workspace/Form2Workspace";

// 現在サポートする Learning Workspace 種別（差し替え点）。
// "clinical-workspace" ＝ 思考ワークスペース（患者情報・電子カルテ・会話を参照しながら様式2 へ整理）。
// 左メニュー「様式2（form2）」は最終確認・印刷・提出専用の別画面のため、ここには含めない
//（Sprint D-1 追加修正 ⑦: 思考ワークスペースと提出用様式2 を別画面として分離）。
// 将来: "form3" / "related-map" をここへ追加する。
export type LearningWorkspaceView = "clinical-workspace";

export function isLearningWorkspaceView(
  view: string,
): view is LearningWorkspaceView {
  return view === "clinical-workspace";
}

export default function WorkspaceHost({
  view,
  patient,
  userId,
  initialForm2,
  onForm2Persisted,
  facingState,
  onChangeFacingState,
}: {
  view: LearningWorkspaceView;
  patient: Patient;
  // ログイン済み学生 id（LearningLayer が userId 有無を判定した後のみ本体を描画する）。
  userId: string;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  // 会話（患者との会話）の状態。Workspace 左ペインの「会話」タブが Core と同一 state を共有する。
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
}) {
  switch (view) {
    // 思考ワークスペース（様式2 フェーズの思考空間）。
    case "clinical-workspace":
      return (
        <Form2Workspace
          patient={patient}
          userId={userId}
          initialForm2={initialForm2}
          onForm2Persisted={onForm2Persisted}
          facingState={facingState}
          onChangeFacingState={onChangeFacingState}
        />
      );
    // TODO(Workspace 拡張): case "form3" / case "related-map" をここに追加する
    //   （設計: docs/version2/16_workspace_mockups.md §4/§5）。器・Inspector は共通のまま。
  }
}
