"use client";

import { useMemo, useState } from "react";
import Form3CluesSheet from "@/components/v2/form3/Form3CluesSheet";
import Form3Header from "@/components/v2/form3/Form3Header";
import Form3PatternEditor from "@/components/v2/form3/Form3PatternEditor";
import Form3PatternNav from "@/components/v2/form3/Form3PatternNav";
import {
  buildForm3NavItems,
  getForm3OverallProgressView,
  resolveActiveForm3PatternKey,
} from "@/components/v2/form3/form3UiModel";
import { useForm3Supabase } from "@/hooks/v2/useForm3Supabase";
import type { Form2Data } from "@/lib/form2/form2Types";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import type { Form3ReviewIssue } from "@/lib/form3/form3Validation";
import type { Form3Snapshot } from "@/lib/v2/notebook/types";

export type Form3WorkspaceProps = {
  patientId: string;
  userId: string;
  initial: Form3Snapshot | null;
  /** 表示用。未指定でも動作する */
  patientName?: string;
  onPersisted?: (snapshot: Form3Snapshot) => void;
  /**
   * 患者理解の手がかり（読み取り専用）。
   * 転記・コピー・同期はしない。未指定なら手がかりボタンを出さない。
   */
  form2Data?: Form2Data | null;
  patientOverviewText?: string;
  showClues?: boolean;
};

/**
 * 様式3 Assessment Workspace。
 * Day5: Learning Layer / WorkspaceHost から接続する。Autosave は useForm3Supabase。
 */
export default function Form3Workspace({
  patientId,
  userId,
  initial,
  patientName,
  onPersisted,
  form2Data = null,
  patientOverviewText = "",
  showClues = true,
}: Form3WorkspaceProps) {
  const {
    data,
    hydrated,
    saveStatus,
    lastSavedAt,
    conflictSnapshot,
    pendingDraft,
    setPatternField,
    markReviewed,
    unmarkReviewed,
    loadLatestOnConflict,
    restoreDraft,
    discardDraft,
  } = useForm3Supabase({ patientId, userId, initial, onPersisted });

  const [activeKey, setActiveKey] = useState<Form3PatternKey>(() =>
    resolveActiveForm3PatternKey("health_perception_management"),
  );
  const [reviewIssues, setReviewIssues] = useState<Form3ReviewIssue[]>([]);
  const [cluesOpen, setCluesOpen] = useState(false);

  const navItems = useMemo(
    () => buildForm3NavItems(data, activeKey),
    [data, activeKey],
  );
  const progressView = useMemo(
    () => getForm3OverallProgressView(data),
    [data],
  );

  const pattern = data.patterns[activeKey];

  const handleSelect = (key: Form3PatternKey) => {
    setActiveKey(key);
    setReviewIssues([]);
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#EDEDF0]">
      <Form3Header
        patientName={patientName}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        hydrated={hydrated}
        reviewedCount={progressView.reviewedCount}
        totalPatterns={progressView.total}
        onLoadLatest={
          conflictSnapshot || saveStatus === "conflict"
            ? loadLatestOnConflict
            : undefined
        }
        onOpenClues={showClues ? () => setCluesOpen(true) : undefined}
      />

      {pendingDraft ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#FCE9C6] bg-[#FFF7E6] px-4 py-2">
          <p className="text-[12px] text-[#8A6D3B]">
            前回うまく保存できなかった下書きがあります
          </p>
          <button
            type="button"
            onClick={restoreDraft}
            className="min-h-[44px] rounded-lg border border-[#E0B75B] bg-white px-3 text-[12px] font-semibold text-[#8A6D3B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6D3B]"
          >
            下書きを復元
          </button>
          <button
            type="button"
            onClick={discardDraft}
            className="min-h-[44px] rounded-lg border border-[#D1D1D6] bg-white px-3 text-[12px] text-[#6E6E73] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A84FF]"
          >
            破棄
          </button>
        </div>
      ) : null}

      {/* iPad: 縦積み（ナビ横スクロール＋本体1カラム）。PC: 左ナビ＋右エディタ。メインスクロールは本体1本。 */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        <Form3PatternNav items={navItems} onSelect={handleSelect} />

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <Form3PatternEditor
            patternKey={activeKey}
            pattern={pattern}
            reviewIssues={reviewIssues}
            onFieldChange={(field, value) => {
              setReviewIssues([]);
              setPatternField(activeKey, field, value);
            }}
            onMarkReviewed={() => {
              const result = markReviewed(activeKey);
              if (!result.ok) {
                setReviewIssues(result.issues);
              } else {
                setReviewIssues([]);
              }
              return result;
            }}
            onUnmarkReviewed={() => {
              setReviewIssues([]);
              unmarkReviewed(activeKey);
            }}
          />
        </main>
      </div>

      {showClues ? (
        <Form3CluesSheet
          open={cluesOpen}
          onClose={() => setCluesOpen(false)}
          patientId={patientId}
          form2Data={form2Data}
          patientOverviewText={patientOverviewText}
        />
      ) : null}
    </div>
  );
}
