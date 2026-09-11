"use client";

// Phase 2 Step 1: 情報の追加・編集。フローティング作業ウィンドウ（背景カルテ操作可）。

import { useId, useState } from "react";
import Form3FloatingEditorShell, {
  useForm3FloatEditor,
} from "@/components/v2/form3/Form3FloatingEditorShell";
import type { Form3SoType } from "@/lib/form3/v2/form3V2Types";

export type Form3InformationDialogValues = {
  soType: Form3SoType;
  content: string;
};

export type Form3InformationDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  initial?: Partial<Form3InformationDialogValues> | null;
  onClose: () => void;
  onSubmit: (values: Form3InformationDialogValues) => void;
};

export default function Form3InformationDialog({
  open,
  mode,
  initial = null,
  onClose,
  onSubmit,
}: Form3InformationDialogProps) {
  const titleId = useId();
  const kindGroupId = useId();
  // Parent remounts via key on open; seed from initial once.
  const [soType, setSoType] = useState<Form3SoType>(
    () => (initial?.soType === "O" ? "O" : "S"),
  );
  const [content, setContent] = useState(() => initial?.content ?? "");
  const [attempted, setAttempted] = useState(false);

  if (!open) return null;

  const trimmed = content.trim();
  const contentInvalid = attempted && trimmed.length === 0;

  function handleSubmit() {
    setAttempted(true);
    if (trimmed.length === 0) return;
    onSubmit({ soType, content: trimmed });
  }

  return (
    <Form3FloatingEditorShell
      title={mode === "add" ? "情報を追加" : "情報を編集"}
      titleId={titleId}
      onClose={onClose}
      storageKey="form3-information-editor"
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
      <Form3InformationEditorBody
        kindGroupId={kindGroupId}
        soType={soType}
        content={content}
        contentInvalid={contentInvalid}
        onSoTypeChange={setSoType}
        onContentChange={setContent}
      />
    </Form3FloatingEditorShell>
  );
}

function Form3InformationEditorBody({
  kindGroupId,
  soType,
  content,
  contentInvalid,
  onSoTypeChange,
  onContentChange,
}: {
  kindGroupId: string;
  soType: Form3SoType;
  content: string;
  contentInvalid: boolean;
  onSoTypeChange: (value: Form3SoType) => void;
  onContentChange: (value: string) => void;
}) {
  const { isFullscreen } = useForm3FloatEditor();
  return (
    <div
      className={
        isFullscreen
          ? "min-h-0 flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
          : undefined
      }
    >
      <fieldset className="m-0 border-0 p-0">
        <legend
          id={kindGroupId}
          className="text-[13px] font-semibold text-[#1D1D1F]"
        >
          情報の種類
        </legend>
        <div
          role="radiogroup"
          aria-labelledby={kindGroupId}
          className="mt-2.5 flex flex-col gap-2"
        >
          <label
            className={[
              "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl px-3.5 ring-1 transition-colors",
              soType === "S"
                ? "bg-[#EAF4FC] ring-[#1E88E5]/35"
                : "bg-[#F7F7F8] ring-transparent",
            ].join(" ")}
          >
            <input
              type="radio"
              name="form3-info-so-type"
              className="h-5 w-5 accent-[#1E88E5]"
              checked={soType === "S"}
              onChange={() => onSoTypeChange("S")}
            />
            <span className="text-[15px] font-medium text-[#1D1D1F]">
              S情報（主観的情報）
            </span>
          </label>
          <label
            className={[
              "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl px-3.5 ring-1 transition-colors",
              soType === "O"
                ? "bg-[#F2F2F7] ring-[#C7C7CC]"
                : "bg-[#F7F7F8] ring-transparent",
            ].join(" ")}
          >
            <input
              type="radio"
              name="form3-info-so-type"
              className="h-5 w-5 accent-[#1E88E5]"
              checked={soType === "O"}
              onChange={() => onSoTypeChange("O")}
            />
            <span className="text-[15px] font-medium text-[#1D1D1F]">
              O情報（客観的情報）
            </span>
          </label>
        </div>
      </fieldset>

      <label className="mt-5 block">
        <span className="text-[13px] font-semibold text-[#1D1D1F]">内容</span>
        <textarea
          className={[
            "mt-2 min-h-[9rem] w-full resize-y rounded-2xl border-0 bg-[#F2F2F7] px-4 py-3 text-[16px] leading-relaxed text-[#1D1D1F] outline-none",
            "focus:ring-2 focus:ring-[#1E88E5]/40",
            contentInvalid ? "ring-2 ring-[#FF3B30]/50" : "",
          ].join(" ")}
          placeholder="観察や会話で得た事実を記入してください"
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          aria-invalid={contentInvalid}
          aria-required
        />
        {contentInvalid ? (
          <span className="mt-1.5 block text-[12px] text-[#C0392B]">
            内容を入力してください
          </span>
        ) : null}
      </label>
    </div>
  );
}
