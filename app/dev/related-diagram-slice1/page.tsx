import { notFound } from "next/navigation";
import RelatedDiagramDevFixtureWorkspace from "@/components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace";

/**
 * DEV-only Slice 1 iPad / LAN verification page.
 * - Outside /v2 so auth proxy does not require login.
 * - Unavailable when NODE_ENV !== "development" (production build → 404).
 * - Does not touch Student runtime, bindings, or DB.
 */
export const dynamic = "force-dynamic";

export default function RelatedDiagramSlice1DevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <RelatedDiagramDevFixtureWorkspace />;
}
