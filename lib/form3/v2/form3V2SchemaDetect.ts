// Form3 Phase B — payload schema 判定（循環依存回避の薄いモジュール）

export type Form3PayloadSchemaVersion = 1 | 2;

export type DetectForm3PayloadSchemaResult = {
  schemaVersion: Form3PayloadSchemaVersion | null;
};

/**
 * payload の schema 判定。
 * - schemaVersion 明示を優先
 * - 欠落時は構造ヒューリスティック（patterns → v1、cards+finalForm → v2）
 */
export function detectForm3PayloadSchema(
  raw: unknown,
): DetectForm3PayloadSchemaResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { schemaVersion: null };
  }
  const v = raw as Record<string, unknown>;

  if (v.schemaVersion === 2) return { schemaVersion: 2 };
  if (v.schemaVersion === 1) return { schemaVersion: 1 };

  if (
    Array.isArray(v.informationCards) &&
    Array.isArray(v.assessmentCards) &&
    v.finalForm !== null &&
    typeof v.finalForm === "object"
  ) {
    return { schemaVersion: 2 };
  }
  if (v.patterns !== null && typeof v.patterns === "object") {
    return { schemaVersion: 1 };
  }
  return { schemaVersion: null };
}
