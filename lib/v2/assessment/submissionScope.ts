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
        // 様式2段階の評価対象は「様式2」＋「患者理解を深める」
        includePatientUnderstanding: true,
      };
    case "form3_progress":
      // Form3 AI / 課題デフォルト: Form3 のみ。Form2 系は無条件に混ぜない（明示 opt-in 可）。
      return {
        includeForm2: false,
        includeForm3: true,
        form3Scope: {
          mode: "selected_patterns",
          patternIds,
        },
        includeInformationCards: false,
        includeEvidenceLinks: false,
        includeFieldReflections: false,
        includePatientUnderstanding: false,
      };
    case "form3_complete":
      return {
        includeForm2: false,
        includeForm3: true,
        form3Scope: { mode: "all_patterns" },
        includeInformationCards: false,
        includeEvidenceLinks: false,
        includeFieldReflections: false,
        includePatientUnderstanding: false,
      };
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

/**
 * AI評価 Package 用: 様式2段階の必須 scope（policy 2026.4）。
 * DB デフォルト全体は変えず、Package 適用時の防御的整合に使う。
 */
export const FORM2_AI_EVAL_REQUIRED_SCOPE: AssessmentSubmissionScope = {
  includeForm2: true,
  includeForm3: false,
  includeInformationCards: false,
  includeEvidenceLinks: false,
  includeFieldReflections: true,
  includePatientUnderstanding: true,
};

/**
 * AI評価 Package 用: 様式3段階の必須 / デフォルト scope（policy 2026.5 / 07・08）。
 * - includeForm3 = 必須 ON
 * - Form2 / reflections / PU / notebook cards / evidence = デフォルト OFF（required ではない）
 * - form3Scope はマイルストーン DB 設定を保持（ここには含めない）
 * Final=主 / Form3 内 Cards=補助は policy（StaticContent）で表現。scope サブフラグは増やさない。
 */
export const FORM3_AI_EVAL_REQUIRED_SCOPE: AssessmentSubmissionScope = {
  includeForm2: false,
  includeForm3: true,
  includeInformationCards: false,
  includeEvidenceLinks: false,
  includeFieldReflections: false,
  includePatientUnderstanding: false,
};

export type AiEvalScopePolicyWarning = {
  code:
    | "db_scope_policy_mismatch"
    | "visible_scope_mismatch"
    | "patient_understanding_out_of_scope"
    | "information_cards_in_scope_against_policy"
    | "form3_form2_opt_in"
    | "form3_patient_understanding_opt_in";
  message: string;
};

function isForm3AiEvalMilestoneType(
  milestoneType: string | null | undefined,
): boolean {
  return (
    milestoneType === "form3_progress" || milestoneType === "form3_complete"
  );
}

export type AiEvalScopeCorrectionResult = {
  packageScope: AssessmentSubmissionScope | null;
  /** DB scope から補正を適用したか */
  corrected: boolean;
  corrections: string[];
  warnings: AiEvalScopePolicyWarning[];
};

function scopeFlagEqual(
  a: AssessmentSubmissionScope,
  b: AssessmentSubmissionScope,
): boolean {
  return (
    Boolean(a.includeForm2) === Boolean(b.includeForm2) &&
    Boolean(a.includeForm3) === Boolean(b.includeForm3) &&
    Boolean(a.includeInformationCards) === Boolean(b.includeInformationCards) &&
    Boolean(a.includeEvidenceLinks) === Boolean(b.includeEvidenceLinks) &&
    Boolean(a.includeFieldReflections) === Boolean(b.includeFieldReflections) &&
    Boolean(a.includePatientUnderstanding) ===
      Boolean(b.includePatientUnderstanding)
  );
}

/**
 * AI評価 Package 用: 様式2課題では必須 scope へ防御的に整合する。
 * DB が既に一致している場合は補正なし（corrected=false）。
 * 不一致時は補正しつつ警告を返す（黙って隠さない）。
 */
export function scopeForAiEvaluationPackage(
  milestoneType: string | null | undefined,
  scope: AssessmentSubmissionScope | null | undefined,
): AssessmentSubmissionScope | null {
  return resolveScopeForAiEvaluationPackage(milestoneType, scope).packageScope;
}

