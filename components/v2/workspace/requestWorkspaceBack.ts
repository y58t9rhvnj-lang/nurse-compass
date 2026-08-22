/**
 * 様式ワークスペースの「戻る」ガード（C3）。
 * Autosave / Conflict 契約は変更せず、確認ダイアログのみ。
 */

export type WorkspaceBackSaveKind =
  | "ready"
  | "saved"
  | "draft"
  | "saving"
  | "error"
  | "conflict";

export function requestWorkspaceBack(args: {
  kind: WorkspaceBackSaveKind;
  onProceed: () => void;
}): void {
  const { kind, onProceed } = args;
  if (kind === "ready" || kind === "saved") {
    onProceed();
    return;
  }
  if (kind === "saving") {
    const ok = window.confirm(
      "保存処理中です。完了を待たずに戻りますか？\n（可能なら「キャンセル」して保存完了を待ってください）",
    );
    if (ok) onProceed();
    return;
  }
  if (kind === "draft") {
    const ok = window.confirm(
      "未保存の変更がある可能性があります。自動保存を待たずに戻りますか？",
    );
    if (ok) onProceed();
    return;
  }
  if (kind === "error") {
    const ok = window.confirm(
      "保存に失敗しています。このまま戻ると変更が失われる可能性があります。戻りますか？",
    );
    if (ok) onProceed();
    return;
  }
  if (kind === "conflict") {
    const ok = window.confirm(
      "他の画面で更新されています。このまま戻りますか？",
    );
    if (ok) onProceed();
  }
}
