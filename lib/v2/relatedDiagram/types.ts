/**
 * Related Diagram V1 — domain types (Slice 0).
 * Canonical education meaning: docs/version2/24_related_diagram_v1_integrated_spec_frozen.md
 * Implementation notes: docs/version2/25_related_diagram_v1_implementation_design.md
 *
 * Draft persistence: related_diagram_records.semantic_graph (jsonb).
 * Not embedded in Form3 payload. First-class assessment artifact (see doc 21).
 */

export const RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION = "1" as const;

export type RelatedDiagramStatus = "draft" | "submitted" | "reopened";

export type RelatedDiagramCardType =
  | "information"
  | "understanding"
  | "knowledge"
  | "nursing_problem";

/** Independent of origin (Design Frozen §3.9 / §6). */
export type RelatedDiagramCardState = "current" | "potential";

export type RelatedDiagramCardOrigin =
  | "patient_information"
  | "form3_assessment"
  | "diagram_integration"
  | "knowledge_library";

export type RelatedDiagramConnectionRelationType =
  | "current"
  | "potential"
  | "treatment"
  | "nursing_problem_basis"
  | "nursing_problem_integration";

export type RelatedDiagramConnectionOrigin =
  | "knowledge_library"
  | "student_diagram"
  | "system_integration";

export type RelatedDiagramCardSourceType =
  | "patient_information"
  | "form3_information_card"
  | "form3_assessment"
  | "evidence"
  | "knowledge_library"
  | "diagram_integration";

export type RelatedDiagramNursingProblemStatus = "active" | "integrated";

export type RelatedDiagramCardLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

/**
 * Provenance entry. Multiple rows per card are allowed
 * (e.g. same Information used across Assessments).
 * sourceId is polymorphic text (Form3 assessment card id, information card uuid, etc.).
 */
export type RelatedDiagramCardSource = {
  id: string;
  cardId: string;
  sourceType: RelatedDiagramCardSourceType;
  sourceId: string;
  /** e.g. Form3 / Knowledge record version at link time */
  sourceVersion: string | null;
  sourcePattern: string | null;
  relation: string | null;
  createdAt: string;
};

export type RelatedDiagramCard = {
  id: string;
  cardType: RelatedDiagramCardType;
  text: string;
  /**
   * Frozen: information/knowledge → null only;
   * understanding/nursing_problem → current|potential required (null forbidden).
   */
  state: RelatedDiagramCardState | null;
  origin: RelatedDiagramCardOrigin;
  layout: RelatedDiagramCardLayout;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RelatedDiagramConnection = {
  id: string;
  sourceCardId: string;
  targetCardId: string;
  relationType: RelatedDiagramConnectionRelationType;
  origin: RelatedDiagramConnectionOrigin;
  createdAt: string;
  updatedAt: string;
};

export type RelatedDiagramNursingProblem = {
  cardId: string;
  status: RelatedDiagramNursingProblemStatus;
  /** Unique among active problems when set */
  priority: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RelatedDiagramNursingProblemSupport = {
  nursingProblemCardId: string;
  supportingCardId: string;
  createdAt: string;
};

/** One integration event (supports multi-stage history). */
export type RelatedDiagramIntegration = {
  id: string;
  resultProblemCardId: string;
  createdAt: string;
};

export type RelatedDiagramIntegrationMember = {
  integrationId: string;
  sourceProblemCardId: string;
};

/**
 * Draft / snapshot semantic graph aggregate.
 * Preserves provenance, Form3 linkage, NP support, integration history, priority.
 */
export type RelatedDiagramSemanticGraph = {
  semanticSchemaVersion: typeof RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION;
  cards: RelatedDiagramCard[];
  cardSources: RelatedDiagramCardSource[];
  connections: RelatedDiagramConnection[];
  nursingProblems: RelatedDiagramNursingProblem[];
  nursingProblemSupports: RelatedDiagramNursingProblemSupport[];
  integrations: RelatedDiagramIntegration[];
  integrationMembers: RelatedDiagramIntegrationMember[];
};

export type RelatedDiagramRecordMeta = {
  id: string;
  userId: string;
  organizationId: string;
  academicYear: number;
  caseId: string;
  assessmentCycleId: string | null;
  status: RelatedDiagramStatus;
  canvasSchemaVersion: string;
  knowledgeGroupId: string | null;
  knowledgeVersion: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RelatedDiagramDraft = RelatedDiagramRecordMeta & {
  semanticGraph: RelatedDiagramSemanticGraph;
};

/**
 * Immutable submission payload shape (related_diagram_submissions.diagram_snapshot).
 * Connects to assessment_submissions-style reproducibility without embedding in Form3.
 */
export type RelatedDiagramSubmissionSnapshot = {
  semanticSchemaVersion: typeof RELATED_DIAGRAM_SEMANTIC_SCHEMA_VERSION;
  relatedDiagramId: string;
  caseId: string;
  studentRef: string;
  submittedAt: string;
  assessmentCycleId: string | null;
  knowledgeGroupId: string | null;
  knowledgeVersion: string | null;
  statusAtSubmit: RelatedDiagramStatus;
  graph: RelatedDiagramSemanticGraph;
};

export type RelatedDiagramKnowledgeSnapshot = {
  knowledgeGroupId: string;
  knowledgeVersion: string;
  topicKey: string;
  title: string;
  cards: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  }>;
  connections: Array<{
    id: string;
    sourceKnowledgeCardId: string;
    targetKnowledgeCardId: string;
    relationType: string;
  }>;
};

export type RelatedDiagramSourceVersions = {
  relatedDiagram: number | null;
  form3: number | null;
  knowledgeVersion: string | null;
};
