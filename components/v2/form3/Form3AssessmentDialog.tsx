"use client";

// Phase 2 Step 2: 解釈・分析の追加・編集。フローティング作業ウィンドウ（背景カルテ操作可）。

import { useId, useState, type ReactNode } from "react";
import Form3FloatingEditorShell, {
  useForm3FloatEditor,
} from "@/components/v2/form3/Form3FloatingEditorShell";
import {
  FORM3_PHASE_B_ASSESSMENT_DIALOG_HELPER,
  FORM3_PHASE_B_ASSESSMENT_PLACEHOLDER,
  FORM3_PHASE_B_ASSESSMENT_PROMPTS,
} from "@/components/v2/form3/form3PhaseBEducationCopy";
import type { Form3InformationCardV2 } from "@/lib/form3/v2/form3V2Types";

export type Form3AssessmentDialogValues = {
  evidenceInformationIds: string[];
  interpretation: string;
};

export type Form3AssessmentDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  informationOptions: Form3InformationCardV2[];
  initial?: Partial<Form3AssessmentDialogValues> | null;
  onClose: () => void;
  onSubmit: (values: Form3AssessmentDialogValues) => void;
};

function SoBadge({ soType }: { soType: "S" | "O" | null }) {
  if (soType === "S") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#E3F2FD] text-[12px] font-bold text-[#1E88E5]">
        S
      </span>
    );
  }
  if (soType === "O") {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#ECEFF1] text-[12px] font-bold text-[#455A64]">
        O
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-md bg-[#F2F2F7] px-1 text-[10px] font-semibold text-[#8E8E93]">
      —
    </span>
  );
}