function resolveForm3ScopeForAiEvaluationPackage(
  scope: AssessmentSubmissionScope,
): AiEvalScopeCorrectionResult {
  const required = FORM3_AI_EVAL_REQUIRED_SCOPE;
  const warnings: AiEvalScopePolicyWarning[] = [];
  const corrections: string[] = [];

  // 必須: Form3 ON。notebook 横断カード・evidence は AI では常に OFF。
  // Form2 / reflections / PU は required では OFF。DB で true なら明示 opt-in として保持。
  const includeForm2 = Boolean(scope.includeForm2);
  const includeFieldReflections = Boolean(scope.includeFieldReflections);
  const includePatientUnderstanding = Boolean(scope.includePatientUnderstanding);

  const packageScope: AssessmentSubmissionScope = {
    ...scope,
    includeForm3: true,
    includeForm2,
    includeFieldReflections,
    includePatientUnderstanding,
    includeInformationCards: false,
    includeEvidenceLinks: false,
    // form3Scope は ...scope 経由で保持（pattern filter は S3）
  };

  if (!scope.includeForm3) {
    corrections.push("includeForm3");
  }
  if (scope.includeInformationCards) {
    corrections.push("includeInformationCards");
    warnings.push({
      code: "information_cards_in_scope_against_policy",
      message:
        "Form3 AI評価ではノートブック横断の情報カードは対象外です（Form3 内 Cards は includeForm3 経由で補助証拠として残ります）。Package 生成時に includeInformationCards を OFF に補正します。",
    });
  }
  if (scope.includeEvidenceLinks) {
    corrections.push("includeEvidenceLinks");
  }
  if (includeForm2) {
    warnings.push({
      code: "form3_form2_opt_in",
      message:
        "Form3 AI評価で様式2が scope ON です（デフォルト外の明示 opt-in）。無条件混入ではなく、教員設定として Package に含めます。",
    });
  }
  if (includePatientUnderstanding) {
    warnings.push({
      code: "form3_patient_understanding_opt_in",
      message:
        "Form3 AI評価で患者理解が scope ON です（デフォルト外の明示 opt-in）。主評価は Form3 Final のままです。",
    });
  }

  const alignedWithRequiredDefaults =
    packageScope.includeForm3 === required.includeForm3 &&
    packageScope.includeForm2 === required.includeForm2 &&
    packageScope.includeFieldReflections === required.includeFieldReflections &&
    packageScope.includePatientUnderstanding ===
      required.includePatientUnderstanding &&
    packageScope.includeInformationCards === required.includeInformationCards &&
    packageScope.includeEvidenceLinks === required.includeEvidenceLinks;

  if (!alignedWithRequiredDefaults || corrections.length > 0) {
    if (
      !scope.includeForm3 ||
      scope.includeInformationCards ||
      scope.includeEvidenceLinks
    ) {
      warnings.push({
        code: "db_scope_policy_mismatch",
        message:
          "DB の submission_scope が様式3 AI評価ポリシー必須 scope と一致しません。Package 生成時に防御的補正を適用します。",
      });
    }
  }

  return {
    packageScope,
    corrected: corrections.length > 0,
    corrections,
    warnings,
  };
}

export function resolveScopeForAiEvaluationPackage(
  milestoneType: string | null | undefined,
  scope: AssessmentSubmissionScope | null | undefined,
): AiEvalScopeCorrectionResult {
  if (!scope) {
    return {
      packageScope: null,
      corrected: false,
      corrections: [],
      warnings: [],
    };
  }

  if (isForm3AiEvalMilestoneType(milestoneType)) {
    return resolveForm3ScopeForAiEvaluationPackage(scope);
  }

  if (milestoneType !== "form2") {
    // final / custom / 未知: 従来どおり DB scope を通し、PU OFF 時のみ従来警告。
    const warnings: AiEvalScopePolicyWarning[] = [];
    if (!scope.includePatientUnderstanding) {
      warnings.push({
        code: "patient_understanding_out_of_scope",
        message:
          "患者理解ルーブリックがある一方、submission_scope で患者理解が対象外です。",
      });
    }
    return {
      packageScope: scope,
      corrected: false,
      corrections: [],
      warnings,
    };
  }

  const required = FORM2_AI_EVAL_REQUIRED_SCOPE;
  const warnings: AiEvalScopePolicyWarning[] = [];
  const corrections: string[] = [];

  if (!scopeFlagEqual(scope, required)) {
    warnings.push({
      code: "db_scope_policy_mismatch",
      message:
        "DB の submission_scope が様式2 AI評価ポリシー必須 scope と一致しません。Package 生成時に防御的補正を適用します。",
    });
  }
  if (scope.includeInformationCards) {
    warnings.push({
      code: "information_cards_in_scope_against_policy",
      message:
        "情報カードを使用しないポリシーなのに、DB scope で情報カードが対象内です。",
    });
  }
  if (!scope.includePatientUnderstanding) {
    warnings.push({
      code: "patient_understanding_out_of_scope",
      message:
        "患者理解を評価するルーブリックがあるのに、DB scope で患者理解が対象外です。",
    });
  }

  const packageScope: AssessmentSubmissionScope = {
    ...scope,
    includeForm2: required.includeForm2,
    includeForm3: required.includeForm3,
    includeInformationCards: required.includeInformationCards,
    includeEvidenceLinks: required.includeEvidenceLinks,
    includeFieldReflections: required.includeFieldReflections,
    includePatientUnderstanding: required.includePatientUnderstanding,
  };

  if (scope.includePatientUnderstanding !== required.includePatientUnderstanding) {
    corrections.push("includePatientUnderstanding");
  }
  if (scope.includeInformationCards !== required.includeInformationCards) {
    corrections.push("includeInformationCards");
  }
  if (scope.includeEvidenceLinks !== required.includeEvidenceLinks) {
    corrections.push("includeEvidenceLinks");
  }
  if (scope.includeForm3 !== required.includeForm3) {
    corrections.push("includeForm3");
  }
  if (scope.includeFieldReflections !== required.includeFieldReflections) {
    corrections.push("includeFieldReflections");
  }
  if (scope.includeForm2 !== required.includeForm2) {
    corrections.push("includeForm2");
  }

  return {
    packageScope,
    corrected: corrections.length > 0,
    corrections,
    warnings,
  };
}

