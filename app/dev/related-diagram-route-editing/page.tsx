import { notFound } from "next/navigation";
import RelatedDiagramRouteEditingDemoWorkspace from "@/components/v2/relatedDiagram/RelatedDiagramRouteEditingDemoWorkspace";

/**
 * DEV ONLY — Route Editing Demo Patient.
 * Daily Manual Route Editing / iPad check. Patient A page is unchanged.
 * Outside /v2 so auth proxy does not require login.
 * Production build → 404.
 */
export const dynamic = "force-dynamic";

export default function RelatedDiagramRouteEditingDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <RelatedDiagramRouteEditingDemoWorkspace />;
}
