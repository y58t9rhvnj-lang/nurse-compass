/**
 * 保存成功時刻の表示整形（Form2 / Form3 共用）。
 *
 * 正本はサーバーが返した updatedAt（ISO）。表示は常に Asia/Tokyo。
 * timezone なしの ISO（例: 2026-08-20T15:25:00）は UTC と解釈する
 * （ES の「ローカル扱い」による 9 時間ズレを避ける）。固定の +9h 加算はしない。
 */

const TOKYO = "Asia/Tokyo";

/** サーバー ISO を Date に。offset/Z 無しは UTC として扱う。 */
export function parseServerDateTime(iso: string): Date | null {
  const raw = iso.trim();
  if (!raw) return null;

  // 日付のみや不正は弾く
  let normalized = raw;
  // "2026-08-20 15:25:00.123456+00" → ISO っぽく
  if (/^\d{4}-\d{2}-\d{2} /.test(normalized)) {
    normalized = normalized.replace(" ", "T");
  }
  // timezone 情報がない場合は UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function tokyoYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TOKYO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * 最終保存時刻の短表示。
 * - 当日（東京）: `0:25` / `00:25`（hour12: false）
 * - それ以外: `8/20 23:58`
 */
export function formatSavedAtJa(
  iso: string,
  now: Date = new Date(),
): string {
  const d = parseServerDateTime(iso);
  if (!d) return "";

  const sameDay = tokyoYmd(d) === tokyoYmd(now);
  if (sameDay) {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: TOKYO,
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TOKYO,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
