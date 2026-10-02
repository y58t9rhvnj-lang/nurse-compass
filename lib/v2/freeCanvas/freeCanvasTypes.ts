import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";

export const FREE_CANVAS_DEFAULT_TITLE = "無題のキャンバス";
export const FREE_CANVAS_TITLE_MAX = 80;

export type FreeCanvasListItem = {
  id: string;
  title: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type FreeCanvasRecord = FreeCanvasListItem & {
  userId: string;
  organizationId: string;
  academicYear: number;
  semanticGraph: RelatedDiagramSemanticGraph;
  routeScene: unknown | null;
};

export type FreeCanvasActionFailure = {
  ok: false;
  kind: "unauthorized" | "not_found" | "validation" | "conflict" | "db_error" | "not_configured";
  message: string;
};
