// Compass Version2 — Learning Layer (Sprint D-3A)
// Form2FieldReflection ⇄ form2_field_reflections 行 の変換。
//
// 位置づけ:
//   様式2（事実の整理）の各項目に対する「私が考えたこと（考察）」。患者理解画面で、
//   様式2 の各事実を参照しながら学生が意味づけ・解釈を書く。最終統合物「私が捉えた患者さん」
//   （patient_understanding_records）とは別レコード。
//
// 方針（既存 patientUnderstanding / form2 マッパーを踏襲）:
//   ・学生 × ケース × 項目キー で 1 レコード。reflection_text のみ学生が更新する。
//   ・user_id / organization_id / academic_year / case_id / patient_id / form2_field_key は
//     サーバが決定し保存する（クライアントの改ざんを受け付けない）。
//   ・updatedAt は DB の生 updated_at(ISO)。将来の履歴・整合チェックに使えるよう保持する。

// form2_field_reflections の 1 行（select する列）。
export interface Form2FieldReflectionRow {
  form2_field_key: string;
  reflection_text: string;
  updated_at: string;
}

// サーバが upsert に渡す行（id/created_at/updated_at は DB 既定・トリガーに任せる）。
export interface Form2FieldReflectionUpsert {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  patient_id: string;
  form2_field_key: string;
  reflection_text: string;
}

// クライアントへ渡すドメイン型（識別情報は含めない）。
export interface Form2FieldReflection {
  fieldKey: string;
  reflectionText: string;
  updatedAt: string;
}

export const FORM2_FIELD_REFLECTION_SELECT_COLUMNS =
  "form2_field_key, reflection_text, updated_at";

export function rowToForm2FieldReflection(
  row: Form2FieldReflectionRow,
): Form2FieldReflection {
  return {
    fieldKey: row.form2_field_key,
    reflectionText: row.reflection_text ?? "",
    updatedAt: row.updated_at,
  };
}
