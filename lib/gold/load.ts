/**
 * Gold Standard JSON / オブジェクトの読み込み（純関数・server-only 非依存）。
 * 学生向け UI から import しないこと（教員ゲートは access.ts）。
 */

import {
  catalogIdSet,
  validateGoldStandardDocument,
} from "./validation";
import type { GoldCanonicalInformationRef } from "./types";
import type { GoldValidationResult } from "./types";

export function parseGoldStandardDocument(
  raw: unknown,
  catalog: readonly GoldCanonicalInformationRef[],
): GoldValidationResult {
  return validateGoldStandardDocument(raw, catalogIdSet(catalog));
}
