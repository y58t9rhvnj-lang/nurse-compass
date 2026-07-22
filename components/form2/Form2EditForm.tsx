"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import AutoTextarea from "./AutoTextarea";
import {
  FORM2_BASIC_FIELDS,
  FORM2_HISTORY_FIELDS,
  FORM2_TREATMENT_FIELDS,
  FORM2_TREATMENT_HELPER,
  FORM2_TREATMENT_LABEL,
} from "@/lib/form2/form2Fields";
import { form2FieldMeta } from "@/lib/form2/form2FieldKeys";
import type {
  Form2BasicInformation,
  Form2Data,
  Form2History,
  Form2Period,
  Form2Student,
  Form2Treatment,
} from "@/lib/form2/form2Types";
import { useOptionalForm2EvidenceLinksContext } from "@/components/v2/notebook/Form2EvidenceLinksContext";
import { useOptionalEvidenceContext } from "@/components/v2/notebook/EvidenceContext";

// ある様式2 項目に紐づく「関連する根拠 N件」の控えめな表示（Sprint D-2B）。
// 思考ワークスペース内（Form2EvidenceLinksProvider 配下）でのみ表示し、左メニューの
// 様式2 レビュー画面（Provider 無し）では何も出さない。Evidence 本文は自動転記しない。
function FieldEvidenceLinks({ fieldKey }: { fieldKey: string }) {
  const links = useOptionalForm2EvidenceLinksContext();
  const evidence = useOptionalEvidenceContext();
  const [expanded, setExpanded] = useState(false);

  if (!links) return null;
  const fieldLinks = links.linksForField(fieldKey);
  if (fieldLinks.length === 0) return null;

  const cardsById = new Map((evidence?.cards ?? []).map((c) => [c.id, c]));

  return (
    <div className="no-print mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1 rounded-full bg-[#EEF4FF] px-2.5 py-0.5 text-[11.5px] font-medium text-[#0A6CD6] transition hover:bg-[#E1EBFB]"
      >
        <Sparkles className="h-3 w-3" strokeWidth={1.75} />
        関連する根拠 {fieldLinks.length}件
        <ChevronDown
          className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      {expanded && (
        <ul className="mt-1.5 space-y-1.5">
          {fieldLinks.map((l) => {
            const card = cardsById.get(l.evidenceId);
            return (
              <li
                key={l.id}
                className="flex items-start gap-2 rounded-lg border border-[#EBEBF0] bg-[#FAFAFC] px-2.5 py-1.5"
              >
                <p className="min-w-0 flex-1 whitespace-pre-line text-[12px] leading-relaxed text-[#3A3A3C]">
                  {card ? card.content : "（削除された根拠）"}
                </p>
                <button
                  type="button"
                  onClick={() => links.removeLink(l.id)}
                  disabled={links.status === "working"}
                  aria-label="この項目の根拠から外す"
                  className="mt-0.5 shrink-0 rounded-full p-1 text-[#AEAEB5] transition hover:bg-[#ECECF1] hover:text-[#6E6E73] disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 border-l-4 border-[#1D1D1F] pl-2 text-[15px] font-semibold text-[#1D1D1F]">
      {children}
    </h3>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-medium text-[#3A3A3C]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[#C9C9CE] bg-white px-3 py-2 text-[14px] text-[#1D1D1F] outline-none placeholder:text-[#B0B0B5] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
      />
    </label>
  );
}

function FieldWithHelper({
  id,
  label,
  helper,
  value,
  onChange,
}: {
  id: string;
  label: string;
  helper: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[13px] font-medium text-[#1D1D1F]">
        {label}
      </label>
      <p className="text-[12px] leading-snug text-[#8E8E93]">{helper}</p>
      <AutoTextarea
        id={id}
        ariaLabel={label}
        value={value}
        onChange={onChange}
        placeholder={helper}
      />
    </div>
  );
}

export default function Form2EditForm({
  data,
  updateBasic,
  updateHistory,
  updateTreatment,
  updateStudent,
  updatePeriod,
}: {
  data: Form2Data;
  updateBasic: (patch: Partial<Form2BasicInformation>) => void;
  updateHistory: (patch: Partial<Form2History>) => void;
  updateTreatment: (patch: Partial<Form2Treatment>) => void;
  updateStudent: (patch: Partial<Form2Student>) => void;
  updatePeriod: (patch: Partial<Form2Period>) => void;
}) {
  // 「様式2で使う」→項目選択 時に、対象欄へスクロール＆フォーカスする（Sprint D-2B §③）。
  // Provider 配下（思考ワークスペース）でのみ機能し、レビュー画面では何もしない。
  const linksCtx = useOptionalForm2EvidenceLinksContext();
  const focusToken = linksCtx?.focusToken ?? 0;
  const focusFieldKey = linksCtx?.focusFieldKey ?? null;
  useEffect(() => {
    if (!focusFieldKey || focusToken === 0) return;
    const meta = form2FieldMeta(focusFieldKey);
    if (!meta) return;
    const el = document.getElementById(meta.elementId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement).focus({ preventScroll: true });
  }, [focusToken, focusFieldKey]);

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-6">
      {/* 受け持ち情報（学生入力） */}
      <section id="form2-assignment-info" className="space-y-3">
        <SectionHeading>受け持ち情報</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="受け持ち期間（開始）"
            value={data.period.start}
            onChange={(v) => updatePeriod({ start: v })}
            placeholder="例：◯月◯日"
          />
          <TextField
            label="受け持ち期間（終了）"
            value={data.period.end}
            onChange={(v) => updatePeriod({ end: v })}
            placeholder="例：◯月◯日"
          />
          <TextField
            label="学籍番号"
            value={data.student.studentNumber}
            onChange={(v) => updateStudent({ studentNumber: v })}
            placeholder="自分の学籍番号を記入"
          />
          <TextField
            label="学生氏名"
            value={data.student.studentName}
            onChange={(v) => updateStudent({ studentName: v })}
            placeholder="自分の氏名を記入"
          />
        </div>
      </section>

      {/* 患者基本情報（学生入力・自動表示しない） */}
      <section id="form2-basic-info" className="space-y-3">
        <SectionHeading>患者基本情報</SectionHeading>
        <p className="text-[12px] text-[#8E8E93]">
          電子カルテや患者会話を確認し、必要な情報を自分で見つけて記入してください（自動表示はされません）。
        </p>
        <div className="space-y-4">
          {FORM2_BASIC_FIELDS.map((field) => (
            <div key={field.key}>
              {field.multiline ? (
                <FieldWithHelper
                  id={field.key}
                  label={field.label}
                  helper={field.helper}
                  value={data.basicInformation[field.key]}
                  onChange={(v) => updateBasic({ [field.key]: v })}
                />
              ) : (
                <div className="space-y-1">
                  <label
                    htmlFor={field.key}
                    className="text-[13px] font-medium text-[#1D1D1F]"
                  >
                    {field.label}
                  </label>
                  <p className="text-[12px] leading-snug text-[#8E8E93]">
                    {field.helper}
                  </p>
                  <input
                    id={field.key}
                    type="text"
                    aria-label={field.label}
                    value={data.basicInformation[field.key]}
                    onChange={(e) => updateBasic({ [field.key]: e.target.value })}
                    placeholder={field.helper}
                    className="w-full rounded-md border border-[#C9C9CE] bg-white px-3 py-2 text-[14px] text-[#1D1D1F] outline-none placeholder:text-[#B0B0B5] focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF]"
                  />
                </div>
              )}
              <FieldEvidenceLinks fieldKey={`basicInformation.${field.key}`} />
            </div>
          ))}
        </div>
      </section>

      {/* 受け持つまでの経過（生育歴・現病歴）— 学生入力・小項目 */}
      <section id="form2-history" className="space-y-3">
        <SectionHeading>受け持つまでの経過（生育歴・現病歴）</SectionHeading>
        <p className="text-[12px] text-[#8E8E93]">
          整理しやすいよう小項目に分けています。様式表示では「受け持つまでの経過（生育歴・現病歴）」として一つのまとまりで表示されます。
        </p>
        <div className="space-y-4">
          {FORM2_HISTORY_FIELDS.map((field) => (
            <div key={field.key}>
              <FieldWithHelper
                id={field.key}
                label={field.label}
                helper={field.helper}
                value={data.history[field.key] ?? ""}
                onChange={(v) => updateHistory({ [field.key]: v })}
              />
              <FieldEvidenceLinks fieldKey={`history.${field.key}`} />
            </div>
          ))}
        </div>
      </section>

      {/* 医師の治療方針・内容（4 項目・学生入力） */}
      <section id="form2-treatment" className="space-y-3">
        <SectionHeading>{FORM2_TREATMENT_LABEL}</SectionHeading>
        <p className="text-[12px] leading-snug text-[#8E8E93]">
          {FORM2_TREATMENT_HELPER}
        </p>
        <div className="space-y-4">
          {FORM2_TREATMENT_FIELDS.map((field) => (
            <div key={field.key}>
              <FieldWithHelper
                id={field.key}
                label={field.label}
                helper={field.helper}
                value={data.treatment[field.key] ?? ""}
                onChange={(v) => updateTreatment({ [field.key]: v })}
              />
              <FieldEvidenceLinks fieldKey={`treatment.${field.key}`} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
