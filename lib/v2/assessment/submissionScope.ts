import {
  FORM3_PATTERN_ORDER,
  isForm3PatternKey,
  type Form3PatternKey,
} from "@/lib/form3/form3Types";
import type {
  AssessmentMilestoneType,
  AssessmentSubmissionScope,
  Form3Scope,
} from "./types";

export function defaultScopeForType(
  type: AssessmentMilestoneType,
  patternIds: Form3PatternKey[] = [],
): AssessmentSubmissionScope {
  switch (type) {
    case "form2":
      return {
        includeForm2: true,
        includeForm3: false,
        includeInformationCards: true,
        includeEvidenceLinks: true,
        includeFieldReflections: true,
        includePatientUnderstanding: false,
      };
    case "form3_progress":
      return {
        includeForm2: true,
        includeForm3: true,
        form3Scope: {
          mode: "selected_patterns",
          patternIds,
        },
        includeInformationCards: true,
        includeEvidenceLinks: true,
        includeFieldReflections: true,
        includePatientUnderstanding: false,
      };
    case "form3_complete":
    case "final":
      return {
        includeForm2: true,
        includeForm3: true,
        form3Scope: { mode: "all_patterns" },
        includeInformationCards: true,
        includeEvidenceLinks: true,
        includeFieldReflections: true,
        includePatientUnderstanding: true,
      };
    case "custom":
    default:
      return {
        includeForm2: true,
        includeForm3: true,
        form3Scope: { mode: "all_patterns" },
        includeInformationCards: true,
        includeEvidenceLinks: true,
        includeFieldReflections: true,
        includePatientUnderstanding: true,
      };
  }
}

export function parseSubmissionScope(raw: unknown): AssessmentSubmissionScope {
  const fallback = defaultScopeForType("final");
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const form3Scope = parseForm3Scope(o.form3Scope);
  return {
    includeForm2: Boolean(o.includeForm2),
    includeForm3: Boolean(o.includeForm3),
    form3Scope,
    includeInformationCards: Boolean(o.includeInformationCards),
    includeEvidenceLinks: Boolean(o.includeEvidenceLinks ?? true),
    includeFieldReflections: Boolean(o.includeFieldReflections ?? true),
    includePatientUnderstanding: Boolean(o.includePatientUnderstanding),
  };
}

function parseForm3Scope(raw: unknown): Form3Scope | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.mode === "all_patterns") return { mode: "all_patterns" };
  if (o.mode === "selected_patterns") {
    const ids = Array.isArray(o.patternIds)
      ? o.patternIds.filter(
          (x): x is Form3PatternKey =>
            typeof x === "string" && isForm3PatternKey(x),
        )
      : [];
    return { mode: "selected_patterns", patternIds: ids };
  }
  return undefined;
}

export function validateScopeForType(
  type: AssessmentMilestoneType,
  scope: AssessmentSubmissionScope,
): string | null {
  if (type === "form3_progress") {
    if (
      !scope.form3Scope ||
      scope.form3Scope.mode !== "selected_patterns" ||
      scope.form3Scope.patternIds.length < 1
    ) {
      return "様式3途中提出では、対象パターンを1つ以上選択してください。";
    }
  }
  return null;
}

const FORM3_PATTERN_SHORT_LABELS: Record<Form3PatternKey, string> = {
  health_perception_management: "健康知覚",
  nutritional_metabolic: "栄養・代謝",
  elimination: "排泄",
  activity_exercise: "活動",
  sleep_rest: "睡眠",
  cognitive_perceptual: "認知",
  self_perception_self_concept: "自己知覚",
  role_relationship: "役割",
  sexuality_reproductive: "性",
  coping_stress_tolerance: "コーピング",
  value_belief: "価値",
};

export function formatPatternIdsJa(patternIds: Form3PatternKey[]): string {
  return patternIds
    .map((id) => FORM3_PATTERN_SHORT_LABELS[id] ?? id)
    .join("、");
}

export function form3PatternShortLabel(key: Form3PatternKey): string {
  return FORM3_PATTERN_SHORT_LABELS[key] ?? key;
}

/** 教員画面用：対象 Form3 パターンの日本語表示 */
export function formatForm3PatternScopeJa(
  scope: AssessmentSubmissionScope | null | undefined,
): string {
  if (!scope?.form3Scope) return "対象指定なし";
  if (scope.form3Scope.mode === "all_patterns") return "すべて";
  if (
    scope.form3Scope.mode === "selected_patterns" &&
    scope.form3Scope.patternIds.length > 0
  ) {
    return formatPatternIdsJa(scope.form3Scope.patternIds);
  }
  return "対象指定なし";
}

export function formatSubmissionScopeJa(
  type: AssessmentMilestoneType,
  scope: AssessmentSubmissionScope,
): string {
  switch (type) {
    case "form2":
      return "様式2";
    case "form3_progress": {
      if (
        scope.form3Scope?.mode === "selected_patterns" &&
        scope.form3Scope.patternIds.length > 0
      ) {
        return `様式3途中（${formatPatternIdsJa(scope.form3Scope.patternIds)}）`;
      }
      return "様式3途中";
    }
    case "form3_complete":
      return "様式3すべて";
    case "final":
      return "最終提出";
    case "custom": {
      const parts: string[] = [];
      if (scope.includeForm2) parts.push("様式2");
      if (scope.includeForm3) {
        if (scope.form3Scope?.mode === "selected_patterns") {
          parts.push(
            `様式3（${formatPatternIdsJa(scope.form3Scope.patternIds)}）`,
          );
        } else {
          parts.push("様式3");
        }
      }
      return parts.length > 0 ? parts.join("・") : "カスタム";
    }
  }
}

export function milestoneTypeLabel(type: AssessmentMilestoneType): string {
  switch (type) {
    case "form2":
      return "様式2";
    case "form3_progress":
      return "様式3途中";
    case "form3_complete":
      return "様式3完成";
    case "final":
      return "最終提出";
    case "custom":
      return "カスタム";
  }
}

export function evaluationTypeLabel(
  type: "formative" | "summative",
): string {
  return type === "formative" ? "形成評価" : "総括評価";
}

export function statusLabel(
  status: "draft" | "open" | "closed" | "archived",
): string {
  switch (status) {
    case "draft":
      return "下書き";
    case "open":
      return "公開中";
    case "closed":
      return "受付終了";
    case "archived":
      return "アーカイブ";
  }
}

export function prefersForm2(type: AssessmentMilestoneType): boolean {
  return type === "form2" || type === "final" || type === "custom";
}

export function prefersForm3(type: AssessmentMilestoneType): boolean {
  return (
    type === "form3_progress" ||
    type === "form3_complete" ||
    type === "final" ||
    type === "custom"
  );
}

export { FORM3_PATTERN_ORDER };
