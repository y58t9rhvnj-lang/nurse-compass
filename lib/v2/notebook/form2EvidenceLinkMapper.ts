// Compass Version2 — Learning Layer (Sprint D-2B)
// Form2EvidenceLink ⇄ form2_evidence_links 行 の変換。
//
// 方針:
//   ・リンクは「関係」であり作成・削除のみ（UPDATE 経路を持たない）。
//   ・書き込み時、user_id / organization_id / academic_year / case_id / form2_record_id /
//     created_by / created_at はサーバ（またはDB既定）が決定し、クライアント値は使わない。
//   ・created_by は常に 'student'。

// form2_evidence_links の 1 行（select する列）。
export interface Form2EvidenceLinkRow {
  id: string;
  form2_field_key: string;
  evidence_id: string;
  created_at: string;
}

// サーバが INSERT に渡す行（id/created_at は DB 既定に任せる）。
export interface Form2EvidenceLinkInsert {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  form2_record_id: string;
  form2_field_key: string;
  evidence_id: string;
  created_by: "student";
}

// クライアントへ渡すドメイン型（識別情報は含めない。関係の可視化に必要な最小限のみ）。
export interface Form2EvidenceLink {
  id: string;
  // section.field のドットパス（lib/form2/form2FieldKeys.ts と一致）。
  formFieldKey: string;
  // 参照する Evidence（information_cards.id）。
  evidenceId: string;
  createdAt: string;
}

export const FORM2_EVIDENCE_LINK_SELECT_COLUMNS =
  "id, form2_field_key, evidence_id, created_at";

export function rowToForm2EvidenceLink(
  row: Form2EvidenceLinkRow,
): Form2EvidenceLink {
  return {
    id: row.id,
    formFieldKey: row.form2_field_key,
    evidenceId: row.evidence_id,
    createdAt: row.created_at,
  };
}
