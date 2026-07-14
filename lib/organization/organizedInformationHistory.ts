// Sprint11.3A: 情報（OrganizedInformation）の履歴（revision）基盤。
//
// 目的：Version1 では履歴 UI を作らないが、学生の考えの変化を安全に追跡・復元できる
// 基盤を持たせる。更新のたびに新しい revision を作り、過去の revision は削除しない。
//
// 各 revision は、その時点の title / content / sourceDataIds / timestamp を保存する。
// previousRevisionId で直前の revision へつなぐ。
// current（OrganizedInformation）と history（OrganizedInformationRevision[]）を
// 分けて保持することで、どちらからでも安全に復元できる。

import {
  validateSourceDataIds,
  type OrganizedInformation,
  type OrganizedInformationCreatedBy,
} from "./organizedInformation";

export interface OrganizedInformationRevision {
  id: string;
  informationId: string;
  revision: number;
  title: string;
  content: string;
  sourceDataIds: string[];
  createdAt: string; // ISO 8601（この revision が作られた時刻）
  createdBy: OrganizedInformationCreatedBy;
  previousRevisionId?: string;
}

// ===== ID 生成 =====

export function createRevisionId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") {
    return `rev-${g.crypto.randomUUID()}`;
  }
  return `rev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ===== 検証 =====

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

export interface RevisionValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateOrganizedInformationRevision(
  value: unknown,
): RevisionValidationResult {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["revision must be an object"] };
  }
  const v = value as Record<string, unknown>;

  if (!isNonEmptyString(v.id)) errors.push("id is required");
  if (!isNonEmptyString(v.informationId)) errors.push("informationId is required");
  if (
    typeof v.revision !== "number" ||
    !Number.isInteger(v.revision) ||
    v.revision < 1
  )
    errors.push("revision must be an integer >= 1");
  if (!isNonEmptyString(v.title)) errors.push("title must be a non-empty string");
  if (!isNonEmptyString(v.content))
    errors.push("content must be a non-empty string");
  errors.push(...validateSourceDataIds(v.sourceDataIds));
  if (!isNonEmptyString(v.createdAt)) errors.push("createdAt is required");
  if (v.createdBy !== "student") errors.push("createdBy must be 'student'");
  if (
    v.previousRevisionId !== undefined &&
    !isNonEmptyString(v.previousRevisionId)
  )
    errors.push("previousRevisionId must be a non-empty string when present");

  return { ok: errors.length === 0, errors };
}

export function isOrganizedInformationRevision(
  value: unknown,
): value is OrganizedInformationRevision {
  return validateOrganizedInformationRevision(value).ok;
}

// ===== revision 生成 =====

// 情報のスナップショットから revision エントリを作る。
// revision 番号・sourceDataIds・content 等は情報側の現在値を採用する。
// createdAt は明示指定がなければ情報の updatedAt を用いる。
export function createRevisionEntry(
  info: OrganizedInformation,
  opts?: { id?: string; createdAt?: string; previousRevisionId?: string },
): OrganizedInformationRevision {
  const entry: OrganizedInformationRevision = {
    id: opts?.id ?? createRevisionId(),
    informationId: info.id,
    revision: info.revision,
    title: info.title,
    content: info.content,
    sourceDataIds: [...info.sourceDataIds],
    createdAt: opts?.createdAt ?? info.updatedAt,
    createdBy: "student",
    previousRevisionId: opts?.previousRevisionId ?? info.previousRevisionId,
  };
  const result = validateOrganizedInformationRevision(entry);
  if (!result.ok) {
    throw new Error(
      `Invalid OrganizedInformationRevision: ${result.errors.join("; ")}`,
    );
  }
  return entry;
}
