// Sprint11.3A: 学生が作成する「情報」（OrganizedInformation）の最小ドメイン基盤。
//
// docs/03_Information_Organization_Workspace.md の「データ → 情報 → 手がかり」モデルにおいて、
//   - データ（Data）  = InformationCard（lib/information/）。事実・根拠であり編集しない。
//   - 情報（Information）= OrganizedInformation。1つ以上のデータを学生が整理・統合し、
//                          患者理解に必要な意味を持たせたもの。
//
// 本 Sprint では型・保存・履歴・検証のみを実装し、画面（Workspace UI）は作らない。
// 重要な原則:
//   - 情報は学生だけが作成する（createdBy は "student" 固定。system / AI 生成を許可しない）。
//   - Compass は情報を自動生成・自動要約・自動統合・自動タイトル生成しない。
//   - データ本文を情報側へ複製せず、参照関係（sourceDataIds）だけを保持する。
//   - 1つの情報は複数データを参照でき、1つのデータは複数情報から参照できる。
//   - 情報と参照データの patientId は一致していなければならない。

import type { InformationCard } from "../information/informationCard";

export type OrganizedInformationStatus = "draft" | "organized" | "archived";

// 情報は学生のみが作成する。system / AI は許可しない。
export type OrganizedInformationCreatedBy = "student";

export interface OrganizedInformation {
  id: string;
  patientId: string;
  title: string;
  content: string;
  // 参照するデータ（InformationCard.id）の一覧。順序を保持し、重複は持たない。
  sourceDataIds: string[];
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  createdBy: OrganizedInformationCreatedBy;
  revision: number; // 1 以上。更新のたびに増える。
  previousRevisionId?: string; // 直前の履歴（OrganizedInformationRevision.id）
  status?: OrganizedInformationStatus;
}

// 生成入力：id / createdAt / updatedAt は省略可（未指定なら自動補完）。
// revision / createdBy は生成側で固定するため受け取らない。
export type NewOrganizedInformationInput = {
  patientId: string;
  title: string;
  content: string;
  sourceDataIds: string[];
  status?: OrganizedInformationStatus;
  id?: string;
  createdAt?: string;
  updatedAt?: string;
};

// ===== ID 生成（informationCard.ts と同方針） =====

