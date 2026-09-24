import { notFound } from "next/navigation";
import RelatedDiagramKnowledgePreviewWorkspace from "@/components/v2/relatedDiagram/RelatedDiagramKnowledgePreviewWorkspace";

/**
 * DEV-only preview of the initial pathophysiology Knowledge scene.
 * No persist. No DB. Outside /v2. Production build → 404.
 */
export const dynamic = "force-dynamic";

export default function RelatedDiagramKnowledgePreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <RelatedDiagramKnowledgePreviewWorkspace />;
}
