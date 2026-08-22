"use client";

// Compass Version2 — Learning Layer (Sprint D-2C)
// 「私が捉えた患者さん」入力セクション（患者理解ワークスペース左カラム・様式2 の下）。
//
// 役割:
//   様式2 で整理した情報や気づきから、学生が今捉えている患者さんを自分の言葉で表現する。
//   ゴードン／様式3 へ分類する前段（「分類する前に理解する」）の統合的記述。
//
// 設計（将来拡張を見据える / Sprint D-3 引き継ぎ）:
//   ・保存は usePatientUnderstanding（debounce 自動保存）へ委譲し、本コンポーネントは表示に徹する。
//   ・将来の履歴保存・AI 評価・教員コメントは、この入力を評価対象として上位で拡張できる（本体は素の記述）。

import { usePatientUnderstanding } from "@/hooks/v2/usePatientUnderstanding";

const PLACEHOLDER =
  "この患者さんはどのような人でしょうか。\n身体・心理・社会面のつながりや、患者さんらしさ、大切にしていることなどを含めて、自由に記述してください。";

function SaveStatusLabel({
  status,
  loaded,
}: {
  status: "idle" | "saving" | "saved" | "error";
  loaded: boolean;
}) {
  if (!loaded) return null;
  if (status === "saving") {
    return <span className="text-[11.5px] text-[#8E8E93]">保存中…</span>;
  }
  if (status === "saved") {
    return <span className="text-[11.5px] text-[#3F7E52]">保存済み</span>;
  }
  if (status === "error") {
    return (
      <span className="text-[11.5px] text-[#C0392B]">
        保存エラー（通信状況を確認してください）
      </span>
    );
  }
  return null;
}

export default function PatientOverviewEditor({
  patientId,
}: {
  patientId: string;
}) {
  const { text, status, loaded, onChangeText } = usePatientUnderstanding({
    patientId,
  });

  return (
    <section
      aria-label="私が捉えた患者さん"
      className="mt-4 rounded-2xl border border-[#E5E5EA] bg-white p-4 sm:p-5"
    >
      <header className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[#1D1D1F]">
            私が捉えた患者さん
          </h2>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#8E8E93]">
            様式2で整理した情報や気づきから、今のあなたが捉えている患者さんを自分の言葉で表現してください。
          </p>
        </div>
        <div className="shrink-0 pt-0.5" aria-live="polite">
          <SaveStatusLabel status={status} loaded={loaded} />
        </div>
      </header>
      <textarea
        value={text}
        onChange={(e) => onChangeText(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={8}
        // 十分な高さを確保しつつ、入力中に画面が跳ねないよう最小高さで固定する（縦方向のみ手動リサイズ可）。
        className="min-h-[180px] w-full resize-y rounded-xl border border-[#D9D9E0] bg-[#FBFBFD] px-3.5 py-3 text-[13px] leading-relaxed text-[#1D1D1F] placeholder:text-[#B0B0B8] focus:border-[#0A84FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
      />
    </section>
  );
}
