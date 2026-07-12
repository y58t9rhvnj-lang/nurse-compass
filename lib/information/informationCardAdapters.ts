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
} from "./informationCard";

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
    sourceReference: { kind: "student_note", id: note.id },
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
