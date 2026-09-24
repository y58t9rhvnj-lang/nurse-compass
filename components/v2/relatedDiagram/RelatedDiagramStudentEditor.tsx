import RelatedDiagramDevFixtureWorkspace from "./RelatedDiagramDevFixtureWorkspace";
import type { RelatedDiagramForm3ReadModel } from "@/lib/v2/relatedDiagram/form3AssessmentReadModel";

/**
 * Production Student Editor.
 * Form3 drawer sources come from the server-loaded student record.
 */
export default function RelatedDiagramStudentEditor({
  form3Model,
}: {
  form3Model: RelatedDiagramForm3ReadModel;
}) {
  return <RelatedDiagramDevFixtureWorkspace form3Model={form3Model} />;
}
