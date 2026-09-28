export type Form3AssessmentDialogDraft = {
  evidenceInformationIds: string[];
  interpretation: string;
};

function sameIdSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((id) => other.has(id));
}

/** 入力が initial から変わっていれば true。保存済み本文との比較であり trim しない。 */
export function form3AssessmentDialogHasChanges(
  current: Form3AssessmentDialogDraft,
  initial?: Partial<Form3AssessmentDialogDraft> | null,
): boolean {
  const initialIds = initial?.evidenceInformationIds ?? [];
  const initialText = initial?.interpretation ?? "";
  return (
    current.interpretation !== initialText ||
    !sameIdSet(current.evidenceInformationIds, initialIds)
  );
}
