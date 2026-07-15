import type { Form2AutoData } from "@/lib/form2/form2AutoData";

const NOT_RECORDED = "電子カルテに記載なし";

// 患者基本情報（自動表示・読み取り専用）。学校実習用紙に近い罫線テーブル。
export function Form2BasicInfoTable({ auto }: { auto: Form2AutoData }) {
  const admission = auto.admissionType
    ? auto.admissionTypeNote
      ? `${auto.admissionType}（${auto.admissionTypeNote}）`
      : auto.admissionType
    : NOT_RECORDED;

  const rows: { label: string; value: string; muted?: boolean }[] = [
    { label: "患者氏名", value: auto.patientName },
    { label: "年齢", value: auto.age },
    { label: "性別", value: auto.sex },
    { label: "診断名", value: auto.diagnosis },
    {
      label: "既往歴",
      value: auto.pastHistory ?? NOT_RECORDED,
      muted: auto.pastHistory === null,
    },
    { label: "入院形態", value: admission, muted: auto.admissionType === null },
    { label: "主治医", value: auto.doctor },
  ];

  return (
    <table className="w-full border-collapse text-[13px]">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border border-[#C9C9CE]">
            <th className="w-[110px] border border-[#C9C9CE] bg-[#F5F5F7] px-3 py-2 text-left align-top font-medium text-[#3A3A3C]">
              {row.label}
            </th>
            <td
              className={[
                "border border-[#C9C9CE] px-3 py-2 align-top",
                row.muted ? "text-[#9A9AA0]" : "text-[#1D1D1F]",
              ].join(" ")}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 処方薬一覧（自動表示・読み取り専用）。
export function Form2MedicationList({ auto }: { auto: Form2AutoData }) {
  if (auto.medications.length === 0) {
    return <p className="text-[13px] text-[#9A9AA0]">{NOT_RECORDED}</p>;
  }
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr>
          <th className="w-[64px] border border-[#C9C9CE] bg-[#F5F5F7] px-2 py-1.5 text-left font-medium text-[#3A3A3C]">
            区分
          </th>
          <th className="border border-[#C9C9CE] bg-[#F5F5F7] px-2 py-1.5 text-left font-medium text-[#3A3A3C]">
            薬剤
          </th>
          <th className="w-[130px] border border-[#C9C9CE] bg-[#F5F5F7] px-2 py-1.5 text-left font-medium text-[#3A3A3C]">
            用法
          </th>
        </tr>
      </thead>
      <tbody>
        {auto.medications.map((med, i) => (
          <tr key={`${med.category}-${med.drugs}-${i}`}>
            <td className="border border-[#C9C9CE] px-2 py-1.5 align-top text-[#3A3A3C]">
              {med.category}
            </td>
            <td className="border border-[#C9C9CE] px-2 py-1.5 align-top text-[#1D1D1F]">
              {med.drugs}
            </td>
            <td className="border border-[#C9C9CE] px-2 py-1.5 align-top text-[#3A3A3C]">
              {med.usage}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// 治療プログラム一覧（自動表示・読み取り専用）。
export function Form2ProgramList({ auto }: { auto: Form2AutoData }) {
  if (auto.treatmentPrograms.length === 0) {
    return <p className="text-[13px] text-[#9A9AA0]">{NOT_RECORDED}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#1D1D1F]">
      {auto.treatmentPrograms.map((program) => (
        <li key={program} className="list-inside list-disc">
          {program}
        </li>
      ))}
    </ul>
  );
}
