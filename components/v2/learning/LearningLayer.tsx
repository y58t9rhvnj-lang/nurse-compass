"use client";

// Compass Version2 — Learning Layer（Architecture Migration / Sprint A）。
//
// Day5: Form3 Workspace を正式接続。器（サイドバー・受け持ちガード）は共通のまま。

import type { ReactNode } from "react";
import { X } from "lucide-react";
import Notice from "@/components/Notice";
import WorkspaceHost, {
  type LearningWorkspaceView,
} from "@/components/v2/learning/workspace/WorkspaceHost";
import type { Patient } from "@/lib/wardData";
import type { Form2Snapshot, Form3Snapshot } from "@/lib/v2/notebook/types";
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
  initialForm3,
  onForm3Persisted,
  patientOverviewText,
  onOpenEvidenceReview,
  facingState,
  onChangeFacingState,
}: {
  view: LearningWorkspaceView;
  sideNav: ReactNode;
  notice: string | null;
  onCloseNotice: () => void;
  inspectorHeader: ReactNode;
  inspectorOverlay: ReactNode;
  isTargetPatient: boolean;
  onBackToTarget: () => void;
  userId?: string;
  patient: Patient;
  initialForm2: Form2Snapshot | null;
  onForm2Persisted?: (snapshot: Form2Snapshot) => void;
  initialForm3: Form3Snapshot | null;
  onForm3Persisted?: (snapshot: Form3Snapshot) => void;
  patientOverviewText?: string;
  onOpenEvidenceReview?: () => void;
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
}) {
  const isForm3 = view === "form3";
  const lockedTitle = isForm3 ? "様式3 アセスメント" : "思考ワークスペース";
  const lockedBody = isForm3 ? (
    <>
      受け持ち患者について、ゴードンの健康パターンで
      <br />
      患者理解を深めていきましょう。
    </>
  ) : (
    <>
      電子カルテや会話で集めた情報と Compassノートを見ながら、
      <br />
      受け持ち患者について様式2 へ整理していきましょう。
    </>
  );

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
        <h2 className="text-[15px] font-bold text-[#1D1D1F]">{lockedTitle}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
          {lockedBody}
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

  const loginMessage = isForm3
    ? "様式3 を表示するにはログインが必要です。"
    : "様式2 Workspace を表示するにはログインが必要です。";

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
            initialForm3={initialForm3}
            onForm3Persisted={onForm3Persisted}
            patientOverviewText={patientOverviewText}
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
