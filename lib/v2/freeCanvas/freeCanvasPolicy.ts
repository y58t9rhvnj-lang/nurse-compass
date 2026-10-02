import {
  FREE_CANVAS_DEFAULT_TITLE,
  FREE_CANVAS_TITLE_MAX,
} from "./freeCanvasTypes";

export function canManageFreeCanvas(
  role: string | null | undefined,
  isActive: boolean | null | undefined,
): boolean {
  return role === "student" && isActive === true;
}

export function normalizeFreeCanvasTitle(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export function validateFreeCanvasTitle(
  raw: string | null | undefined,
): { ok: true; title: string } | { ok: false; message: string } {
  const title = normalizeFreeCanvasTitle(raw);
  if (title === "") {
    return { ok: false, message: "名前を入力してください。" };
  }
  if (title.length > FREE_CANVAS_TITLE_MAX) {
    return { ok: false, message: `名前は${FREE_CANVAS_TITLE_MAX}文字以内にしてください。` };
  }
  return { ok: true, title };
}

export function defaultFreeCanvasTitle(): string {
  return FREE_CANVAS_DEFAULT_TITLE;
}
