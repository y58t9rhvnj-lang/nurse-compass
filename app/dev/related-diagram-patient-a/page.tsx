import { notFound } from "next/navigation";
import RelatedDiagramPatientADevWorkspace from "@/components/v2/relatedDiagram/RelatedDiagramPatientADevWorkspace";

/**
 * DEV ONLY — Patient A student-diagram reconstruction.
 * READ ONLY SNAPSHOT. DO NOT WRITE BACK.
 * Outside /v2 so auth proxy does not require login.
 * Production build → 404. Does not touch Form3 or related_diagram_records.
 */
export const dynamic = "force-dynamic";

export default function RelatedDiagramPatientADevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <RelatedDiagramPatientADevWorkspace />;
}
