// Compass Version2 Sprint2-1 — Server Action 呼び出しのクライアント境界共通処理。
//
// 目的:
//   通信断・サーバ停止・Server Action の Promise reject が発生しても、
//   呼び出し側（hooks）が saving / working のまま固まらないようにする。
//
// 方針:
//   ・Server Action が通常の Result（{ok:true} | {ok:false, kind, ...}）を返した場合は、
//     その Result をそのまま返す（Repository / Server Action の Result 設計は変更しない）。
//   ・Promise が reject した場合のみ、クライアントで扱える安全なエラーへ正規化する。
//   ・生の Error / stack / Supabase / DB 情報は画面へ返さない（固定の日本語のみ）。
//   ・既存の ActionErrorKind は変更しない（影響範囲を抑えるため専用型を分離する）。
//
// これは純粋な関数モジュール（React 非依存）で、クライアント hooks から利用する。

// callAction が reject を正規化して返すときの、クライアント専用のエラー種別。
// 既存の ActionErrorKind（サーバ由来）とは別物で、クライアント境界の失敗を表す。
export type ClientCallErrorKind = "network" | "unexpected";

export interface ClientCallError {
  ok: false;
  kind: ClientCallErrorKind;
  message: string;
}

// 画面に出す固定メッセージ（技術用語・DB情報・stack を含めない）。
const NETWORK_MESSAGE =
  "保存できませんでした。通信状況を確認して、もう一度お試しください。";
const UNEXPECTED_MESSAGE =
  "保存できませんでした。しばらくしてから、もう一度お試しください。";

// fetch 失敗は TypeError（Chrome: "Failed to fetch" / Safari: "Load failed" 等）。
// 判別できないものは unexpected 扱いにする（いずれも画面表示は安全な固定文）。
function isNetworkError(err: unknown): boolean {
  if (typeof TypeError !== "undefined" && err instanceof TypeError) return true;
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : "";
  return /fetch|network|load failed|networkerror|err_|econn|timeout/i.test(
    message,
  );
}

// Server Action を安全に実行する。
//   ・run() が解決した場合は、その Result（型 T）をそのまま返す。
//   ・run() が reject した場合のみ ClientCallError へ正規化する。
// この関数自体は決して reject しない（呼び出し側は saving / working を確実に解除できる）。
export async function callAction<T extends { ok: boolean }>(
  run: () => Promise<T>,
): Promise<T | ClientCallError> {
  try {
    return await run();
  } catch (err: unknown) {
    if (isNetworkError(err)) {
      return { ok: false, kind: "network", message: NETWORK_MESSAGE };
    }
    return { ok: false, kind: "unexpected", message: UNEXPECTED_MESSAGE };
  }
}

// テスト・呼び出し側で固定メッセージを参照するためのエクスポート。
export const CALL_ACTION_MESSAGES = {
  network: NETWORK_MESSAGE,
  unexpected: UNEXPECTED_MESSAGE,
} as const;
