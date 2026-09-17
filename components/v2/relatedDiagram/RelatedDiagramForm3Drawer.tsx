"use client";

import { useEffect, useRef, useState } from "react";
import type { Form3PatternKey } from "@/lib/form3/form3Types";
import {
  form3AssessmentSelectionOriginKey,
  form3InformationOriginKey,
  form3PatternTabLabel,
  type RelatedDiagramForm3AssessmentSource,
  type RelatedDiagramForm3InformationSource,
  type RelatedDiagramForm3ReadModel,
} from "@/lib/v2/relatedDiagram/form3AssessmentReadModel";
import {
  highlightAssessmentText,
  selectionFromWindow,
  type NormalizedAssessmentSelection,
} from "@/lib/v2/relatedDiagram/form3AssessmentSelection";
import {
  canCommitAssessmentCompose,
  createAssessmentComposeDraft,
  type AssessmentComposeDraft,
} from "@/lib/v2/relatedDiagram/form3ToUnderstandingCard";
import type { RelatedDiagramCardState } from "@/lib/v2/relatedDiagram/types";

export type Form3DrawerMode = "information" | "assessment";

function isolateDrawerPointer(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

function AssessmentSelectableText({
  assessment,
  highlightStart,
  highlightEnd,
  added,
  onAddSelection,
}: {
  assessment: RelatedDiagramForm3AssessmentSource;
  highlightStart?: number | null;
  highlightEnd?: number | null;
  added: (selection: NormalizedAssessmentSelection) => boolean;
  onAddSelection: (
    source: RelatedDiagramForm3AssessmentSource,
    selection: NormalizedAssessmentSelection,
  ) => void;
}) {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [selection, setSelection] = useState<NormalizedAssessmentSelection | null>(
    null,
  );

  useEffect(() => {
    const read = () => {
      const el = textRef.current;
      if (!el) return;
      const next = selectionFromWindow(el, assessment.assessmentText);
      setSelection(next);
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, [assessment.assessmentText]);

  const highlight = highlightAssessmentText(
    assessment.assessmentText,
    highlightStart,
    highlightEnd,
  );
  const already = selection ? added(selection) : false;

  return (
    <div>
      <p
        ref={textRef}
        data-rd-form3-assessment-text
        data-rd-native-select="true"
        className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1D1D1F]"
        style={{
          userSelect: "text",
          WebkitUserSelect: "text",
          touchAction: "auto",
          cursor: "text",
        }}
      >
        {highlight ? (
          <>
            {highlight.before}
            <mark data-rd-form3-selection-highlight className="bg-[#FFF3B0]">
              {highlight.selected}
            </mark>
            {highlight.after}
          </>
        ) : (
          assessment.assessmentText
        )}
      </p>
      <button
        type="button"
        data-rd-form3-add-selection
        disabled={!selection || already}
        onClick={() => {
          if (!selection || already) return;
          onAddSelection(assessment, selection);
        }}
        className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#0A5FCC] px-3 text-[14px] font-medium text-white disabled:bg-[#C7C7CC]"
      >
        {already ? "追加済み" : "選択部分を関連図に追加"}
      </button>
    </div>
  );
}

function AssessmentComposeView({
  draft,
  onChangeEditedText,
  onChangeState,
  onCancel,
  onCommit,
}: {
  draft: AssessmentComposeDraft;
  onChangeEditedText: (text: string) => void;
  onChangeState: (state: RelatedDiagramCardState) => void;
  onCancel: () => void;
  onCommit: () => void;
}) {
  const canAdd = canCommitAssessmentCompose(draft);
  return (
    <div
      data-rd-form3-compose
      className="flex flex-col gap-3"
      onPointerDown={isolateDrawerPointer}
    >
      <h3 className="text-[16px] font-semibold text-[#1D1D1F]">カードを作成</h3>
      <section>
        <p className="mb-1 text-[13px] text-[#6E6E73]">引用した部分</p>
        <div
          data-rd-form3-compose-quote
          className="whitespace-pre-wrap break-words rounded-lg border border-[#E5E5EA] bg-[#F5F5F7] px-3 py-3 text-[14px] leading-relaxed text-[#1D1D1F]"
        >
          {draft.selection.selectedText}
        </div>
      </section>
      <section>
        <label
          htmlFor="rd-form3-compose-text"
          className="mb-1 block text-[13px] text-[#6E6E73]"
        >
          カードに表示する内容
        </label>
        <textarea
          id="rd-form3-compose-text"
          data-rd-form3-compose-text
          value={draft.editedText}
          onChange={(event) => onChangeEditedText(event.target.value)}
          onPointerDown={isolateDrawerPointer}
          onPointerMove={isolateDrawerPointer}
          onPointerUp={isolateDrawerPointer}
          rows={5}
          enterKeyHint="done"
          autoComplete="off"
          className="w-full resize-y rounded-lg border border-[#E5E5EA] px-3 py-3 leading-relaxed text-[#1D1D1F]"
          style={{
            fontSize: 16,
            minHeight: 88,
            userSelect: "text",
            WebkitUserSelect: "text",
            touchAction: "auto",
          }}
        />
      </section>
      <section>
        <p className="mb-2 text-[13px] text-[#6E6E73]">状態</p>
        <div className="flex gap-2">
          <button
            type="button"
            data-rd-form3-compose-state="current"
            aria-pressed={draft.state === "current"}
            onClick={() => onChangeState("current")}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-[14px] ${
              draft.state === "current"
                ? "bg-[#1D1D1F] font-medium text-white"
                : "border border-[#E5E5EA] text-[#1D1D1F]"
            }`}
          >
            顕在
          </button>
          <button
            type="button"
            data-rd-form3-compose-state="potential"
            aria-pressed={draft.state === "potential"}
            onClick={() => onChangeState("potential")}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-[14px] ${
              draft.state === "potential"
                ? "bg-[#1D1D1F] font-medium text-white"
                : "border border-[#E5E5EA] text-[#1D1D1F]"
            }`}
          >
            潜在
          </button>
        </div>
      </section>
      <div className="flex gap-2">
        <button
          type="button"
          data-rd-form3-compose-cancel
          onClick={onCancel}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#E5E5EA] px-3 text-[14px] text-[#1D1D1F]"
        >
          キャンセル
        </button>
        <button
          type="button"
          data-rd-form3-compose-add
          disabled={!canAdd}
          onClick={onCommit}
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-[#0A5FCC] px-3 text-[14px] font-medium text-white disabled:bg-[#C7C7CC]"
        >
          関連図に追加
        </button>
      </div>
    </div>
  );
}

export default function RelatedDiagramForm3Drawer({
  open,
  model,
  selectedPatternId,
  mode,
  focusedAssessmentId,
  focusedInformationId,
  highlightStart,
  highlightEnd,
  addedOriginKeys,
  onClose,
  onSelectPattern,
  onSelectMode,
  onAddInformation,
  onAddAssessmentSelection,
}: {
  open: boolean;
  model: RelatedDiagramForm3ReadModel;
  selectedPatternId: Form3PatternKey;
  mode: Form3DrawerMode;
  focusedAssessmentId?: string | null;
  focusedInformationId?: string | null;
  highlightStart?: number | null;
  highlightEnd?: number | null;
  addedOriginKeys: ReadonlySet<string>;
  onClose: () => void;
  onSelectPattern: (patternId: Form3PatternKey) => void;
  onSelectMode: (mode: Form3DrawerMode) => void;
  onAddInformation: (source: RelatedDiagramForm3InformationSource) => void;
  onAddAssessmentSelection: (
    source: RelatedDiagramForm3AssessmentSource,
    selection: NormalizedAssessmentSelection,
    compose: { editedText: string; state: RelatedDiagramCardState },
  ) => void;
}) {
  const focusRef = useRef<HTMLLIElement | null>(null);
  const [compose, setCompose] = useState<AssessmentComposeDraft | null>(null);

  useEffect(() => {
    if (!open) setCompose(null);
  }, [open]);

  useEffect(() => {
    if (!open || compose) return;
    focusRef.current?.scrollIntoView({ block: "nearest" });
  }, [
    open,
    compose,
    mode,
    selectedPatternId,
    focusedAssessmentId,
    focusedInformationId,
  ]);

  if (!open) return null;
  const selected =
    model.patterns.find((pattern) => pattern.patternId === selectedPatternId) ??
    model.patterns[0]!;

  return (
    <aside
      data-rd-form3-drawer
      data-rd-editor-drawer
      aria-label="様式3"
      className="absolute inset-y-0 right-0 z-40 flex flex-col border-l border-[#E5E5EA] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
      style={{
        width: "min(420px, 42vw)",
        touchAction: "pan-y",
        overscrollBehavior: "contain",
      }}
      onPointerDown={isolateDrawerPointer}
      onPointerMove={isolateDrawerPointer}
      onPointerUp={isolateDrawerPointer}
      onWheel={isolateDrawerPointer}
    >
      <div
        data-rd-editor-drawer-header
        className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-[#E5E5EA] px-3"
      >
        <h2 className="text-[16px] font-semibold text-[#1D1D1F]">様式3</h2>
        <button
          type="button"
          data-rd-form3-drawer-close
          aria-label="様式3を閉じる"
          onClick={() => {
            setCompose(null);
            onClose();
          }}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-[#E5E5EA] text-[18px] text-[#1D1D1F]"
        >
          ×
        </button>
      </div>

      {compose ? null : (
      <>
      <div
        data-rd-form3-pattern-tabs
        className="shrink-0 overflow-x-auto border-b border-[#E5E5EA] px-2 py-1"
        style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex w-max gap-1">
          {model.patterns.map((pattern) => {
            const active = pattern.patternId === selected.patternId;
            return (
              <button
                key={pattern.patternId}
                type="button"
                data-rd-form3-pattern={pattern.patternId}
                aria-pressed={active}
                onClick={() => onSelectPattern(pattern.patternId)}
                className={`inline-flex min-h-[44px] shrink-0 items-center rounded-lg px-3 text-[13px] ${
                  active
                    ? "bg-[#F0F7FF] font-medium text-[#0A5FCC]"
                    : "text-[#1D1D1F]"
                }`}
              >
                {form3PatternTabLabel(pattern.patternId)}
              </button>
            );
          })}
        </div>
      </div>

      <div
        data-rd-form3-mode
        className="flex shrink-0 gap-2 border-b border-[#E5E5EA] px-3 py-2"
      >
        <button
          type="button"
          data-rd-form3-mode-information
          aria-pressed={mode === "information"}
          onClick={() => onSelectMode("information")}
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-[14px] ${
            mode === "information"
              ? "bg-[#1D1D1F] font-medium text-white"
              : "border border-[#E5E5EA] text-[#1D1D1F]"
          }`}
        >
          情報
        </button>
        <button
          type="button"
          data-rd-form3-mode-assessment
          aria-pressed={mode === "assessment"}
          onClick={() => onSelectMode("assessment")}
          className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg text-[14px] ${
            mode === "assessment"
              ? "bg-[#1D1D1F] font-medium text-white"
              : "border border-[#E5E5EA] text-[#1D1D1F]"
          }`}
        >
          アセスメント
        </button>
      </div>
      </>
      )}

      <div
        data-rd-form3-drawer-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        style={{ touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
      >
        {compose ? (
          <AssessmentComposeView
            draft={compose}
            onChangeEditedText={(editedText) =>
              setCompose((current) =>
                current ? { ...current, editedText } : current,
              )
            }
            onChangeState={(state) =>
              setCompose((current) =>
                current ? { ...current, state } : current,
              )
            }
            onCancel={() => setCompose(null)}
            onCommit={() => {
              if (!canCommitAssessmentCompose(compose) || compose.state == null) {
                return;
              }
              onAddAssessmentSelection(
                compose.source,
                compose.selection,
                { editedText: compose.editedText, state: compose.state },
              );
              setCompose(null);
            }}
          />
        ) : mode === "information" ? (
          selected.informations.length === 0 ? (
            <p className="text-[14px] text-[#6E6E73]">
              このパターンにタグされた情報はありません。
            </p>
          ) : (
            <ul className="space-y-3">
              {selected.informations.map((information) => {
                const originKey = form3InformationOriginKey(information);
                const already = addedOriginKeys.has(originKey);
                const focused =
                  focusedInformationId === information.informationId;
                return (
                  <li
                    key={information.informationId}
                    ref={focused ? focusRef : undefined}
                    data-rd-form3-information={information.informationId}
                    data-rd-form3-information-focused={
                      focused ? "true" : undefined
                    }
                    className={`rounded-lg border px-3 py-3 ${
                      focused
                        ? "border-[#0A5FCC] bg-[#F0F7FF]"
                        : "border-[#E5E5EA]"
                    }`}
                  >
                    <p className="mb-1 text-[12px] text-[#6E6E73]">
                      {information.soType ?? "—"}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1D1D1F]">
                      {information.content}
                    </p>
                    <button
                      type="button"
                      data-rd-form3-add
                      disabled={already}
                      onClick={() => onAddInformation(information)}
                      className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-[#0A5FCC] px-3 text-[14px] font-medium text-white disabled:bg-[#C7C7CC]"
                    >
                      {already ? "追加済み" : "関連図に追加"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        ) : selected.assessments.length === 0 ? (
          <p className="text-[14px] text-[#6E6E73]">
            このパターンにはAssessmentがありません。
          </p>
        ) : (
          <ul className="space-y-3">
            {selected.assessments.map((assessment) => {
              const focused = focusedAssessmentId === assessment.assessmentId;
              return (
                <li
                  key={assessment.assessmentId}
                  ref={focused ? focusRef : undefined}
                  data-rd-form3-assessment={assessment.assessmentId}
                  data-rd-form3-assessment-focused={
                    focused ? "true" : undefined
                  }
                  className={`rounded-lg border px-3 py-3 ${
                    focused
                      ? "border-[#0A5FCC] bg-[#F0F7FF]"
                      : "border-[#E5E5EA]"
                  }`}
                >
                  <p className="mb-1 text-[12px] text-[#6E6E73]">
                    {assessment.patternName}
                    {assessment.judgmentLabel
                      ? ` · ${assessment.judgmentLabel}`
                      : ""}
                    {assessment.hasEvidence ? " · 根拠情報あり" : ""}
                  </p>
                  <AssessmentSelectableText
                    assessment={assessment}
                    highlightStart={focused ? highlightStart : null}
                    highlightEnd={focused ? highlightEnd : null}
                    added={(sel) =>
                      addedOriginKeys.has(
                        form3AssessmentSelectionOriginKey({
                          form3RecordId: assessment.form3RecordId,
                          assessmentId: assessment.assessmentId,
                          selectionStart: sel.selectionStart,
                          selectionEnd: sel.selectionEnd,
                        }),
                      )
                    }
                    onAddSelection={(source, selection) =>
                      setCompose(createAssessmentComposeDraft(source, selection))
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
