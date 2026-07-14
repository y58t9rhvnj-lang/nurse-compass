// Sprint11.1: Information Card 最小基盤（型・生成・検証）。
// 情報カードは Compass Version1 の中核ドメインモデル。
// 患者との対話・電子カルテ・観察から生まれ、出所を保持したまま各段階へ受け渡される。
// 詳細は docs/02_Information_Card_Model.md を参照。
// 本 Sprint では型・保存基盤・互換層のみを導入し、遷移UIやノート追加ボタンは実装しない。

// 情報の出所種別（docs/02 の Supported Sources に対応）。
export const INFORMATION_SOURCE_TYPES = [
  "patient_conversation",
  "student_observation",
  "clinical_record",
  "nursing_record",
  "flowsheet",
  "prescription",
  "examination",
  "life_history",
  "ot",
  "psw",
  "student_note",
  "pathophysiology_reference",
] as const;

export type InformationSourceType = (typeof INFORMATION_SOURCE_TYPES)[number];

export type InformationCardCreatedBy = "student" | "system";

// 出所へ厳密に戻るための参照情報。
// 今回は遷移UIを実装しないため保持のみ。将来 lib/chartNav.ts の ChartFocus と対応づける。
//   kind 例: "recordId" | "nursingId" | "rxId" | "flowsheetDate" | "date" | "student_note" ...
export interface InformationSourceReference {
  kind: string;
  id?: string;
  date?: string;
  tab?: string;
}

export interface InformationCard {
  id: string;
  patientId: string;
  content: string;
  sourceType: InformationSourceType;
  sourceLabel: string;
  sourceReference?: InformationSourceReference;
  createdAt: string; // ISO 8601
  createdBy: InformationCardCreatedBy;
  category?: string;
  note?: string;
  originalText?: string;
  observedAt?: string; // ISO 8601（学生観察や記録の発生時刻）
  updatedAt?: string; // ISO 8601（収集後に content を修正した時刻。既存データには無くてよい）
}

// 生成入力：id / createdAt は省略可（未指定なら自動採番）。
export type NewInformationCardInput = Omit<InformationCard, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

// ===== ID 生成（クライアント側・衝突しにくい） =====

// crypto.randomUUID を優先し、未対応環境ではフォールバックする（notesStore と同方針）。
export function createCardId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") {
    return g.crypto.randomUUID();
  }
  return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ===== 検証 =====

export function isInformationSourceType(
  value: unknown,
): value is InformationSourceType {
  return (
    typeof value === "string" &&
    (INFORMATION_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

function isValidSourceReference(value: unknown): boolean {
  if (value === undefined) return true; // 任意フィールド
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  if (typeof r.kind !== "string" || r.kind === "") return false;
  for (const k of ["id", "date", "tab"] as const) {
    if (r[k] !== undefined && typeof r[k] !== "string") return false;
  }
  return true;
}

export interface CardValidationResult {
  ok: boolean;
  errors: string[];
}

// 情報カードの入力を検証する。localStorage 由来の値も必ずこれを通す。
export function validateInformationCard(value: unknown): CardValidationResult {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["card must be an object"] };
  }
  const v = value as Record<string, unknown>;

  if (typeof v.id !== "string" || v.id.trim() === "") errors.push("id is required");
  if (typeof v.patientId !== "string" || v.patientId.trim() === "")
    errors.push("patientId is required");
  if (typeof v.content !== "string" || v.content.trim() === "")
    errors.push("content must be a non-empty string");
  if (!isInformationSourceType(v.sourceType))
    errors.push("sourceType is invalid");
  if (typeof v.sourceLabel !== "string" || v.sourceLabel.trim() === "")
    errors.push("sourceLabel is required");
  if (typeof v.createdAt !== "string" || v.createdAt.trim() === "")
    errors.push("createdAt is required");
  if (v.createdBy !== "student" && v.createdBy !== "system")
    errors.push("createdBy must be 'student' or 'system'");
  if (!isValidSourceReference(v.sourceReference))
    errors.push("sourceReference is invalid");
  for (const k of ["category", "note", "originalText", "observedAt", "updatedAt"] as const) {
    if (v[k] !== undefined && typeof v[k] !== "string")
      errors.push(`${k} must be a string when present`);
  }

  return { ok: errors.length === 0, errors };
}

export function isInformationCard(value: unknown): value is InformationCard {
  return validateInformationCard(value).ok;
}

// ===== 生成 =====

// 入力から情報カードを生成する。id / createdAt を補完し、必ず検証を通す。
// 不正な場合は例外を投げる（呼び出し側が明示的に扱う）。
export function createInformationCard(
  input: NewInformationCardInput,
): InformationCard {
  const card: InformationCard = {
    ...input,
    id: input.id ?? createCardId(),
    content: typeof input.content === "string" ? input.content.trim() : input.content,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  const result = validateInformationCard(card);
  if (!result.ok) {
    throw new Error(`Invalid InformationCard: ${result.errors.join("; ")}`);
  }
  return card;
}
