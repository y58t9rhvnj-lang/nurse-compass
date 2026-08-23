/**
 * Aさん Gold Standard v1 本番データ。
 *
 * ソース: `A_gold_standard_v1.source.json`（Downloads の A_gold_standard_v1.json を移植）
 * - 学生 Form3 / Form2 には書き込まない
 * - evidence は ctpEvidenceMap の安定カタログ ID
 * - ランタイムの教員ゲートは `lib/gold/access.ts`（server-only）経由に限定する
 * - 学生向け client コンポーネントから本モジュールを import しないこと
 */

import sourceJson from "./A_gold_standard_v1.source.json";
import { PATIENT_A_CANONICAL_INFORMATION_CATALOG } from "./canonicalInformationCatalog";
import { normalizePatientAGoldSourceV1 } from "./normalizeSourceV1";
import { parseGoldStandardDocument } from "../load";
import type { GoldStandardDocument } from "../types";

function buildDocument(): GoldStandardDocument {
  const normalized = normalizePatientAGoldSourceV1(sourceJson);
  if (!normalized.ok) {
    const detail = normalized.issues
      .map((i) => `${i.path}:${i.code}`)
      .join("; ");
    throw new Error(`Patient A Gold Standard v1 normalize failed: ${detail}`);
  }
  const validated = parseGoldStandardDocument(
    normalized.document,
    PATIENT_A_CANONICAL_INFORMATION_CATALOG,
  );
  if (!validated.ok) {
    const detail = validated.issues.map((i) => `${i.path}:${i.code}`).join("; ");
    throw new Error(`Patient A Gold Standard v1 validate failed: ${detail}`);
  }
  return validated.document;
}

let cached: GoldStandardDocument | null | undefined;

/**
 * 本番 Gold Standard。正規化・検証済み。失敗時は throw（起動時に検知）。
 */
export function getPatientAGoldStandardV1(): GoldStandardDocument {
  if (cached === undefined) {
    cached = buildDocument();
  }
  if (cached === null) {
    throw new Error("Patient A Gold Standard v1 unavailable");
  }
  return cached;
}

/** null 許容版（アクセスゲート用） */
export function getPatientAGoldStandardV1OrNull(): GoldStandardDocument | null {
  try {
    return getPatientAGoldStandardV1();
  } catch {
    return null;
  }
}

export function isPatientAGoldStandardV1Ready(): boolean {
  return getPatientAGoldStandardV1OrNull() !== null;
}
