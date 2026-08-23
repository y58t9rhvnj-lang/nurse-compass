import { parseServerDateTime } from "@/lib/datetime/formatSavedAtJa";

const TOKYO = "Asia/Tokyo";

function tokyoParts(iso: string) {
  const d = parseServerDateTime(iso);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO,
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** 提出日時・期限表示（例: 12月12日 16:59） */
export function formatAssessmentDateTimeJa(iso: string): string {
  const p = tokyoParts(iso);
  if (!p) return iso;
  return `${p.month}月${p.day}日 ${p.hour}:${p.minute}`;
}

/** 期限時刻のみ（例: 17:00） */
export function formatAssessmentTimeJa(iso: string): string {
  const p = tokyoParts(iso);
  if (!p) return "";
  return `${p.hour}:${p.minute}`;
}
