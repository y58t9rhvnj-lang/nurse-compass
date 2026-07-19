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
// ハッシュ方式について:
//   ・以前は Web Crypto（crypto.subtle）の SHA-256 を使っていたが、iPad Safari では
//     非セキュアコンテキスト（LAN 内 http://）で crypto.subtle が undefined となり
//     例外が発生する。環境によって方式を切り替えると端末ごとに id が変わり TD-001 が
//     再発するため、全環境で同一の非暗号学的ハッシュ（FNV-1a 64bit）に統一する。
//   ・FNV-1a は決定的で外部依存がなく、TextEncoder（Safari/Node 双方で利用可）だけで
//     UTF-8 バイト列を得て計算する。Math.random・日時・端末依存値は一切使わない。

export const CONVERSATION_SOURCE_KIND = "patient_conversation";

// 会話原文を決定的に正規化する（両側で完全一致させるため単純に保つ）。
function normalizeUtterance(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

// FNV-1a 32bit。BigInt を使わず Math.imul で 32bit 乗算を厳密に行う
//（tsconfig の target 依存を避け、全環境で同一結果にするため）。
const FNV_PRIME_32 = 0x01000193;
const FNV_OFFSET_BASIS_32 = 0x811c9dc5;

function fnv1a32(bytes: Uint8Array, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, FNV_PRIME_32) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// 原文から安定した出所 id を導出する（全環境で同一アルゴリズム）。
// 32bit FNV-1a を異なる seed で 2 回計算して連結し、64bit 相当の 16 桁 hex を返す。
// 1 学生・1 ケースの会話量では衝突確率は無視できる。
// 空文字・日本語・絵文字・長文でも例外を出さない（TextEncoder はサロゲートも安全に処理）。
// async / Promise<string> のシグネチャは既存呼び出し側（await 前提）維持のため保つ。
export async function conversationSourceId(originalText: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizeUtterance(originalText));
  const high = fnv1a32(bytes, FNV_OFFSET_BASIS_32);
  // 2 本目は seed を変え、独立性を高めて衝突を抑える。
  const low = fnv1a32(bytes, (FNV_OFFSET_BASIS_32 ^ 0x9e3779b1) >>> 0);
  return high + low;
}
