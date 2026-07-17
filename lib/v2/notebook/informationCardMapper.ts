// Compass Version2 β — Phase 3-2
// InformationCard ⇄ information_cards 行 の変換。
//
// 方針:
//   ・読み取り時、patientId はサーバが解決した値を注入する（DB は case_id 保持）。
//   ・書き込み時、user_id / organization_id / academic_year / case_id / created_by /
//     created_at / updated_at はサーバ（またはDB既定）が決定し、クライアント値は使わない。
//   ・created_by は常に 'student'。

import {
  type InformationCard,
  type InformationSourceReference,
  type InformationSourceType,
  isInformationSourceType,
} from "@/lib/information/informationCard";
import type { CardUpdatePatch, NewCardInput } from "./types";

// information_cards の 1 行（select する列）。
export interface InformationCardRow {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  content: string;
  source_type: string;
  source_label: string;
  source_reference: unknown; // jsonb: {kind,id?,date?,tab?} | null
  category: string | null;
  note: string | null;
  original_text: string | null;
  observed_at: string | null;
  created_by: string;
  sort_order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// サーバが INSERT に渡す行（id/created_at/updated_at/deleted_at は DB 既定に任せる）。
export interface InformationCardInsert {
  user_id: string;
  organization_id: string;
  academic_year: number;
  case_id: string;
  content: string;
  source_type: InformationSourceType;
  source_label: string;
  source_reference: InformationSourceReference | null;
  category: string | null;
  note: string | null;
  original_text: string | null;
  observed_at: string | null;
  created_by: "student";
  sort_order: number;
}

export interface CardServerContext {
  userId: string;
  organizationId: string;
  academicYear: number;
  caseId: string;
}

function toSourceReference(value: unknown): InformationSourceReference | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const r = value as Record<string, unknown>;
  if (typeof r.kind !== "string" || r.kind === "") return undefined;
  const ref: InformationSourceReference = { kind: r.kind };
  if (typeof r.id === "string") ref.id = r.id;
  if (typeof r.date === "string") ref.date = r.date;
  if (typeof r.tab === "string") ref.tab = r.tab;
  return ref;
}

// DB 行 → ドメイン InformationCard。patientId はサーバ解決値を注入する。
export function rowToInformationCard(
  row: InformationCardRow,
  patientId: string,
): InformationCard {
  const sourceType: InformationSourceType = isInformationSourceType(row.source_type)
    ? row.source_type
    : "student_observation"; // DB CHECK 済みだが型安全のため既定へフォールバック
  const card: InformationCard = {
    id: row.id,
    patientId,
    content: row.content,
    sourceType,
    sourceLabel: row.source_label,
    createdAt: row.created_at,
    createdBy: row.created_by === "system" ? "system" : "student",
  };
  const ref = toSourceReference(row.source_reference);
  if (ref) card.sourceReference = ref;
  if (row.category != null) card.category = row.category;
  if (row.note != null) card.note = row.note;
  if (row.original_text != null) card.originalText = row.original_text;
  if (row.observed_at != null) card.observedAt = row.observed_at;
  if (row.updated_at != null) card.updatedAt = row.updated_at;
  return card;
}

// NewCardInput + サーバコンテキスト → INSERT 行。created_by は常に student。
export function newCardToInsert(
  input: NewCardInput,
  ctx: CardServerContext,
): InformationCardInsert {
  return {
    user_id: ctx.userId,
    organization_id: ctx.organizationId,
    academic_year: ctx.academicYear,
    case_id: ctx.caseId,
    content: input.content.trim(),
    source_type: input.sourceType,
    source_label: input.sourceLabel.trim(),
    source_reference: input.sourceReference ?? null,
    category: input.category ?? null,
    note: input.note ?? null,
    original_text: input.originalText ?? null,
    observed_at: input.observedAt ?? null,
    created_by: "student",
    sort_order: input.sortOrder ?? 0,
  };
}

// UPDATE の patch を、学生が変更できる列のみへ限定して snake_case へ変換する。
// 不変・identity 系カラムは一切含めない。
export function cardPatchToUpdate(
  patch: CardUpdatePatch,
): Record<string, string | number> {
  const update: Record<string, string | number> = {};
  if (patch.content !== undefined) update.content = patch.content.trim();
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.note !== undefined) update.note = patch.note;
  if (patch.sourceLabel !== undefined) update.source_label = patch.sourceLabel.trim();
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;
  return update;
}

export const CARD_SELECT_COLUMNS =
  "id, user_id, organization_id, academic_year, case_id, content, source_type, source_label, source_reference, category, note, original_text, observed_at, created_by, sort_order, deleted_at, created_at, updated_at";
