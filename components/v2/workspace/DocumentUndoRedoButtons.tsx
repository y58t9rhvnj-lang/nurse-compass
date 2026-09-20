"use client";

export type DocumentUndoRedoButtonsProps = {
  canUndo: boolean;
  canRedo: boolean;
  locked?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onUndoPointerDown?: () => void;
  onRedoPointerDown?: () => void;
};

const buttonClass = (enabled: boolean) =>
  [
    "inline-flex h-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-2xl border px-2.5 text-[12px] font-semibold sm:h-12 sm:min-h-[48px] sm:px-3 sm:text-[13px]",
    "transition-[background-color,border-color,color,opacity] duration-150 ease-out motion-reduce:transition-none",
    enabled
      ? "border-[#D0D5DD] bg-white text-[#344054] hover:bg-[#F4F6F8]"
      : "cursor-not-allowed border-[#E5E5EA] bg-[#F2F2F7] text-[#98A2B3] opacity-50",
  ].join(" ");

/**
 * Shared Form2 / Form3 header Undo/Redo. Text labels required.
 * Print hidden via header no-print + local no-print.
 */
export default function DocumentUndoRedoButtons({
  canUndo,
  canRedo,
  locked = false,
  onUndo,
  onRedo,
  onUndoPointerDown,
  onRedoPointerDown,
}: DocumentUndoRedoButtonsProps) {
  const undoEnabled = canUndo && !locked;
  const redoEnabled = canRedo && !locked;

  return (
    <div
      data-form-undo-redo=""
      data-form3-undo-redo=""
      className="no-print mr-2 flex shrink-0 items-center gap-1 sm:mr-3 sm:gap-1.5"
    >
      <button
        type="button"
        data-form-undo=""
        data-form3-undo=""
        aria-label="戻す"
        disabled={!undoEnabled}
        onPointerDown={onUndoPointerDown}
        onClick={onUndo}
        className={buttonClass(undoEnabled)}
      >
        <span aria-hidden>↶</span>
        戻す
      </button>
      <button
        type="button"
        data-form-redo=""
        data-form3-redo=""
        aria-label="やり直す"
        disabled={!redoEnabled}
        onPointerDown={onRedoPointerDown}
        onClick={onRedo}
        className={buttonClass(redoEnabled)}
      >
        <span aria-hidden>↷</span>
        やり直す
      </button>
    </div>
  );
}
