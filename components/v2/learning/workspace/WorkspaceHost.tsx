"use client";

// Compass Version2 — Workspace 抽象化（Architecture Migration / Sprint A で導入）。
//
// 位置づけ（設計 docs/version2/13_ui_architecture.md, 16_workspace_mockups.md）:
//   Workspace は「学習フェーズ専用の思考空間」であり、フェーズごとに中央（主役）が変わる。
//   本コンポーネントは Learning Layer の「中央（主役）」だけを、フェーズ種別に応じて差し替える
//   共通の受け口（swap point）。
//
// Day5: Form3 Assessment Workspace を登録。様式2 思考空間（clinical-workspace）と分離。

import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot, Form3Snapshot } from "@/lib/v2/notebook/types";
import type { FacingConvoState } from "@/lib/patientFacingData";
import type { Form2Data } from "@/lib/form2/form2Types";
import Form2Workspace from "@/components/v2/workspace/Form2Workspace";
import Form3PhaseBPlaceholder from "@/components/v2/form3/Form3PhaseBPlaceholder";
import Form3Workspace from "@/components/v2/form3/Form3Workspace";
import {
  isLearningWorkspaceView,
  type LearningWorkspaceView,
} from "@/components/v2/learning/workspace/learningWorkspaceView";
import { isFeatureEnabled } from "@/lib/featureFlags";

export type { LearningWorkspaceView };
export { isLearningWorkspaceView };

export default function WorkspaceHost({
  view,
  patient,
  userId,
  initialForm2,
  onForm2Persisted,
  initialForm3,
  onForm3Persisted,
  patientOverviewText,
  onOpenEvidenceReview,
  facingState,
  onChangeFacingState,
}: {
  view: LearningWorkspaceView;
  patient: Patient;
  userId: string;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  initialForm3: Form3Snapshot | null;
  onForm3Persisted?: (snapshot: Form3Snapshot) => void;
  /** 「私が捉えた患者さん」参照用（読み取り専用） */
  patientOverviewText?: string;
  onOpenEvidenceReview?: () => void;
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
}) {
  switch (view) {
    case "clinical-workspace":
      return (
        <Form2Workspace
          patient={patient}
          userId={userId}
          initialForm2={initialForm2}
          onForm2Persisted={onForm2Persisted}
          onOpenEvidenceReview={onOpenEvidenceReview}
          facingState={facingState}
          onChangeFacingState={onChangeFacingState}
        />
      );
    case "form3": {
      if (isFeatureEnabled("form3PhaseB")) {
        return <Form3PhaseBPlaceholder patientName={patient.name} />;
      }
      const form2Data: Form2Data | null = initialForm2?.payload ?? null;
      return (
        <Form3Workspace
          patientId={patient.id}
          patientName={patient.name}
          userId={userId}
          initial={initialForm3}
          onPersisted={onForm3Persisted}
          form2Data={form2Data}
          patientOverviewText={patientOverviewText ?? ""}
          showClues
        />
      );
    }
  }
}
