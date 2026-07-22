"use client";

// Compass Version2 — Learning Layer (Sprint D-3A)
// 「各項目から考えたこと」セクション（患者理解画面・右カラム）。
//
// 学習フロー: 電子カルテ → Compassノート → 様式2（情報整理） → 患者理解（意味づけ）→ 私が捉えた患者さん。
// 患者理解画面では整理工程（Compassノート整理・気づき整理）を重複させない。
//
// 役割分担:
//   左カラム ＝ 様式2（事実）を読み取り専用で表示（編集不可）。
//   本セクション（右カラム）＝ 様式2 の各項目に対する「私が考えたこと（意味づけ・解釈）」を書く。
//   最下部（親側）＝ 私が捉えた患者さん（考察の最終統合）。
//
// 表示ルール:
//   ・様式2 が未入力の項目は原則表示しない。
//   ・ただし、初回ロード時点で reflection が保存済みだった項目は、様式2 が後から空欄でも表示して
//     内容を失わせない（loadedKeys で凍結）。
//
// 自動保存:
//   ・reflection は useForm2FieldReflections が項目ごとに debounce 自動保存する。
//   ・保存エラー時も入力は失わない（ローカルに保持）。状態は項目ごとに控えめに表示する。
//
// 様式2 データ（読み取り専用）は親（EvidenceReviewWorkspace）が一度だけ読み込み、props で受け取る。

import { useMemo } from "react";
import {
  FORM2_REFLECTION_FIELDS,
  form2FieldValue,
  type Form2FieldKeyMeta,
} from "@/lib/form2/form2FieldKeys";
import {
  useForm2FieldReflections,
  type ReflectionSaveStatus,
} from "@/hooks/v2/useForm2FieldReflections";
import type { Form2Data } from "@/lib/form2/form2Types";

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function SaveStatusLabel({ status }: { status: ReflectionSaveStatus }) {
  if (status === "saving") {
    return <span className="text-[11px] text-[#8E8E93]">保存中…</span>;
  }
  if (status === "saved") {
    return <span className="text-[11px] text-[#3F7E52]">保存済み</span>;
  }
  if (status === "error") {
    return (
      <span className="text-[11px] text-[#C0392B]">
        保存エラー（通信状況を確認してください）
      </span>
    );
  }
  return null;
}

export default function Form2ReflectionSection({
  patientId,
  data,
  hydrated,
}: {
  patientId: string;
  data: Form2Data;
  hydrated: boolean;
}) {
  const reflections = useForm2FieldReflections({ patientId });

  const ready = hydrated && reflections.loaded;

  // 表示対象の項目:
  //   ・様式2 に事実が入力されている項目、または
  //   ・初回ロード時点で reflection が保存済みだった項目（loadedKeys）。
  //     → 様式2 が後から空欄でも表示し続け、入力中に項目が消えない（内容を失わせない）。
  const loadedKeySet = reflections.loadedKeys;
  const visibleFields = useMemo(() => {
    if (!ready) return [];
    // 対象は「診断名」以下の項目のみ（氏名・年齢・性別などの基本属性は除外）。
    return FORM2_REFLECTION_FIELDS.filter(
      (f) =>
        nonEmpty(form2FieldValue(data, f.key)) || loadedKeySet.includes(f.key),
    );
  }, [ready, data, loadedKeySet]);

  if (!ready) {
    return (
      <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-6 text-center text-[12.5px] text-[#8E8E93]">
        様式2の内容を読み込んでいます…
      </div>
    );
  }

  if (visibleFields.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-6 text-[12.5px] leading-relaxed text-[#8E8E93]">
        まず通常のワークスペースで様式2に事実を整理してください。入力した項目がここに並び、各項目について「私が考えたこと」を書けるようになります。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#E5E5EA] bg-white px-4 py-3.5">
        <h2 className="text-[14px] font-bold text-[#1D1D1F]">
          各項目から考えたこと
        </h2>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#8E8E93]">
          左の様式2を見ながら、その項目から何が考えられるかを自分の言葉で書きましょう。事実そのものではなく、あなたの意味づけ・解釈を記述します。
        </p>
      </div>

      <ul className="space-y-3">
        {visibleFields.map((field, index) => {
          const prev = index > 0 ? visibleFields[index - 1] : undefined;
          const showSectionHeading =
            !prev || prev.sectionLabel !== field.sectionLabel;
          return (
            <li key={field.key}>
              {showSectionHeading && (
                <h3 className="mb-1.5 mt-1 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#AEAEB5]">
                  {field.sectionLabel}
                </h3>
              )}
              <ReflectionItem
                field={field}
                factEmpty={!nonEmpty(form2FieldValue(data, field.key))}
                text={reflections.textOf(field.key)}
                status={reflections.statusOf(field.key)}
                onChange={(next) =>
                  reflections.onChangeReflection(field.key, next)
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReflectionItem({
  field,
  factEmpty,
  text,
  status,
  onChange,
}: {
  field: Form2FieldKeyMeta;
  // 様式2 が空欄（loadedKeys 由来で表示中）かどうか。事実本文は左カラムで参照する。
  factEmpty: boolean;
  text: string;
  status: ReflectionSaveStatus;
  onChange: (next: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E5EA] bg-white">
      {/* 項目名（左の様式2 と対応） */}
      <div className="flex items-center justify-between gap-2 border-b border-[#F0F0F3] px-3.5 py-2">
        <span className="text-[12.5px] font-bold text-[#1D1D1F]">
          {field.label}
        </span>
        <span aria-live="polite">
          <SaveStatusLabel status={status} />
        </span>
      </div>

      {factEmpty && (
        <p className="bg-[#FBFBFD] px-3.5 py-1.5 text-[11px] italic text-[#AEAEB5]">
          様式2は現在空欄です（以前の考察を保持しています）。
        </p>
      )}

      {/* 私が考えたこと（編集可能・自動保存） */}
      <div className="px-3.5 py-2.5">
        <label
          htmlFor={`reflection-${field.elementId}`}
          className="mb-1 inline-flex items-center gap-1.5"
        >
          <span className="inline-flex items-center rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[10px] font-semibold text-[#0A6CD6]">
            私が考えたこと
          </span>
        </label>
        <textarea
          id={`reflection-${field.elementId}`}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder="この事実から何が考えられますか。そう考えた根拠もあわせて書いてみましょう。"
          rows={3}
          className="min-h-[72px] w-full resize-y rounded-xl border border-[#D9D9E0] bg-[#FBFBFD] px-3 py-2 text-[12.5px] leading-relaxed text-[#1D1D1F] placeholder:text-[#B0B0B8] focus:border-[#0A84FF] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
        />
      </div>
    </div>
  );
}
