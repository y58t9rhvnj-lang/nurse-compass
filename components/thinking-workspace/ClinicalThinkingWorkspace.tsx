"use client";

import { useState } from "react";
import type { Patient } from "@/lib/wardData";
import type { InformationCard } from "@/lib/information/informationCard";
import { useInformationCards } from "@/hooks/useInformationCards";
import CollectionDialog from "@/components/collection/CollectionDialog";
import ConfirmDialog from "@/components/collection/ConfirmDialog";
import WorkspaceHeader from "./WorkspaceHeader";
import CollectedDataPane from "./CollectedDataPane";
import InformationOrganizationPane from "./InformationOrganizationPane";
import CuePane from "./CuePane";

// 情報整理ノート（内部設計名：Clinical Thinking Workspace）。
// 学生が収集したデータを見渡し、患者理解のために整理・比較していく専用の思考空間。
// 本 Sprint は「画面の骨格 + 左ペインのデータ一覧表示」のみ。
//   - 左：収集したデータ（Information Card store の現在患者データを表示）
//   - 右：患者理解のための情報整理（空の骨格）
//   - 下：手がかり（空状態）
// iPad 横画面を主対象とし、狭い画面ではセグメント切替で1領域ずつ表示する。
type WorkspaceTab = "data" | "info" | "cue";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "data", label: "データ" },
  { id: "info", label: "情報整理" },
  { id: "cue", label: "手がかり" },
];

export default function ClinicalThinkingWorkspace({
  patient,
  onBack,
}: {
  patient: Patient | undefined;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("data");

  if (!patient) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#F7F7FA]">
        <WorkspaceHeader onBack={onBack} />
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <p className="max-w-sm text-center text-[13px] leading-relaxed text-[#8E8E93]">
            患者が選択されていません。
            <br />
            病棟から患者を選んでから、情報整理ノートを開いてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F7FA]">
      <WorkspaceHeader patientName={patient.name} onBack={onBack} />

      {/* iPad 横画面（lg 以上）：3領域レイアウト */}
      <div className="hidden min-h-0 flex-1 lg:flex lg:flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[32%] min-w-0 flex-col border-r border-[#E5E5EA] bg-white">
            <DataPaneConnected patientId={patient.id} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col bg-white">
            <InformationOrganizationPane />
          </div>
        </div>
        <div className="shrink-0 border-t border-[#E5E5EA] bg-white">
          <CuePane />
        </div>
      </div>

      {/* 狭い画面（lg 未満）：セグメント切替で1領域ずつ */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <div className="shrink-0 px-3 pt-3">
          <div
            role="tablist"
            aria-label="情報整理ノートの表示切替"
            className="flex gap-1 rounded-full bg-[#ECECF0] p-1"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={[
                  "min-h-[44px] flex-1 rounded-full px-3 text-[13px] font-medium transition",
                  tab === t.id
                    ? "bg-white text-[#0A84FF] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                    : "text-[#6E6E73]",
                ].join(" ")}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-white">
          {tab === "data" && <DataPaneConnected patientId={patient.id} />}
          {tab === "info" && <InformationOrganizationPane />}
          {tab === "cue" && <CuePane />}
        </div>
      </div>
    </div>
  );
}

// 現在患者の収集データ（Information Card）を購読して左ペインへ渡す。
// 「内容を修正」は共通収集ダイアログを edit モードで再利用し、content のみ更新する。
// 「収集解除」は確認後に store から取り除く（元の患者発言・一時メモは残る）。
function DataPaneConnected({ patientId }: { patientId: string }) {
  const { cards, hydrated, updateContent, release } =
    useInformationCards(patientId);
  const [editTarget, setEditTarget] = useState<InformationCard | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<InformationCard | null>(
    null,
  );

  return (
    <>
      <CollectedDataPane
        cards={cards}
        hydrated={hydrated}
        onEdit={setEditTarget}
        onRelease={setReleaseTarget}
      />

      {/* 内容を修正（共通収集ダイアログの edit モード） */}
      <CollectionDialog
        key={editTarget?.id ?? "closed"}
        open={editTarget !== null}
        mode="edit"
        originalText={editTarget?.originalText ?? editTarget?.content ?? ""}
        initialContent={editTarget?.content ?? ""}
        sourceLabel={editTarget?.sourceLabel ?? ""}
        timestamp={editTarget?.observedAt ?? editTarget?.createdAt}
        onCancel={() => setEditTarget(null)}
        onConfirm={(content) => {
          if (editTarget) updateContent(editTarget.id, content);
          setEditTarget(null);
        }}
      />

      {/* 収集解除の確認 */}
      <ConfirmDialog
        open={releaseTarget !== null}
        title="このデータを収集対象から外しますか？"
        description="元の患者発言や一時メモは削除されません。"
        confirmLabel="収集解除"
        cancelLabel="キャンセル"
        destructive
        onCancel={() => setReleaseTarget(null)}
        onConfirm={() => {
          if (releaseTarget) release(releaseTarget.id);
          setReleaseTarget(null);
        }}
      />
    </>
  );
}
