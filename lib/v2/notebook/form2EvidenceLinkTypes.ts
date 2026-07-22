// Compass Version2 — Learning Layer (Sprint D-2B)
// form2_evidence_links の Server Action 戻り値（Result）型。
//
// 方針（既存 information_cards / form2 の Result 設計を踏襲）:
//   ・戻り値は判別可能なユニオン（ok:true/false）。UI へは分類済みの kind のみ返す。
//   ・DB の生エラー・内部情報は返さない。

import type { Form2EvidenceLink } from "./form2EvidenceLinkMapper";
import type { ActionErrorKind, Form2Snapshot } from "./types";

export type LinkListResult =
  | { ok: true; data: Form2EvidenceLink[] }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

// リンク作成結果。
//   ・duplicate（同一リンクが既存）は「整理済み」として成功扱いにできる。
//   ・form2 レコードが未作成だった場合はサーバが空レコードを用意し、確定 snapshot を同梱する
//     （クライアントは AppShell のセッション snapshot を同期し、様式2 の初回保存競合を避ける）。
export type LinkCreateResult =
  | {
      ok: true;
      data: Form2EvidenceLink | null; // duplicate 時は null（既存を list で取り直す）
      duplicate: boolean;
      form2Ensured: Form2Snapshot | null; // 空レコードを新規作成したときのみ非 null
    }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };

export type LinkDeleteResult =
  | { ok: true }
  | { ok: false; kind: Exclude<ActionErrorKind, "conflict">; message: string };
