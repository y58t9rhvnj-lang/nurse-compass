/**
 * クライアント安全な公開面。
 * Gold 本文（模範思考）はここから export しない。
 * 教員向け本体は `lib/gold/access.ts`（server-only）。
 */

export {
  GOLD_STANDARD_SCHEMA_VERSION,
  type GoldCaseRef,
  type GoldCanonicalInformationRef,
  type GoldCriticalThinkingPoint,
  type GoldStandardDocument,
  type GoldValidationIssue,
  type GoldValidationResult,
} from "./types";

export {
  validateGoldStandardDocument,
  validateCanonicalInformationCatalog,
  catalogIdSet,
} from "./validation";

export { parseGoldStandardDocument } from "./load";

export {
  PATIENT_A_CANONICAL_INFORMATION_CATALOG,
  PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS,
  getPatientACanonicalInformationById,
} from "./patientA/canonicalInformationCatalog";

export { PATIENT_A_CTP_EVIDENCE_MAP } from "./patientA/ctpEvidenceMap";
