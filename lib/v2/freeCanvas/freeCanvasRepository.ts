import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createEmptySemanticGraph } from "@/lib/v2/relatedDiagram/semanticGraph";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import type { FreeCanvasListItem, FreeCanvasRecord } from "./freeCanvasTypes";

const FREE_CANVAS_COLUMNS =
  "id, user_id, organization_id, academic_year, title, semantic_graph, route_scene, version, created_at, updated_at";

type PgLikeError = { message?: string; code?: string } | null;

type FreeCanvasRow = {
  id: string;
  user_id: string;
  organization_id: string;
  academic_year: number;
  title: string;
  semantic_graph: RelatedDiagramSemanticGraph;
  route_scene: unknown | null;
  version: number;
  created_at: string;
  updated_at: string;
};

function mapRecord(row: FreeCanvasRow): FreeCanvasRecord {
  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    academicYear: row.academic_year,
    title: row.title,
    semanticGraph: row.semantic_graph,
    routeScene: row.route_scene,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapListItem(row: FreeCanvasRow): FreeCanvasListItem {
  return {
    id: row.id,
    title: row.title,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listOwnFreeCanvases(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ rows: FreeCanvasListItem[]; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("free_canvas_records")
    .select(FREE_CANVAS_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  return {
    rows: ((data as FreeCanvasRow[] | null) ?? []).map(mapListItem),
    error: error as PgLikeError,
  };
}

export async function getOwnFreeCanvas(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ row: FreeCanvasRecord | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("free_canvas_records")
    .select(FREE_CANVAS_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return {
    row: data ? mapRecord(data as FreeCanvasRow) : null,
    error: error as PgLikeError,
  };
}

export async function insertFreeCanvas(
  supabase: SupabaseClient,
  values: {
    userId: string;
    organizationId: string;
    academicYear: number;
    title: string;
  },
): Promise<{ row: FreeCanvasRecord | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("free_canvas_records")
    .insert({
      user_id: values.userId,
      organization_id: values.organizationId,
      academic_year: values.academicYear,
      title: values.title,
      semantic_graph: createEmptySemanticGraph(),
      route_scene: null,
      version: 1,
    })
    .select(FREE_CANVAS_COLUMNS)
    .maybeSingle();
  return {
    row: data ? mapRecord(data as FreeCanvasRow) : null,
    error: error as PgLikeError,
  };
}

export async function updateFreeCanvasTitle(
  supabase: SupabaseClient,
  values: { userId: string; id: string; title: string },
): Promise<{ row: FreeCanvasRecord | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("free_canvas_records")
    .update({ title: values.title })
    .eq("user_id", values.userId)
    .eq("id", values.id)
    .select(FREE_CANVAS_COLUMNS)
    .maybeSingle();
  return {
    row: data ? mapRecord(data as FreeCanvasRow) : null,
    error: error as PgLikeError,
  };
}

export async function deleteOwnFreeCanvas(
  supabase: SupabaseClient,
  values: {
    userId: string;
    organizationId: string;
    academicYear: number;
    id: string;
  },
): Promise<{ deleted: boolean; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("free_canvas_records")
    .delete()
    .eq("user_id", values.userId)
    .eq("organization_id", values.organizationId)
    .eq("academic_year", values.academicYear)
    .eq("id", values.id)
    .select("id")
    .maybeSingle();
  return {
    deleted: Boolean(data),
    error: error as PgLikeError,
  };
}

export async function updateFreeCanvasWithVersion(
  supabase: SupabaseClient,
  values: {
    userId: string;
    id: string;
    expectedVersion: number;
    semanticGraph: RelatedDiagramSemanticGraph;
    routeScene: unknown;
  },
): Promise<{ row: FreeCanvasRecord | null; error: PgLikeError }> {
  const { data, error } = await supabase
    .from("free_canvas_records")
    .update({
      semantic_graph: values.semanticGraph,
      route_scene: values.routeScene,
      version: values.expectedVersion + 1,
    })
    .eq("user_id", values.userId)
    .eq("id", values.id)
    .eq("version", values.expectedVersion)
    .select(FREE_CANVAS_COLUMNS)
    .maybeSingle();
  return {
    row: data ? mapRecord(data as FreeCanvasRow) : null,
    error: error as PgLikeError,
  };
}
