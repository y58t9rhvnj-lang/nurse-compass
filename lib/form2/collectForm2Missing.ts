import {
  FORM2_HISTORY_KEYS,
  mergeTreatmentText,
  type Form2Data,
} from "@/lib/form2/form2Types";

/** 様式2 未入力チェック（Form2ReviewScreen と同一基準）。 */
export function collectForm2Missing(data: Form2Data): string[] {
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
