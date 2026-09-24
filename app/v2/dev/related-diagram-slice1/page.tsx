import { notFound } from "next/navigation";
import { requireRole } from "@/lib/v2/auth/currentUser";
import RelatedDiagramDevFixtureWorkspace from "@/components/v2/relatedDiagram/RelatedDiagramDevFixtureWorkspace";

/**
 * DEV-only authenticated Student Editor entry.
 * - Inside /v2 so proxy refreshes the session and unauthenticated requests
 *   go to /v2/login.
 * - Student-only via the same requireRole("student") as /v2/student.
 * - Unavailable when NODE_ENV !== "development" (production build → 404).
 * - Reuses RelatedDiagramDevFixtureWorkspace. Does not copy the editor.
 * - Does not change /dev/related-diagram-slice1, Production readonly, or LoginForm.
 */
export const dynamic = "force-dynamic";

export default async function RelatedDiagramSlice1AuthenticatedDevPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  await requireRole("student");
  return <RelatedDiagramDevFixtureWorkspace />;
}
