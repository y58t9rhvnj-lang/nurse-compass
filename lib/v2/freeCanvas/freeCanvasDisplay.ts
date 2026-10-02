export type FreeCanvasPersistStatus =
  | "unsaved"
  | "saving"
  | "saved"
  | "conflict"
  | "error";

export function freeCanvasPersistLabel(status: FreeCanvasPersistStatus): string {
  if (status === "saving") return "保存中…";
  if (status === "saved") return "保存済み";
  if (status === "conflict") return "他の場所で更新されています";
  if (status === "error") return "保存できませんでした";
  return "未保存";
}
