// 気づきメモ（Sprint7）: 学生が患者を理解するために残す自由記述メモ。
// カテゴリ分類など拡張フィールドは将来（B/C）で追加する。
export interface Note {
  id: string;
  patientId: string;
  text: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
}
