import type { AssessmentSubmissionScope } from "@/lib/v2/assessment/types";
import {
  isForm3AiEvalMilestone,
  resolveAiEvalCompassPolicyVersion,
  type AiEvalCompassPolicyVersion,
} from "@/lib/v2/assessment/aiEvaluationVersions";
import {
  buildAiEvaluationCompassPolicy,
  buildAiEvaluationInstructions,
  buildAiEvaluationOutputSchemaHint,
  buildAiEvaluationRubricBlock,
} from "@/lib/v2/assessment/aiEvaluationPackageStaticContent";
import {
  buildForm3AiEvaluationCompassPolicy,
  buildForm3AiEvaluationInstructions,
  buildForm3AiEvaluationOutputSchemaHint,
  buildForm3AiEvaluationRubricBlock,
  type Form3AiEvalMilestoneType,
} from "@/lib/v2/assessment/aiEvaluationPackageStaticContentForm3";

export type ResolvedAiEvaluationStaticContent = {
  milestoneType: string | null;
  compassPolicyVersion: AiEvalCompassPolicyVersion;
  policyFamily: "form2" | "form3";
  compass_policy: Record<string, unknown>;
  rubric: Record<string, unknown>;
  evaluation_instructions: Record<string, unknown>;
  output_schema_hint: Record<string, unknown>;
};

function asForm3Milestone(
  milestoneType: string,
): Form3AiEvalMilestoneType {
  return milestoneType === "form3_complete"
    ? "form3_complete"
    : "form3_progress";
}

function selectedPatternIdsFromScope(
  packageScope: AssessmentSubmissionScope | null | undefined,
): string[] | null {
  if (packageScope?.form3Scope?.mode !== "selected_patterns") return null;
  return [...packageScope.form3Scope.patternIds];
}

/**
 * Package Builder / Export 共通の StaticContent 解決点。
 * form3_progress / form3_complete → Form3 + 2026.5
 * それ以外 → Form2 + 2026.4（既存と同一）
 *
 * packageScope は Form3 selected_patterns の限定評価指示（W2）にのみ使用。
 */
export function resolveAiEvaluationStaticContent(
  milestoneType: string | null | undefined,
  packageScope?: AssessmentSubmissionScope | null,
): ResolvedAiEvaluationStaticContent {
  const normalized =
    typeof milestoneType === "string" && milestoneType.trim()
      ? milestoneType.trim()
      : null;
  const compassPolicyVersion = resolveAiEvalCompassPolicyVersion(normalized);

  if (isForm3AiEvalMilestone(normalized)) {
    const form3Type = asForm3Milestone(normalized!);
    return {
      milestoneType: normalized,
      compassPolicyVersion,
      policyFamily: "form3",
      compass_policy: buildForm3AiEvaluationCompassPolicy(),
      rubric: buildForm3AiEvaluationRubricBlock(),
      evaluation_instructions: buildForm3AiEvaluationInstructions(form3Type, {
        selectedPatternIds: selectedPatternIdsFromScope(packageScope),
      }),
      output_schema_hint: buildForm3AiEvaluationOutputSchemaHint(),
    };
  }

  return {
    milestoneType: normalized,
    compassPolicyVersion,
    policyFamily: "form2",
    compass_policy: buildAiEvaluationCompassPolicy(),
    rubric: buildAiEvaluationRubricBlock(),
    evaluation_instructions: buildAiEvaluationInstructions(),
    output_schema_hint: buildAiEvaluationOutputSchemaHint(),
  };
}
