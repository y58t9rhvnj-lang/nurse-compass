import {
  FORM2_BASIC_FIELDS,
  FORM2_TREATMENT_LABEL,
} from "@/lib/form2/form2Fields";
import { FORM2_HISTORY_KEYS, type Form2Data } from "@/lib/form2/form2Types";

const EMPTY_MARK = "（未記入）";

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
      <div className="border border-[#C9C9CE] px-3 py-2">{children}</div>
    </section>
  );
}

function BlockText({ value }: { value: string }) {
  const filled = value.trim().length > 0;
  return (
    <p
      className={[
        "whitespace-pre-wrap text-[13px] leading-relaxed",
        filled ? "text-[#1D1D1F]" : "text-[#9A9AA0]",
      ].join(" ")}
    >
      {filled ? value : EMPTY_MARK}
    </p>
  );
}

export default function Form2SheetView({ data }: { data: Form2Data }) {
  const period =
    data.period.start || data.period.end
      ? `${data.period.start || "—"} 〜 ${data.period.end || "—"}`
      : EMPTY_MARK;

  // 受け持つまでの経過は、編集時の小項目を一つのまとまりへ結合して表示する。
  const historyMerged = FORM2_HISTORY_KEYS.map((key) => data.history[key].trim())
    .filter((text) => text.length > 0)
    .join("\n\n");

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
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {FORM2_BASIC_FIELDS.map((field) => {
              const value = data.basicInformation[field.key];
              const filled = value.trim().length > 0;
              return (
                <tr key={field.key} className="border border-[#C9C9CE]">
                  <th className="w-[110px] border border-[#C9C9CE] bg-[#F5F5F7] px-3 py-2 text-left align-top font-medium text-[#3A3A3C]">
                    {field.label}
                  </th>
                  <td
                    className={[
                      "whitespace-pre-wrap border border-[#C9C9CE] px-3 py-2 align-top",
                      filled ? "text-[#1D1D1F]" : "text-[#9A9AA0]",
                    ].join(" ")}
                  >
                    {filled ? value : EMPTY_MARK}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SheetSection>

      {/* 受け持つまでの経過（生育歴・現病歴）— 一つのまとまり */}
      <SheetSection title="受け持つまでの経過（生育歴・現病歴）">
        <BlockText value={historyMerged} />
      </SheetSection>

      {/* 医師の治療方針・内容 — 一つの大きな欄 */}
      <SheetSection title={FORM2_TREATMENT_LABEL}>
        <BlockText value={data.treatment.policyAndContent} />
      </SheetSection>
    </div>
  );
}
