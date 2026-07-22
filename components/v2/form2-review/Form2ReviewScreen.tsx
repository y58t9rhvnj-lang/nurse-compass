"use client";

// Compass Version2 — 左メニュー「様式2」＝ 最終確認・印刷・提出専用画面（Sprint D-1 追加修正 ⑦）。
//
// 役割の分離:
//   ・思考ワークスペース … 患者情報・電子カルテ・会話を参照し、ノート/Coach を使って様式2 へ整理（編集）。
//   ・この画面（左メニュー様式2）… 完成した様式2 の最終確認・未入力確認・印刷・提出。
//     患者情報ペイン・電子カルテ・会話・ノート・Coach・Inspector・3 カラム Workspace は出さない。
//
// 実装方針（変更禁止事項の遵守）:
//   ・Form2 のデータ構造・DB・Supabase・保存処理は変更しない。既存 useForm2Supabase で
//     受け持ち様式2 を読み込み、既存 Form2SheetView（原本レイアウト）で全体を表示する。
//   ・提出は既存の DB 提出処理が無いため、新規 DB 処理は追加しない。ここでは保存済みの内容が
//     提出対象であることを確認する UI 導線のみを提供する（この端末内の確認状態）。

import { useState } from "react";
import { CheckCircle2, Printer, Send } from "lucide-react";
import Form2SheetView from "@/components/form2/Form2SheetView";
import { useForm2Supabase } from "@/hooks/v2/useForm2Supabase";
import {
  FORM2_HISTORY_KEYS,
  mergeTreatmentText,
  type Form2Data,
} from "@/lib/form2/form2Types";
import type { Form2Snapshot } from "@/lib/v2/notebook/types";
import type { Patient } from "@/lib/wardData";

// 未入力チェックの対象（原本の主要記入欄に対応）。history は 13 項目をまとめて 1 項目として扱う。
function collectMissing(data: Form2Data): string[] {
  const b = data.basicInformation;
  const missing: string[] = [];
  const req: [string, string][] = [
    ["学籍番号", data.student.studentNumber],
    ["学生氏名", data.student.studentName],
    ["受け持ち期間（開始）", data.period.start],
    ["受け持ち期間（終了）", data.period.end],
    ["患者氏名", b.patientName],
    ["年齢", b.age],
    ["性別", b.sex],
    ["診断名", b.diagnosis],
    ["既往歴", b.pastHistory],
    ["入院形態", b.admissionType],
    ["主訴", b.chiefComplaint],
    ["医師の治療方針・治療内容", mergeTreatmentText(data.treatment)],
  ];
  for (const [label, value] of req) {
    if (!value || value.trim() === "") missing.push(label);
  }
  const historyEmpty = FORM2_HISTORY_KEYS.every(
    (k) => (data.history[k] ?? "").trim() === "",
  );
  if (historyEmpty) missing.push("受け持つまでの経過（生育歴・現病歴）");
  return missing;
}

export default function Form2ReviewScreen({
  patient,
  patientId,
  userId,
  initial,
  onPersisted,
}: {
  patient: Patient;
  patientId: string;
  userId: string;
  initial: Form2Snapshot | null;
  onPersisted?: (snapshot: Form2Snapshot) => void;
}) {
  // 表示のみ（編集はしない）。読み込みは思考ワークスペースと同一の受け持ち様式2。
  const { data, hydrated } = useForm2Supabase({
    patientId,
    userId,
    initial,
    onPersisted,
  });
  // 提出導線（この端末内の確認状態。新規 DB 処理は行わない）。
  const [submitted, setSubmitted] = useState(false);

  const missing = collectMissing(data);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {/* Sprint D-2D 追加修正③: 編集/確認画面はメイン幅を有効活用し、左右余白を均等にする。
          左右パディングを割合（5%）にすることで、iPad Landscape でもメイン幅の約 90% を使い、
          左右対称・中央配置になる（固定 max-width で iPad を狭めない。過大化は max-w で抑制）。
          印刷用紙（190mm 固定）の幅を画面にそのまま適用しないよう、A4 プレビューは下の
          maxScreenScale で利用可能幅まで拡大する（印刷は @media print で等倍に戻すため影響なし）。 */}
      <div className="mx-auto w-full max-w-[1500px] px-[5%] py-5">
        {/* ヘッダー（印刷しない）。目的＝最終確認・印刷・提出。 */}
        <header className="no-print mb-4">
          <p className="text-[12px] font-medium text-[#8E8E93]">
            様式2 ・ 最終確認 / 印刷 / 提出
          </p>
          <h1 className="mt-0.5 text-[18px] font-bold text-[#1D1D1F]">
            精神様式2 受け持ち対象記録
          </h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#8E8E93]">
            {patient.name} の受け持ち対象記録です。内容を最終確認し、印刷・提出します。
            編集は思考ワークスペースで行ってください。
          </p>
        </header>

        {/* 未入力項目の確認（印刷しない） */}
        <section className="no-print mb-4 rounded-2xl border border-[#EBEBF0] bg-white p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-[#1D1D1F]">
            未入力項目の確認
          </h2>
          {!hydrated ? (
            <p className="text-[12.5px] text-[#8E8E93]">読み込み中…</p>
          ) : missing.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#3F7E52]">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              主要項目はすべて入力されています。
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-[12.5px] text-[#C0392B]">
                未入力の項目が {missing.length} 件あります。
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {missing.map((label) => (
                  <li
                    key={label}
                    className="rounded-full border border-[#F3D6D2] bg-[#FBEAE8] px-2.5 py-0.5 text-[11.5px] text-[#C0392B]"
                  >
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* 操作（印刷しない）：印刷・提出。 */}
        <div className="no-print mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-[#D1D1D6] bg-white px-4 text-[13px] font-medium text-[#3A3A3C] transition hover:bg-[#F2F2F5]"
          >
            <Printer className="h-4 w-4" strokeWidth={1.9} />
            印刷
          </button>
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-[#0A84FF] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0A6CD6]"
          >
            <Send className="h-4 w-4" strokeWidth={2} />
            提出する
          </button>
          {submitted && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[#3F7E52]">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              提出内容を確認しました（保存済みの内容が対象です）。
            </span>
          )}
        </div>

        {/* 様式2 全体（原本レイアウト・印刷対象）。画面ではコンテナ幅（メインの約 90%）まで
            拡大（最大 2.2 倍）し、iPad Landscape でも用紙を大きく・左右対称に表示する。
            印刷時は @media print が transform を打ち消し、190mm 原寸で出力する（回帰なし）。 */}
        <div className="rounded-2xl border border-[#EBEBF0] bg-white p-3">
          <Form2SheetView data={data} maxScreenScale={2.2} />
        </div>
      </div>
    </div>
  );
}

// 受け持ち患者以外を選択中に左メニュー様式2 を開いたときの案内（受け持ちへ戻る導線のみ）。
export function Form2ReviewLocked({
  onBackToTarget,
}: {
  onBackToTarget: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#E5E5EA] bg-white p-6 text-center shadow-sm">
        <h2 className="text-[15px] font-bold text-[#1D1D1F]">
          受け持ち患者の様式2 です
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#6E6E73]">
          様式2 は、受け持ち患者について確認・提出できます。
          <br />
          受け持ち患者に戻ってください。
        </p>
        <button
          type="button"
          onClick={onBackToTarget}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0A5FCC] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#0A54B5]"
        >
          受け持ち患者に戻る
        </button>
      </div>
    </div>
  );
}
