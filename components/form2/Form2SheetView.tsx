import {
  FORM2_TREATMENT_LABEL,
} from "@/lib/form2/form2Fields";
import { FORM2_HISTORY_KEYS, type Form2Data } from "@/lib/form2/form2Types";

const EMPTY_MARK = "";
// 学校名は実在名を転載しない教育様式のためプレースホルダとする。
const SCHOOL_NAME = "（学校名）";

// セル内テキスト（空欄でも罫線が保てるよう最小高さを持たせる）。
function CellText({
  value,
  minHeightClass = "",
}: {
  value: string;
  minHeightClass?: string;
}) {
  const text = value.trim();
  return (
    <div
      className={[
        "whitespace-pre-wrap text-[12px] leading-relaxed text-black",
        minHeightClass,
      ].join(" ")}
    >
      {text.length > 0 ? text : EMPTY_MARK}
    </div>
  );
}

export default function Form2SheetView({ data }: { data: Form2Data }) {
  const b = data.basicInformation;

  // 受け持つまでの経過は、編集の小項目を1つの欄へ結合して表示する。
  const historyMerged = FORM2_HISTORY_KEYS.map((key) => data.history[key].trim())
    .filter((text) => text.length > 0)
    .join("\n\n");

  const cell = "border border-black px-2 py-1.5 align-top";
  const label =
    "border border-black bg-white px-2 py-1.5 align-top text-[12px] font-semibold text-black whitespace-nowrap";

  return (
    <div className="form2-print-root">
      <div className="form2-sheet mx-auto w-full max-w-[794px] bg-white p-8 text-black shadow-[0_1px_4px_rgba(0,0,0,0.12)] ring-1 ring-[#E5E5EA] print:ring-0">
        <table className="w-full table-fixed border-collapse text-[12px] text-black">
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "32%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "32%" }} />
          </colgroup>
          <tbody>
            {/* タイトル行 ＋ 右上「精神様式2」 */}
            <tr>
              <td
                colSpan={3}
                className="border border-black px-2 py-2 text-center align-middle text-[17px] font-bold tracking-wide text-black"
              >
                受け持ち対象記録
              </td>
              <td className="border border-black px-2 py-2 text-right align-top text-[11px] font-semibold text-black">
                精神様式2
              </td>
            </tr>

            {/* 受け持ち期間 */}
            <tr>
              <th className={label}>受け持ち期間</th>
              <td colSpan={3} className={cell}>
                <CellText
                  value={
                    data.period.start || data.period.end
                      ? `${data.period.start || "　　　"} 〜 ${data.period.end || "　　　"}`
                      : ""
                  }
                />
              </td>
            </tr>

            {/* 学籍番号 / 学生氏名 */}
            <tr>
              <th className={label}>学籍番号</th>
              <td className={cell}>
                <CellText value={data.student.studentNumber} />
              </td>
              <th className={label}>学生氏名</th>
              <td className={cell}>
                <CellText value={data.student.studentName} />
              </td>
            </tr>

            {/* 患者基本情報 見出し */}
            <tr>
              <th
                colSpan={4}
                className="border border-black bg-white px-2 py-1.5 text-left text-[12px] font-bold text-black"
              >
                患者基本情報
              </th>
            </tr>

            {/* 患者氏名 */}
            <tr>
              <th className={label}>患者氏名</th>
              <td colSpan={3} className={cell}>
                <CellText value={b.patientName} />
              </td>
            </tr>

            {/* 年齢 / 性別 */}
            <tr>
              <th className={label}>年齢</th>
              <td className={cell}>
                <CellText value={b.age} />
              </td>
              <th className={label}>性別</th>
              <td className={cell}>
                <CellText value={b.sex} />
              </td>
            </tr>

            {/* 診断名 */}
            <tr>
              <th className={label}>診断名</th>
              <td colSpan={3} className={cell}>
                <CellText value={b.diagnosis} />
              </td>
            </tr>

            {/* 既往歴 */}
            <tr>
              <th className={label}>既往歴</th>
              <td colSpan={3} className={cell}>
                <CellText value={b.pastHistory} minHeightClass="min-h-[2.5rem]" />
              </td>
            </tr>

            {/* 入院形態 */}
            <tr>
              <th className={label}>入院形態</th>
              <td colSpan={3} className={cell}>
                <CellText value={b.admissionType} />
              </td>
            </tr>

            {/* 主訴 */}
            <tr>
              <th className={label}>主訴</th>
              <td colSpan={3} className={cell}>
                <CellText
                  value={b.chiefComplaint}
                  minHeightClass="min-h-[3rem]"
                />
              </td>
            </tr>

            {/* 受け持つまでの経過（生育歴・現病歴）— 1欄に統合 */}
            <tr>
              <th
                colSpan={4}
                className="border border-black bg-white px-2 py-1.5 text-left text-[12px] font-bold text-black"
              >
                受け持つまでの経過（生育歴・現病歴）
              </th>
            </tr>
            <tr>
              <td colSpan={4} className={cell}>
                <CellText value={historyMerged} minHeightClass="min-h-[14rem]" />
              </td>
            </tr>

            {/* 医師の治療方針・治療内容 — 1欄 */}
            <tr>
              <th
                colSpan={4}
                className="border border-black bg-white px-2 py-1.5 text-left text-[12px] font-bold text-black"
              >
                {FORM2_TREATMENT_LABEL}
              </th>
            </tr>
            <tr>
              <td colSpan={4} className={cell}>
                <CellText
                  value={data.treatment.policyAndContent}
                  minHeightClass="min-h-[10rem]"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 学校名（ページ下部・中央） */}
        <p className="mt-6 text-center text-[12px] text-black">{SCHOOL_NAME}</p>
      </div>
    </div>
  );
}
