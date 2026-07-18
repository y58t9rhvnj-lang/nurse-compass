// Compass Version2 — Sprint2-2A（TD-001 最小実装）
//
// 会話由来 Evidence の出所参照 id を「位置ベース（`${patientId}-${index}`）」から
// 「原文の SHA-256（短縮）」へ変更するための、クライアント・サーバ共通の hash 導出。
//
// 目的:
//   ・会話状態はメモリ保持のみでリロードすると index が振り直されるため、位置ベース id は
//     セッションを跨いで別発言へ再利用され、偽の重複衝突・収集漏れ（TD-001）を起こす。
//   ・出所 id を「原文の内容」に紐づけることで、セッションを跨いでも同一発言＝同一 id となり、
//     二重収集防止（uq_information_cards_source）が正しく機能する。
//
// 重要:
//   ・クライアント（収集済み判定・収集）とサーバ（createCardAction の再計算）が
//     完全に同一の値を導出できるよう、正規化・ハッシュ手順をこの 1 箇所へ集約する。
//   ・サーバは必ず original_text から再計算し、クライアントから送られた id は信用しない。
//   ・DB スキーマ・一意インデックス・不変トリガーは変更しない（`{kind,id}` 形状のまま）。
//
// Web Crypto（crypto.subtle）はブラウザおよび Node（サーバ Action 実行環境）双方で利用できる。

export const CONVERSATION_SOURCE_KIND = "patient_conversation";

// 会話原文を決定的に正規化する（両側で完全一致させるため単純に保つ）。
function normalizeUtterance(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

// 原文から安定した出所 id を導出する。
// SHA-256 の hex を 32 文字（128bit 相当）へ短縮する。
// 1 学生・1 ケースの会話量では衝突確率は無視できる。
export async function conversationSourceId(originalText: string): Promise<string> {
  const data = new TextEncoder().encode(normalizeUtterance(originalText));
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 32);
}
