// Sprint11.1: 検証・開発用のサンプル情報カード生成。
// 本番画面へ自動投入しない。テスト／動作確認からのみ利用する。

import {
  createInformationCard,
  type InformationCard,
} from "./informationCard";

// 患者ごとに、代表的な出所（患者発言／フローシート／診療録／学生メモ）の
// サンプルカードを生成する。実在カルテIDには依存しない検証用データ。
export function sampleInformationCards(patientId: string): InformationCard[] {
  const base = "2026-07-12T09:00:00.000Z";
  return [
    createInformationCard({
      patientId,
      content: "夜、なかなか寝つけないことがある。",
      sourceType: "patient_conversation",
      sourceLabel: "患者の発言",
      createdBy: "student",
      createdAt: base,
      originalText: "夜、なかなか寝つけないことがあります。",
      sourceReference: { kind: "patient_conversation" },
    }),
    createInformationCard({
      patientId,
      content: "夜間の幻聴と不眠・頓用睡眠薬使用",
      sourceType: "flowsheet",
      sourceLabel: "睡眠・頓服",
      createdBy: "student",
      createdAt: base,
      sourceReference: {
        kind: "flowsheetDate",
        date: "2025/07/06",
        tab: "フローシート",
      },
    }),
    createInformationCard({
      patientId,
      content: "夜間の幻聴で入眠困難。ラジオで対処、頓用睡眠薬を使用。",
      sourceType: "clinical_record",
      sourceLabel: "経過記録",
      createdBy: "student",
      createdAt: base,
      sourceReference: {
        kind: "recordId",
        id: "clinical-a-sleep-voices",
        tab: "診療録",
      },
    }),
    createInformationCard({
      patientId,
      content: "眠れない背景に気がかりがないか、次回確認したい。",
      sourceType: "student_note",
      sourceLabel: "学生メモ",
      createdBy: "student",
      createdAt: base,
      note: "対話の仮説",
    }),
  ];
}