export function createInformationId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") {
    return `info-${g.crypto.randomUUID()}`;
  }
  return `info-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ===== 検証 =====

const STATUS_VALUES: readonly OrganizedInformationStatus[] = [
  "draft",
  "organized",
  "archived",
];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

export interface OrganizedInformationValidationResult {
  ok: boolean;
  errors: string[];
}

// sourceDataIds 単体の検証（1件以上・全て非空文字列・重複なし）。
export function validateSourceDataIds(value: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(value)) {
    errors.push("sourceDataIds must be an array");
    return errors;
  }
  if (value.length < 1) {
    errors.push("sourceDataIds must have at least one entry");
  }
  if (!value.every((x) => isNonEmptyString(x))) {
    errors.push("sourceDataIds must all be non-empty strings");
  } else if (new Set(value).size !== value.length) {
    errors.push("sourceDataIds must not contain duplicates");
  }
  return errors;
}

// OrganizedInformation の検証。localStorage 由来の値も必ずこれを通す。
export function validateOrganizedInformation(
  value: unknown,
): OrganizedInformationValidationResult {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["organized information must be an object"] };
  }
  const v = value as Record<string, unknown>;

  if (!isNonEmptyString(v.id)) errors.push("id is required");
  if (!isNonEmptyString(v.patientId)) errors.push("patientId is required");
  if (!isNonEmptyString(v.title)) errors.push("title must be a non-empty string");
  if (!isNonEmptyString(v.content))
    errors.push("content must be a non-empty string");
  errors.push(...validateSourceDataIds(v.sourceDataIds));
  if (!isNonEmptyString(v.createdAt)) errors.push("createdAt is required");
  if (!isNonEmptyString(v.updatedAt)) errors.push("updatedAt is required");
  if (v.createdBy !== "student") errors.push("createdBy must be 'student'");
  if (
    typeof v.revision !== "number" ||
    !Number.isInteger(v.revision) ||
    v.revision < 1
  )
    errors.push("revision must be an integer >= 1");
  if (
    v.previousRevisionId !== undefined &&
    !isNonEmptyString(v.previousRevisionId)
  )
    errors.push("previousRevisionId must be a non-empty string when present");
  if (
    v.status !== undefined &&
    !STATUS_VALUES.includes(v.status as OrganizedInformationStatus)
  )
    errors.push("status is invalid");

  return { ok: errors.length === 0, errors };
}

export function isOrganizedInformation(
  value: unknown,
): value is OrganizedInformation {
  return validateOrganizedInformation(value).ok;
}

// ===== 生成 =====

// 入力から情報を生成する（revision=1・createdBy=student 固定）。必ず検証を通す。
// 不正な場合は例外を投げる（呼び出し側が明示的に扱う）。
export function createOrganizedInformation(
  input: NewOrganizedInformationInput,
): OrganizedInformation {
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const info: OrganizedInformation = {
    id: input.id ?? createInformationId(),
    patientId: input.patientId,
    title: typeof input.title === "string" ? input.title.trim() : input.title,
    content:
      typeof input.content === "string" ? input.content.trim() : input.content,
    sourceDataIds: Array.isArray(input.sourceDataIds)
      ? [...input.sourceDataIds]
      : input.sourceDataIds,
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    createdBy: "student",
    revision: 1,
    status: input.status,
  };
  const result = validateOrganizedInformation(info);
  if (!result.ok) {
    throw new Error(`Invalid OrganizedInformation: ${result.errors.join("; ")}`);
  }
  return info;
}

// ===== 患者整合性（情報の patientId と参照データの patientId 一致） =====

export interface SourceDataOwnershipResult {
  ok: boolean;
  errors: string[];
}

// 参照する各 sourceDataId が、同じ患者のデータであることを検証する。
// 見つからない ID・患者不一致の ID があれば ok=false。
export function validateSourceDataOwnership(
  patientId: string,
  sourceDataIds: string[],
  cards: InformationCard[],
): SourceDataOwnershipResult {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const errors: string[] = [];
  for (const id of sourceDataIds) {
    const card = byId.get(id);
    if (!card) {
      errors.push(`source data not found: ${id}`);
      continue;
    }
    if (card.patientId !== patientId) {
      errors.push(
        `source data patient mismatch: ${id} (expected ${patientId}, got ${card.patientId})`,
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

// ===== データ解決（情報 → 元データ） =====

export interface ResolveSourceDataResult {
  // sourceDataIds の順序を保った、実在かつ患者一致のデータ。
  resolved: InformationCard[];
  // cards の中に見つからなかった ID。
  missingIds: string[];
  // 見つかったが患者が一致しなかった ID（表示から除外）。
  mismatchedIds: string[];
  // 参照できるデータが 0 件（警告可能）。
  hasNoSource: boolean;
}

// 情報から元データ（InformationCard）を取得する純粋関数。
// - sourceDataIds の順序を維持する
// - 見つからない ID は missingIds へ（安全にスキップ）
// - patientId 不一致は mismatchedIds へ（除外）
// - 元の InformationCard は変更しない
export function resolveSourceData(
  info: Pick<OrganizedInformation, "patientId" | "sourceDataIds">,
  cards: InformationCard[],
): ResolveSourceDataResult {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const resolved: InformationCard[] = [];
  const missingIds: string[] = [];
  const mismatchedIds: string[] = [];
  for (const id of info.sourceDataIds) {
    const card = byId.get(id);
    if (!card) {
      missingIds.push(id);
      continue;
    }
    if (card.patientId !== info.patientId) {
      mismatchedIds.push(id);
      continue;
    }
    resolved.push(card);
  }
  return {
    resolved,
    missingIds,
    mismatchedIds,
    hasNoSource: resolved.length === 0,
  };
}