/** visible scope includes と packageScope の整合チェック */
export function warnVisibleScopeMismatch(
  packageScope: AssessmentSubmissionScope | null | undefined,
  visibleIncludes: string[] | null | undefined,
): AiEvalScopePolicyWarning | null {
  if (!packageScope || !visibleIncludes) return null;
  const expected = buildStudentVisibleScopeIncludes(packageScope);
  const a = [...expected].sort().join("|");
  const b = [...visibleIncludes].sort().join("|");
  if (a === b) return null;
  return {
    code: "visible_scope_mismatch",
    message: `student_visible_scope.includes が submission_scope 由来の期待値と一致しません（expected=${expected.join(",")} actual=${visibleIncludes.join(",")}）。`,
  };
}

/**
 * submission_scope（Package 適用後）から student_visible_scope.includes を動的生成する。
 */
export function buildStudentVisibleScopeIncludes(
  scope: AssessmentSubmissionScope | null | undefined,
): string[] {
  const includes: string[] = [
    "症例正本のうち学生公開範囲",
    "Goldが参照する根拠情報のうち学生が収集し得た事実に対応するもの（教員向け比較用。学生FBには使わない）",
  ];
  if (!scope || scope.includeForm2 !== false) {
    includes.push("様式2");
  }
  if (!scope || scope.includeFieldReflections !== false) {
    includes.push("フィールド振り返り");
  }
  if (!scope || scope.includePatientUnderstanding) {
    includes.push("患者理解");
  }
  if (scope?.includeInformationCards) {
    includes.push("情報カード");
  }
  if (scope?.includeForm3) {
    includes.push("様式3（課題scope内）");
  }
  return includes;
}

export function buildStudentVisibleScopeDescription(
  scope: AssessmentSubmissionScope | null | undefined,
): string {
  const isForm2Stage =
    scope &&
    scope.includeForm2 !== false &&
    !scope.includeForm3 &&
    !scope.includeInformationCards;
  if (isForm2Stage) {
    return "提出時点のスナップショットのうち、様式2・フィールド振り返り・患者理解のみを評価に用いる。情報カード・看護計画・援助は評価しない。";
  }
  const isForm3Stage =
    scope &&
    scope.includeForm3 &&
    !scope.includeForm2 &&
    !scope.includeFieldReflections &&
    !scope.includeInformationCards;
  if (isForm3Stage) {
    return "提出時点のスナップショットのうち、様式3（Finalを主評価・Cardsを補助証拠）を評価に用いる。ノートブック横断カード・evidence_links は用いない。";
  }
  return "提出時点のスナップショットのうち、課題scopeに含まれる成果物と理解形成工程のみを評価に用いる。様式2段階では看護計画・援助は評価しない。";
}

export function formatSubmissionScopeJa(
  type: AssessmentMilestoneType,
  scope: AssessmentSubmissionScope,
): string {
  switch (type) {
    case "form2":
      return scope.includePatientUnderstanding
        ? "様式2・患者理解"
        : "様式2";
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
