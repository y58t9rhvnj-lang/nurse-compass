"use client";

import AutoTextarea from "./AutoTextarea";
import {
  FORM2_BASIC_FIELDS,
  FORM2_HISTORY_FIELDS,
  FORM2_TREATMENT_HELPER,
  FORM2_TREATMENT_LABEL,
} from "@/lib/form2/form2Fields";
import type {
  Form2BasicInformation,
  Form2Data,
  Form2History,
  Form2Period,
  Form2Student,
} from "@/lib/form2/form2Types";

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
  updateTreatment: (value: string) => void;
  updateStudent: (patch: Partial<Form2Student>) => void;
  updatePeriod: (patch: Partial<Form2Period>) => void;
}) {
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
          {FORM2_BASIC_FIELDS.map((field) =>
            field.multiline ? (
              <FieldWithHelper
                key={field.key}
                id={field.key}
                label={field.label}
                helper={field.helper}
                value={data.basicInformation[field.key]}
                onChange={(v) => updateBasic({ [field.key]: v })}
              />
            ) : (
              <div key={field.key} className="space-y-1">
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
            ),
          )}
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
            <FieldWithHelper
              key={field.key}
              id={field.key}
              label={field.label}
              helper={field.helper}
              value={data.history[field.key]}
              onChange={(v) => updateHistory({ [field.key]: v })}
            />
          ))}
        </div>
      </section>

      {/* 医師の治療方針・内容（1欄に統合・学生入力） */}
      <section id="form2-treatment" className="space-y-3">
        <SectionHeading>{FORM2_TREATMENT_LABEL}</SectionHeading>
        <p className="text-[12px] leading-snug text-[#8E8E93]">
          {FORM2_TREATMENT_HELPER}
        </p>
        <AutoTextarea
          id="policyAndContent"
          ariaLabel={FORM2_TREATMENT_LABEL}
          value={data.treatment.policyAndContent}
          onChange={updateTreatment}
          placeholder="治療方針と各治療内容の関係が分かるように、自分の言葉でまとめてください"
          minRows={8}
        />
      </section>
    </div>
  );
}
