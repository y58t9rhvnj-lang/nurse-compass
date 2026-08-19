"use client";

// 思考ワークスペース / Form3 Phase B 共用の患者参照ペイン（R1）。
// 電子カルテ・会話・コンパスメモをタブ切替。常時 mount + CSS 可視切替で状態を保持する。
// Form2 中央フォームや Form3 保存データには依存しない。

import { useState } from "react";
import { FileText, MessagesSquare, NotebookPen } from "lucide-react";
import CompassChart from "@/components/chart/CompassChart";
import NoteZone from "@/components/patient/notes/NoteZone";
import WorkspaceConversation from "@/components/v2/workspace/WorkspaceConversation";
import type { FacingConvoState } from "@/lib/patientFacingData";
import type { Patient } from "@/lib/wardData";

export type WorkspacePatientReferenceTab =
  | "chart"
  | "conversation"
  | "notes";

export type WorkspacePatientReferencePaneProps = {
  patient: Patient;
  facingState: FacingConvoState;
  onChangeFacingState: (next: FacingConvoState) => void;
  /** 既定は3タブ。Form2 互換で chart/conversation のみに絞れる。 */
  tabs?: WorkspacePatientReferenceTab[];
  className?: string;
  "aria-label"?: string;
};

const DEFAULT_TABS: WorkspacePatientReferenceTab[] = [
  "chart",
  "conversation",
  "notes",
];

const TAB_META: Record<
  WorkspacePatientReferenceTab,
  { label: string; icon: typeof FileText }
> = {
  chart: { label: "電子カルテ", icon: FileText },
  conversation: { label: "会話", icon: MessagesSquare },
  notes: { label: "コンパスメモ", icon: NotebookPen },
};

/**
 * 患者一次情報の参照ペイン。
 * CompassChart / WorkspaceConversation / NoteZone を再利用し、二重実装しない。
 */
export default function WorkspacePatientReferencePane({
  patient,
  facingState,
  onChangeFacingState,
  tabs = DEFAULT_TABS,
  className = "",
  "aria-label": ariaLabel = "患者参照",
}: WorkspacePatientReferencePaneProps) {
  const enabled = tabs.length > 0 ? tabs : DEFAULT_TABS;
  const [refTab, setRefTab] = useState<WorkspacePatientReferenceTab>(
    enabled[0] ?? "chart",
  );
  const active = enabled.includes(refTab) ? refTab : enabled[0]!;

  return (
    <section
      aria-label={ariaLabel}
      className={`flex min-h-0 flex-1 flex-col bg-white ${className}`.trim()}
    >
      <div className="no-print flex shrink-0 gap-1 border-b border-[#E5E5EA] bg-white px-2 py-2">
        {enabled.map((id) => {
          const meta = TAB_META[id];
          const Icon = meta.icon;
          return (
            <RefTabButton
              key={id}
              active={active === id}
              onClick={() => setRefTab(id)}
              icon={<Icon className="h-4 w-4" strokeWidth={2} />}
              label={meta.label}
            />
          );
        })}
      </div>

      {/* mount 維持: 非表示タブは hidden（unmount しない） */}
      {enabled.includes("chart") ? (
        <div
          className={
            active === "chart"
              ? "flex min-h-0 flex-1 flex-col"
              : "hidden"
          }
        >
          <CompassChart key={patient.id} patient={patient} embedded />
        </div>
      ) : null}

      {enabled.includes("conversation") ? (
        <div
          className={
            active === "conversation"
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
      ) : null}

      {enabled.includes("notes") ? (
        <div
          className={
            active === "notes"
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
        >
          <NoteZone patientId={patient.id} variant="fill" />
        </div>
      ) : null}
    </section>
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
        "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] transition",
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