function EvidencePicker({
  informationOptions,
  selectedIds,
  legendId,
  onToggle,
}: {
  informationOptions: Form3InformationCardV2[];
  selectedIds: string[];
  legendId: string;
  onToggle: (id: string) => void;
}) {
  if (informationOptions.length === 0) {
    return (
      <p className="mt-2.5 rounded-2xl bg-[#F2F2F7] px-4 py-4 text-[14px] text-[#6E6E73]">
        先にこのパターンへ情報を追加してください。
      </p>
    );
  }
  return (
    <ul className="mt-2.5 flex flex-col gap-2" aria-labelledby={legendId}>
      {informationOptions.map((info) => {
        const checked = selectedIds.includes(info.id);
        return (
          <li key={info.id}>
            <label
              className={[
                "flex min-h-[48px] cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 ring-1 transition-colors [touch-action:manipulation]",
                checked
                  ? "bg-[#EAF4FC] ring-[#1E88E5]/35"
                  : "bg-[#F7F7F8] ring-transparent",
              ].join(" ")}
            >
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 accent-[#1E88E5]"
                checked={checked}
                onChange={() => onToggle(info.id)}
              />
              <SoBadge soType={info.soType} />
              <span className="min-w-0 flex-1 whitespace-pre-wrap text-[14px] leading-snug text-[#1D1D1F]">
                {info.content.trim() || "（未入力）"}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function CollapseToggle({
  id,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      id={id}
      aria-expanded={expanded}
      onClick={onToggle}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl bg-[#F7F8FA] px-3 text-left text-[13px] font-semibold text-[#1D1D1F] [touch-action:manipulation]"
    >
      <span className="min-w-0 truncate">{children}</span>
      <span className="shrink-0 text-[11px] text-[#8E8E93]" aria-hidden>
        {expanded ? "▲" : "▼"}
      </span>
    </button>
  );
}

function Form3AssessmentEditorBody({
  informationOptions,
  selectedIds,
  interpretation,
  attempted,
  evidenceLegendId,
  onToggleEvidence,
  onInterpretationChange,
}: {
  informationOptions: Form3InformationCardV2[];
  selectedIds: string[];
  interpretation: string;
  attempted: boolean;
  evidenceLegendId: string;
  onToggleEvidence: (id: string) => void;
  onInterpretationChange: (value: string) => void;
}) {
  const { isFullscreen } = useForm3FloatEditor();
  const hintsToggleId = useId();
  const evidenceToggleId = useId();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);

  const trimmed = interpretation.trim();
  const evidenceInvalid = attempted && selectedIds.length === 0;
  const contentInvalid = attempted && trimmed.length === 0;

  const evidencePicker = (
    <EvidencePicker
      informationOptions={informationOptions}
      selectedIds={selectedIds}
      legendId={evidenceLegendId}
      onToggle={onToggleEvidence}
    />
  );

  const hints = (
    <ul className="space-y-1 rounded-2xl bg-[#F7F8FA] px-3.5 py-2.5">
      {FORM3_PHASE_B_ASSESSMENT_PROMPTS.map((prompt) => (
        <li key={prompt} className="text-[12px] leading-snug text-[#667085]">
          {prompt}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={
        isFullscreen ? "flex min-h-0 flex-1 flex-col gap-2" : undefined
      }
    >
      {!isFullscreen ? (
        <p className="text-[12px] leading-relaxed text-[#8E8E93]">
          {FORM3_PHASE_B_ASSESSMENT_DIALOG_HELPER}
        </p>
      ) : null}

      {isFullscreen ? (
        <div className="shrink-0">
          <CollapseToggle
            id={evidenceToggleId}
            expanded={evidenceOpen}
            onToggle={() => setEvidenceOpen((v) => !v)}
          >
            選択した情報（{selectedIds.length}件）
          </CollapseToggle>
          {evidenceOpen ? (
            <div
              role="region"
              aria-labelledby={evidenceToggleId}
              className="mt-2 max-h-[min(30dvh,17rem)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
            >
              <span id={evidenceLegendId} className="sr-only">
                根拠とした情報を選択（複数選択可）
              </span>
              {evidencePicker}
              {evidenceInvalid ? (
                <span className="mt-1.5 block text-[12px] text-[#C0392B]">
                  根拠とする情報を1つ以上選んでください
                </span>
              ) : null}
            </div>
          ) : evidenceInvalid ? (
            <span className="mt-1.5 block text-[12px] text-[#C0392B]">
              根拠とする情報を1つ以上選んでください
            </span>
          ) : null}
        </div>
      ) : (
        <fieldset className="mt-4 m-0 border-0 p-0">
          <legend
            id={evidenceLegendId}
            className="text-[13px] font-semibold text-[#1D1D1F]"
          >
            根拠とした情報を選択（複数選択可）
          </legend>
          {evidencePicker}
          {evidenceInvalid ? (
            <span className="mt-1.5 block text-[12px] text-[#C0392B]">
              根拠とする情報を1つ以上選んでください
            </span>
          ) : null}
        </fieldset>
      )}

      {isFullscreen ? (
        <div className="shrink-0">
          <CollapseToggle
            id={hintsToggleId}
            expanded={hintsOpen}
            onToggle={() => setHintsOpen((v) => !v)}
          >
            考えるヒント
          </CollapseToggle>
          {hintsOpen ? (
            <div role="region" aria-labelledby={hintsToggleId} className="mt-2">
              {hints}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-5">
          <span className="text-[13px] font-semibold text-[#1D1D1F]">
            解釈・分析の内容
          </span>
          <div className="mt-2">{hints}</div>
        </div>
      )}

      {isFullscreen ? (
        <span className="shrink-0 text-[13px] font-semibold text-[#1D1D1F]">
          解釈・分析の内容
        </span>
      ) : null}

      <div
        className={
          isFullscreen ? "flex min-h-[5rem] flex-1 flex-col" : "mt-2.5 block"
        }
      >
        <div
          className={isFullscreen ? "relative min-h-0 flex-1" : undefined}
        >
          <textarea
            className={[
              "w-full rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none",
              "focus:ring-2 focus:ring-[#1E88E5]/40",
              contentInvalid ? "ring-2 ring-[#FF3B30]/50" : "",
              isFullscreen
                ? "absolute inset-0 resize-none overflow-y-auto overscroll-contain"
                : "min-h-[12rem] resize-y",
            ].join(" ")}
            placeholder={FORM3_PHASE_B_ASSESSMENT_PLACEHOLDER}
            value={interpretation}
            onChange={(e) => onInterpretationChange(e.target.value)}
            aria-invalid={contentInvalid}
            aria-required
          />
        </div>
        {contentInvalid ? (
          <span className="mt-1.5 shrink-0 text-[12px] text-[#C0392B]">
            解釈・分析を入力してください
          </span>
        ) : null}
      </div>
      <span className="sr-only">
        evidenceInformationIds selected: {selectedIds.join(",")}
      </span>
    </div>
  );
}

export default function Form3AssessmentDialog({
  open,
  mode,
  informationOptions,
  initial = null,
  onClose,
  onSubmit,
}: Form3AssessmentDialogProps) {
  const titleId = useId();
  const evidenceLegendId = useId();
  const [selectedIds, setSelectedIds] = useState<string[]>(
    () => initial?.evidenceInformationIds ?? [],
  );
  const [interpretation, setInterpretation] = useState(
    () => initial?.interpretation ?? "",
  );
  const [attempted, setAttempted] = useState(false);

  if (!open) return null;

  const trimmed = interpretation.trim();

  function toggleEvidence(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit() {
    setAttempted(true);
    if (selectedIds.length === 0 || trimmed.length === 0) return;
    onSubmit({
      evidenceInformationIds: selectedIds,
      interpretation: trimmed,
    });
  }

  return (
    <Form3FloatingEditorShell
      title={mode === "add" ? "解釈・分析を追加" : "解釈・分析を編集"}
      titleId={titleId}
      onClose={onClose}
      storageKey="form3-assessment-editor"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center rounded-full px-5 text-[15px] font-medium text-[#6E6E73] hover:bg-[#F2F2F7]"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex min-h-[44px] items-center rounded-full bg-[#1E88E5] px-6 text-[15px] font-semibold text-white hover:opacity-95"
          >
            {mode === "add" ? "登録" : "保存"}
          </button>
        </div>
      }
    >
      <Form3AssessmentEditorBody
        informationOptions={informationOptions}
        selectedIds={selectedIds}
        interpretation={interpretation}
        attempted={attempted}
        evidenceLegendId={evidenceLegendId}
        onToggleEvidence={toggleEvidence}
        onInterpretationChange={setInterpretation}
      />
    </Form3FloatingEditorShell>
  );
}
