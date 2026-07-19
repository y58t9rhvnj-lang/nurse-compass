// Sprint11.1: 既存 Note ⇄ Information Card 互換アダプター。
// 重要（今回の制約）:
//   - 既存 Note の保存データを migration しない
//   - Note と Card を自動同期しない
//   - 既存 Note を勝手に Card へ複製しない
//   - 変換は明示的に呼ばれた場合だけ行う
// 本 Sprint では「Note → Card」方向を優先し、逆変換は設計（下書き）のみ。

import type { Note } from "../notes";
import {
  createInformationCard,
  type InformationCard,
  type InformationSourceReference,
} from "./informationCard";

// Compassメモ（気づきメモ / NoteZone）由来 Evidence の出所種別。
// information_cards の二重収集防止インデックス（source_reference.kind + id）と、
// 「元メモへ戻る／Evidence 整理済み判定」に用いる。ここで一元管理し、
// Supabase 保存経路（useEvidenceSupabase.collectMemo）からも再利用する。
export const STUDENT_NOTE_SOURCE_KIND = "student_note";

// Compassメモの note.id から Evidence の出所参照を作る。
// これを sourceReference に付けることで、DB の一意制約で同一メモの重複 Evidence 化を防ぎ、
// UI では isCollectedBySource(kind, note.id) で「整理済み」を判定できる。
export function studentNoteSourceReference(
  noteId: string,
): InformationSourceReference {
  return { kind: STUDENT_NOTE_SOURCE_KIND, id: noteId };
}

// 単一の Note を Information Card へ変換する（明示呼び出し時のみ）。
// patientId を明示指定できるが、未指定なら Note 自身の patientId を用いる。
export function noteToInformationCard(
  note: Note,
  patientId?: string,
): InformationCard {
  return createInformationCard({
    patientId: patientId ?? note.patientId,
    content: note.text,
    sourceType: "student_note",
    sourceLabel: "学生メモ",
    createdBy: "student",
    createdAt: new Date(note.createdAt).toISOString(),
    originalText: note.text,
    // 出所（元メモ）への参照を保持。遷移UIは今回未実装。
    sourceReference: studentNoteSourceReference(note.id),
  });
}

// 複数 Note の一括変換。空本文は変換対象外（不正カードを生まない）。
export function notesToInformationCards(
  notes: Note[],
  patientId?: string,
): InformationCard[] {
  const cards: InformationCard[] = [];
  for (const note of notes) {
    if (typeof note.text !== "string" || note.text.trim() === "") continue;
    cards.push(noteToInformationCard(note, patientId));
  }
  return cards;
}

// Sprint11.2 / 12.2B: 患者発言 → Information Card（収集データ）。
// 会話エントリID（entryId）を sourceReference に保持し、元会話への出所を維持する。
// content は学生が収集ダイアログで整えた「保存する内容」、originalText は患者発言の元全文。
//   - options.originalText 未指定時は content を元データとして扱う（旧呼び出し互換）。
//   - options.observedAt があれば会話時刻として保持する。
export function patientUtteranceToInformationCard(
  patientId: string,
  entryId: string,
  content: string,
  options?: { originalText?: string; observedAt?: string },
): InformationCard {
  return createInformationCard({
    patientId,
    content,
    sourceType: "patient_conversation",
    sourceLabel: "患者との会話",
    createdBy: "student",
    originalText: options?.originalText ?? content,
    observedAt: options?.observedAt,
    sourceReference: { kind: "patient_conversation", id: entryId },
  });
}

// Sprint12.2B: 一時メモ（NoteZone）→ Information Card（収集データ）。
// Note ID を sourceReference に保持する。学生UIの出典表記は「一時メモ」。
// content は収集ダイアログで整えた内容、originalText は一時メモの元本文。
// observedAt があれば「メモを書いた時刻」として保持する（一覧の時系列表示に使う）。
// 元の一時メモ（Note ストア）はここでは変更・削除しない（別物として保持する）。
export function temporaryMemoToInformationCard(
  patientId: string,
  noteId: string,
  content: string,
  originalText: string,
  observedAt?: string,
): InformationCard {
  return createInformationCard({
    patientId,
    content,
    sourceType: "student_note",
    sourceLabel: "一時メモ",
    createdBy: "student",
    originalText,
    observedAt,
    sourceReference: studentNoteSourceReference(noteId),
  });
}

// 逆変換（設計のみ）: student_note 由来のカードから Note 下書きを作る。
// 実際の Note ストアへは書き込まない（自動同期しない）。将来必要時に配線する。
export interface NoteDraft {
  patientId: string;
  text: string;
}

export function informationCardToNoteDraft(card: InformationCard): NoteDraft {
  return {
    patientId: card.patientId,
    text: card.originalText ?? card.content,
  };
}
