/**
 * クライアント安全な公開面。
 * Teacher Insight 本文（patientA / library の実データ）はここから export しない。
 * 教員向け本体は `lib/teacherInsights/access.ts`（server-only）。
 */

export {
  TEACHER_INSIGHT_SCHEMA_VERSION,
  type CoachingQuestionStage,
  type TeacherInsightCoachingQuestion,
  type TeacherInsightDocument,
  type TeacherInsightGoldRelationship,
  type TeacherInsightGoldRelationshipKind,
  type TeacherInsightHypothesis,
  type TeacherInsightHypothesisEvidenceState,
  type TeacherInsightLibraryValidationResult,
  type TeacherInsightScope,
  type TeacherInsightSourceMetadata,
  type TeacherInsightValidationIssue,
  type TeacherInsightValidationResult,
} from "./types";

export {
  catalogIdSetFromList,
  validateTeacherInsightDocument,
  validateTeacherInsightLibrary,
} from "./validation";

export {
  parseTeacherInsightDocument,
  parseTeacherInsightLibrary,
} from "./load";

export { PATIENT_A_TEACHER_INSIGHT_EVIDENCE_MAP } from "./patientA/insightEvidenceMap";

export {
  COACHING_STAGE_LABEL_JA,
  GOLD_RELATIONSHIP_KIND_LABEL_JA,
  HYPOTHESIS_EVIDENCE_STATE_LABEL_JA,
  uniqueStageLabelsJa,
} from "./labels";

export {
  resolveTeacherInsightsEvidence,
  type ResolvedTeacherEvidence,
  type ResolvedTeacherHypothesis,
  type ResolvedTeacherInsight,
  type ResolveTeacherInsightsResult,
} from "./resolveEvidence";
