// Form3 Phase B2-1 — Form3DataV2 ⇄ JSON payload（純関数・DB 非依存）

import type { Form3DataV2 } from "./form3V2Types";

/**
 * Form3DataV2 → JSONB 保存用のプレーンオブジェクト。
 * 関数・undefined・循環参照は JSON 経由で落とす。
 */
export function serializeForm3DataV2(data: Form3DataV2): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

/** Form3DataV2 → JSON 文字列（Draft / テスト用） */
export function serializeForm3DataV2ToJson(data: Form3DataV2): string {
  return JSON.stringify(serializeForm3DataV2(data));
}

/**
 * JSON 文字列または既パース値を unknown に正規化。
 * 破損時は null（呼び出し側で empty / load へ）。
 */
export function parseForm3JsonPayload(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}
