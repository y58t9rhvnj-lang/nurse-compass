"use client";

// 思考ワークスペース / Form3 Phase B 共用の患者参照ペイン（R1）。
// 電子カルテ・会話・コンパスメモを Segmented Control で切替。常時 mount + CSS 可視切替で状態を保持する。
// Form2 中央フォームや Form3 保存データには依存しない。

import { useId, useState } from "react";
import { FileText, MessagesSquare, NotebookPen } from "lucide-react";
import CompassChart from "@/components/chart/CompassChart";
import NoteZone from "@/components/patient/notes/NoteZone";
import WorkspaceConversation from "@/components/v2/workspace/WorkspaceConversation";
import {
  BRAND_ICON_SELECTED,
  BRAND_ICON_UNSELECTED,
  BRAND_SEGMENT_TRACK,
  BRAND_SELECTED_SEGMENT,
  BRAND_UNSELECTED_IN_TRACK,
} from "@/components/v2/workspace/darkSelectedSegment";
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
  { label: string; shortLabel: string; icon: typeof FileText }
> = {
  chart: { label: "電子カルテ", shortLabel: "電子カルテ", icon: FileText },
  conversation: { label: "会話", shortLabel: "会話", icon: MessagesSquare },
  notes: { label: "コンパスメモ", shortLabel: "メモ", icon: NotebookPen },
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
  const tablistId = useId();

  return (
    <section
      aria-label={ariaLabel}
      className={`flex min-h-0 flex-1 flex-col bg-white ${className}`.trim()}
    >
      <div className="no-print shrink-0 border-b border-[#E5E5EA] bg-white px-3 py-2 sm:px-4">
        <div
          role="tablist"
          aria-label="患者参照の表示切替"
          id={tablistId}
          className={`${BRAND_SEGMENT_TRACK} w-full min-w-0`}
        >
          {enabled.map((id) => {
            const meta = TAB_META[id];
            const Icon = meta.icon;
            const selected = active === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`${tablistId}-${id}`}
                aria-selected={selected}
                aria-controls={`${tablistId}-panel-${id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setRefTab(id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const idx = enabled.indexOf(id);
                  const next =
                    e.key === "ArrowRight"
                      ? enabled[(idx + 1) % enabled.length]!
                      : enabled[(idx - 1 + enabled.length) % enabled.length]!;
                  setRefTab(next);
                }}
                className={[
                  "relative z-[1] flex min-h-[40px] flex-1 items-center justify-center gap-1.5 overflow-visible rounded-[8px] px-2.5 text-[13px] sm:min-h-[44px] sm:gap-2 sm:px-3",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E88E5]",
                  selected ? BRAND_SELECTED_SEGMENT : BRAND_UNSELECTED_IN_TRACK,
                ].join(" ")}
                data-compass-selected={selected ? "true" : "false"}
                aria-label={meta.label}
              >
                <Icon
                  className={[
                    "relative z-[1] h-3.5 w-3.5",
                    selected ? BRAND_ICON_SELECTED : BRAND_ICON_UNSELECTED,
                  ].join(" ")}
                  strokeWidth={selected ? 2.15 : 1.9}
                  aria-hidden
                />
                {/*
                  iPad Safari: nested sm:hidden / hidden sm:inline が両方 none になる事例があるため、
                  表示ラベルは shortLabel に一本化（aria-label で正式名を確保）。
                */}
                <span className="relative z-[1] min-w-0 truncate whitespace-nowrap">
                  {meta.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* mount 維持: 非表示タブは hidden（unmount しない） */}
      {enabled.includes("chart") ? (
        <div
          role="tabpanel"
          id={`${tablistId}-panel-chart`}
          aria-labelledby={`${tablistId}-chart`}
          hidden={active !== "chart"}
          className={
            active === "chart"
              ? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              : "hidden"
          }
        >
          <CompassChart key={patient.id} patient={patient} embedded />
        </div>
      ) : null}

      {enabled.includes("conversation") ? (
        <div
          role="tabpanel"
          id={`${tablistId}-panel-conversation`}
          aria-labelledby={`${tablistId}-conversation`}
          hidden={active !== "conversation"}
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
          role="tabpanel"
          id={`${tablistId}-panel-notes`}
          aria-labelledby={`${tablistId}-notes`}
          hidden={active !== "notes"}
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
