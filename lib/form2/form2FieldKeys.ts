// Compass Version2 — Learning Layer (Sprint D-2B)
// 様式2 の「固定フィールドキー」集合。Evidence–様式2 の根拠リンク（form2_evidence_links）で
// 参照する項目を、section.field のドットパスで一意に指す。
//
// 方針:
//   ・自由入力にしない（DB の CHECK 制約・Server Action の検証・UI の候補をこの1か所に集約）。
//   ・キー集合は supabase/migrations/0010_form2_evidence_links.sql の CHECK と一致させる。
//   ・ラベル・並びは既存の FORM2_BASIC_FIELDS / FORM2_HISTORY_FIELDS を再利用する
//     （二重管理を避け、様式2 本体と項目名がずれないようにする）。
//   ・elementId は Form2EditForm 内の入力要素 id（対象欄フォーカス用）。基本情報・経過・治療で
//     重複しないため、ドットパスの末尾セグメントをそのまま id として使う。

import {
  FORM2_BASIC_FIELDS,
  FORM2_HISTORY_FIELDS,
  FORM2_TREATMENT_FIELDS,
} from "./form2Fields";
import type {
  Form2BasicInformation,
  Form2Data,
  Form2History,
  Form2Treatment,
} from "./form2Types";

export type Form2FieldSection = "basicInformation" | "history" | "treatment";

export interface Form2FieldKeyMeta {
  // section.field のドットパス（DB / Server Action / リンク行の form_field_key）。
  key: string;
  // 学生に見せる項目名（様式2 本体と共通）。
  label: string;
  // Form2EditForm 内の入力要素 id（scrollIntoView / focus 用）。
  elementId: string;
  section: Form2FieldSection;
  // セクション見出し（項目選択 UI のグループ表示用）。
  sectionLabel: string;
}

const BASIC_SECTION_LABEL = "患者基本情報";
const HISTORY_SECTION_LABEL = "受け持つまでの経過（生育歴・現病歴）";
const TREATMENT_SECTION_LABEL = "医師の治療方針・治療内容";

export const FORM2_LINK_FIELDS: Form2FieldKeyMeta[] = [
  ...FORM2_BASIC_FIELDS.map<Form2FieldKeyMeta>((f) => ({
    key: `basicInformation.${f.key}`,
    label: f.label,
    elementId: f.key,
    section: "basicInformation",
    sectionLabel: BASIC_SECTION_LABEL,
  })),
  ...FORM2_HISTORY_FIELDS.map<Form2FieldKeyMeta>((f) => ({
    key: `history.${f.key}`,
    label: f.label,
    elementId: f.key,
    section: "history",
    sectionLabel: HISTORY_SECTION_LABEL,
  })),
  ...FORM2_TREATMENT_FIELDS.map<Form2FieldKeyMeta>((f) => ({
    key: `treatment.${f.key}`,
    label: f.label,
    elementId: f.key,
    section: "treatment",
    sectionLabel: TREATMENT_SECTION_LABEL,
  })),
];

const FIELD_BY_KEY = new Map<string, Form2FieldKeyMeta>(
  FORM2_LINK_FIELDS.map((f) => [f.key, f]),
);

// 患者理解画面の「私が考えたこと（考察）」の対象項目。
//   基本属性（氏名・年齢・性別）は意味づけ・解釈の対象にせず、「診断名」以下の様式2 項目に限定する。
//   並びは FORM2_LINK_FIELDS（様式2 本体と同順）を維持する＝診断名→既往歴→入院形態→主訴→経過→治療。
const REFLECTION_EXCLUDED_KEYS = new Set<string>([
  "basicInformation.patientName",
  "basicInformation.age",
  "basicInformation.sex",
]);

export const FORM2_REFLECTION_FIELDS: Form2FieldKeyMeta[] =
  FORM2_LINK_FIELDS.filter((f) => !REFLECTION_EXCLUDED_KEYS.has(f.key));

// DB CHECK と同じ許可集合に含まれるか（Server Action の入力検証で使う）。
export function isForm2FieldKey(key: string): boolean {
  return FIELD_BY_KEY.has(key);
}

export function form2FieldMeta(key: string): Form2FieldKeyMeta | undefined {
  return FIELD_BY_KEY.get(key);
}

export function form2FieldLabel(key: string): string {
  return FIELD_BY_KEY.get(key)?.label ?? key;
}

export function form2FieldElementId(key: string): string {
  return FIELD_BY_KEY.get(key)?.elementId ?? key;
}

// 固定キー（section.field）から、様式2 データの該当する事実（読み取り専用値）を取り出す。
// 患者理解画面で「様式2 の事実」を表示するために使う（自由入力にはしない）。
export function form2FieldValue(data: Form2Data, key: string): string {
  const meta = FIELD_BY_KEY.get(key);
  if (!meta) return "";
  if (meta.section === "basicInformation") {
    return (
      data.basicInformation[meta.elementId as keyof Form2BasicInformation] ?? ""
    );
  }
  if (meta.section === "history") {
    return data.history[meta.elementId as keyof Form2History] ?? "";
  }
  return data.treatment[meta.elementId as keyof Form2Treatment] ?? "";
}

// 項目選択 UI 用に、セクション順でグループ化した配列を返す。
export interface Form2FieldGroup {
  section: Form2FieldSection;
  sectionLabel: string;
  fields: Form2FieldKeyMeta[];
}

export const FORM2_LINK_FIELD_GROUPS: Form2FieldGroup[] = (
  ["basicInformation", "history", "treatment"] as Form2FieldSection[]
).map((section) => ({
  section,
  sectionLabel:
    section === "basicInformation"
      ? BASIC_SECTION_LABEL
      : section === "history"
        ? HISTORY_SECTION_LABEL
        : TREATMENT_SECTION_LABEL,
  fields: FORM2_LINK_FIELDS.filter((f) => f.section === section),
}));
