"use client";

import AutoTextarea from "./AutoTextarea";
import {
  Form2BasicInfoTable,
  Form2MedicationList,
  Form2ProgramList,
} from "./Form2AutoInfo";
import type { Form2AutoData } from "@/lib/form2/form2AutoData";
import {
  FORM2_FIELD_GROUPS,
  FORM2_PROGRESS_GROUP_ID,
} from "@/lib/form2/form2Fields";
import type {
  Form2Data,
  Form2Period,
  Form2SectionId,
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

export default function Form2EditForm({
  auto,
  data,
  updateSection,
  updateStudent,
  updatePeriod,
}: {
  auto: Form2AutoData;
  data: Form2Data;
  updateSection: (id: Form2SectionId, value: string) => void;
  updateStudent: (patch: Partial<Form2Student>) => void;
  updatePeriod: (patch: Partial<Form2Period>) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[820px] space-y-6">
      {/* 患者基本情報（自動表示） */}
      <section id="form2-basic-info" className="space-y-2">
        <SectionHeading>患者基本情報</SectionHeading>
        <p className="text-[12px] text-[#8E8E93]">
          この欄は電子カルテの情報を自動表示しています（編集不可）。
        </p>
        <Form2BasicInfoTable auto={auto} />
      </section>

      {/* 受け持ち情報（学生入力） */}
      <section id="form2-assignment-info" className="space-y-3">
        <SectionHeading>受け持ち情報</SectionHeading>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField
            label="受け持ち期間（開始）"
            value={data.period.start}
            onChange={(v) => updatePeriod({ start: v })}
            placeholder="例：2026/07/20"
          />
          <TextField
            label="受け持ち期間（終了）"
            value={data.period.end}
            onChange={(v) => updatePeriod({ end: v })}
            placeholder="例：2026/08/07"
          />
          <TextField
            label="学籍番号"
            value={data.student.studentNumber}
            onChange={(v) => updateStudent({ studentNumber: v })}
            placeholder="例：N24-000"
          />
          <TextField
            label="学生氏名"
            value={data.student.studentName}
            onChange={(v) => updateStudent({ studentName: v })}
            placeholder="氏名を入力"
          />
        </div>
      </section>

      {/* 自由記述セクション（学生入力） */}
      {FORM2_FIELD_GROUPS.map((group) => (
        <section key={group.id} id={`form2-group-${group.id}`} className="space-y-3">
          <SectionHeading>{group.title}</SectionHeading>

          {group.id === FORM2_PROGRESS_GROUP_ID && (
            <p className="text-[12px] text-[#8E8E93]">
              整理しやすいよう小項目に分けています。様式表示では「受け持つまでの経過」として一つのまとまりで確認できます。
            </p>
          )}

          {group.id === "therapies" && (
            <div className="space-y-3 rounded-md border border-dashed border-[#C9C9CE] bg-[#FAFAFA] p-3">
              <p className="text-[12px] font-medium text-[#8E8E93]">
                参考（電子カルテより自動表示）
              </p>
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-[#3A3A3C]">
                  処方薬一覧
                </p>
                <Form2MedicationList auto={auto} />
              </div>
              <div className="space-y-1">
                <p className="text-[12px] font-medium text-[#3A3A3C]">
                  治療プログラム一覧
                </p>
                <Form2ProgramList auto={auto} />
              </div>
            </div>
          )}

          <div className="space-y-4">
            {group.fields.map((field) => (
              <div key={field.id} className="space-y-1">
                <label
                  htmlFor={field.id}
                  className="text-[13px] font-medium text-[#1D1D1F]"
                >
                  {field.label}
                </label>
                <p className="text-[12px] leading-snug text-[#8E8E93]">
                  {field.helper}
                </p>
                <AutoTextarea
                  id={field.id}
                  ariaLabel={field.label}
                  value={data.sections[field.id]}
                  onChange={(v) => updateSection(field.id, v)}
                  placeholder={field.helper}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
