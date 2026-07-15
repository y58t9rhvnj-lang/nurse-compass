import {
  Form2BasicInfoTable,
  Form2MedicationList,
  Form2ProgramList,
} from "./Form2AutoInfo";
import type { Form2AutoData } from "@/lib/form2/form2AutoData";
import { FORM2_FIELD_GROUPS } from "@/lib/form2/form2Fields";
import type { Form2Data, Form2SectionId } from "@/lib/form2/form2Types";

const EMPTY_MARK = "（未記入）";

function FieldBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const filled = value.trim().length > 0;
  return (
    <div className="border-b border-[#E0E0E4] py-2 last:border-b-0">
      <p className="mb-0.5 text-[12px] font-semibold text-[#3A3A3C]">{label}</p>
      <p
        className={[
          "whitespace-pre-wrap text-[13px] leading-relaxed",
          filled ? "text-[#1D1D1F]" : "text-[#9A9AA0]",
        ].join(" ")}
      >
        {filled ? value : EMPTY_MARK}
      </p>
    </div>
  );
}

function SheetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4">
      <h3 className="mb-1.5 bg-[#1D1D1F] px-2 py-1 text-[13px] font-bold text-white">
        {title}
      </h3>
      <div className="border border-[#C9C9CE] px-3 py-1">{children}</div>
    </section>
  );
}

export default function Form2SheetView({
  auto,
  data,
}: {
  auto: Form2AutoData;
  data: Form2Data;
}) {
  const section = (id: Form2SectionId) => data.sections[id];
  const progressGroup = FORM2_FIELD_GROUPS.find((g) => g.id === "progress");
  const currentStatusGroup = FORM2_FIELD_GROUPS.find(
    (g) => g.id === "currentStatus",
  );
  const therapiesGroup = FORM2_FIELD_GROUPS.find((g) => g.id === "therapies");

  const period =
    data.period.start || data.period.end
      ? `${data.period.start || "—"} 〜 ${data.period.end || "—"}`
      : EMPTY_MARK;

  return (
    <div className="mx-auto w-full max-w-[794px] bg-white p-8 text-[#1D1D1F] shadow-[0_1px_4px_rgba(0,0,0,0.12)] ring-1 ring-[#E5E5EA] print:shadow-none">
      {/* 見出し */}
      <header className="mb-4 border-b-2 border-[#1D1D1F] pb-2">
        <p className="text-[12px] tracking-wide text-[#6E6E73]">精神様式2</p>
        <h2 className="text-[18px] font-bold">受け持ち対象記録</h2>
        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-[12px] text-[#3A3A3C] sm:grid-cols-3">
          <span>受け持ち期間：{period}</span>
          <span>学籍番号：{data.student.studentNumber || EMPTY_MARK}</span>
          <span>学生氏名：{data.student.studentName || EMPTY_MARK}</span>
        </div>
      </header>

      {/* 患者基本情報 */}
      <SheetSection title="患者基本情報">
        <div className="py-1">
          <Form2BasicInfoTable auto={auto} />
        </div>
      </SheetSection>

      {/* 主訴 */}
      <SheetSection title="主訴">
        <FieldBlock label="主訴" value={section("chiefComplaint")} />
      </SheetSection>

      {/* 受け持つまでの経過（生育歴・現病歴）— 一つのまとまり */}
      {progressGroup && (
        <SheetSection title="受け持つまでの経過（生育歴・現病歴）">
          {progressGroup.fields.map((field) => (
            <FieldBlock
              key={field.id}
              label={field.label}
              value={section(field.id)}
            />
          ))}
        </SheetSection>
      )}

      {/* 現在の状態 */}
      {currentStatusGroup && (
        <SheetSection title="現在の状態">
          {currentStatusGroup.fields.map((field) => (
            <FieldBlock
              key={field.id}
              label={field.label}
              value={section(field.id)}
            />
          ))}
        </SheetSection>
      )}

      {/* 医師の治療方針・内容 */}
      <SheetSection title="医師の治療方針・内容">
        <FieldBlock label="医師の治療方針" value={section("treatmentPolicy")} />
      </SheetSection>

      {/* 薬物療法・各種療法 */}
      {therapiesGroup && (
        <SheetSection title="薬物療法・各種療法">
          <div className="border-b border-[#E0E0E4] py-2">
            <p className="mb-1 text-[12px] font-semibold text-[#3A3A3C]">
              処方薬一覧（自動表示）
            </p>
            <Form2MedicationList auto={auto} />
          </div>
          <div className="border-b border-[#E0E0E4] py-2">
            <p className="mb-1 text-[12px] font-semibold text-[#3A3A3C]">
              治療プログラム一覧（自動表示）
            </p>
            <Form2ProgramList auto={auto} />
          </div>
          {therapiesGroup.fields.map((field) => (
            <FieldBlock
              key={field.id}
              label={field.label}
              value={section(field.id)}
            />
          ))}
        </SheetSection>
      )}
    </div>
  );
}
