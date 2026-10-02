"use server";

import { getCurrentProfile, type AppProfile } from "@/lib/v2/auth/currentUser";
import {
  canManageFreeCanvas,
  defaultFreeCanvasTitle,
  validateFreeCanvasTitle,
} from "@/lib/v2/freeCanvas/freeCanvasPolicy";
import {
  deleteOwnFreeCanvas,
  getOwnFreeCanvas,
  insertFreeCanvas,
  listOwnFreeCanvases,
  updateFreeCanvasTitle,
  updateFreeCanvasWithVersion,
} from "@/lib/v2/freeCanvas/freeCanvasRepository";
import type {
  FreeCanvasActionFailure,
  FreeCanvasListItem,
  FreeCanvasRecord,
} from "@/lib/v2/freeCanvas/freeCanvasTypes";
import { isSupabaseConfigured } from "@/lib/v2/env";
import { classifyDbError } from "@/lib/v2/notebook/types";
import { serializeRouteScene } from "@/lib/v2/relatedDiagram/routeScene";
import type { RelatedDiagramSemanticGraph } from "@/lib/v2/relatedDiagram/types";
import type { StableRouteState } from "@/lib/v2/relatedDiagram/incrementalRoutes";
import type { RelatedDiagramRouteTopology } from "@/lib/v2/relatedDiagram/routeTopology";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import type { SupabaseClient } from "@supabase/supabase-js";

type ActorContext =
  | { ok: true; supabase: SupabaseClient; profile: AppProfile }
  | FreeCanvasActionFailure;

async function requireStudent(): Promise<ActorContext> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      kind: "not_configured",
      message: "認証基盤が未設定です。",
    };
  }
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !profile.isActive ||
    !canManageFreeCanvas(profile.role, profile.isActive)
  ) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "学生としてログインしてください。",
    };
  }
  if (!profile.organizationId || !Number.isInteger(profile.academicYear)) {
    return {
      ok: false,
      kind: "unauthorized",
      message: "プロフィールが不完全です。",
    };
  }
  const supabase = await createServerSupabaseClient();
  return { ok: true, supabase, profile };
}

function mapDbError(error: { code?: string; message?: string } | null): FreeCanvasActionFailure {
  const kind = classifyDbError(error);
  if (kind === "unauthorized") {
    return { ok: false, kind: "unauthorized", message: "保存できませんでした。" };
  }
  if (kind === "validation") {
    return { ok: false, kind: "validation", message: "入力内容を確認してください。" };
  }
  return { ok: false, kind: "db_error", message: "キャンバスを保存できませんでした。" };
}

export async function listFreeCanvasesAction(): Promise<
  { ok: true; items: FreeCanvasListItem[] } | FreeCanvasActionFailure
> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  const listed = await listOwnFreeCanvases(ctx.supabase, ctx.profile.id);
  if (listed.error) return mapDbError(listed.error);
  return { ok: true, items: listed.rows };
}

export async function createFreeCanvasAction(input?: {
  title?: string;
}): Promise<{ ok: true; canvas: FreeCanvasRecord } | FreeCanvasActionFailure> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  const titleRes = validateFreeCanvasTitle(
    input?.title && input.title.trim() !== ""
      ? input.title
      : defaultFreeCanvasTitle(),
  );
  if (!titleRes.ok) {
    return { ok: false, kind: "validation", message: titleRes.message };
  }
  const inserted = await insertFreeCanvas(ctx.supabase, {
    userId: ctx.profile.id,
    organizationId: ctx.profile.organizationId,
    academicYear: ctx.profile.academicYear,
    title: titleRes.title,
  });
  if (inserted.error || !inserted.row) return mapDbError(inserted.error);
  return { ok: true, canvas: inserted.row };
}

export async function getFreeCanvasAction(input: {
  id: string;
}): Promise<{ ok: true; canvas: FreeCanvasRecord } | FreeCanvasActionFailure> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  if (!input.id) {
    return { ok: false, kind: "validation", message: "キャンバスが見つかりません。" };
  }
  const got = await getOwnFreeCanvas(ctx.supabase, ctx.profile.id, input.id);
  if (got.error) return mapDbError(got.error);
  if (!got.row) {
    return { ok: false, kind: "not_found", message: "キャンバスが見つかりません。" };
  }
  return { ok: true, canvas: got.row };
}

export async function renameFreeCanvasAction(input: {
  id: string;
  title: string;
}): Promise<{ ok: true; canvas: FreeCanvasRecord } | FreeCanvasActionFailure> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  const titleRes = validateFreeCanvasTitle(input.title);
  if (!titleRes.ok) {
    return { ok: false, kind: "validation", message: titleRes.message };
  }
  const updated = await updateFreeCanvasTitle(ctx.supabase, {
    userId: ctx.profile.id,
    id: input.id,
    title: titleRes.title,
  });
  if (updated.error) return mapDbError(updated.error);
  if (!updated.row) {
    return { ok: false, kind: "not_found", message: "キャンバスが見つかりません。" };
  }
  return { ok: true, canvas: updated.row };
}

export async function saveFreeCanvasAction(input: {
  id: string;
  expectedVersion: number;
  semanticGraph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
}): Promise<{ ok: true; canvas: FreeCanvasRecord } | FreeCanvasActionFailure> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    return { ok: false, kind: "validation", message: "保存に失敗しました。" };
  }
  const routeScene = serializeRouteScene({
    graph: input.semanticGraph,
    routeState: input.routeState,
    topology: input.topology,
  });
  const updated = await updateFreeCanvasWithVersion(ctx.supabase, {
    userId: ctx.profile.id,
    id: input.id,
    expectedVersion: input.expectedVersion,
    semanticGraph: input.semanticGraph,
    routeScene,
  });
  if (updated.error) return mapDbError(updated.error);
  if (!updated.row) {
    return {
      ok: false,
      kind: "conflict",
      message: "他の場所で更新されています。",
    };
  }
  return { ok: true, canvas: updated.row };
}

export async function deleteFreeCanvasAction(input: {
  id: string;
}): Promise<{ ok: true } | FreeCanvasActionFailure> {
  const ctx = await requireStudent();
  if (!ctx.ok) return ctx;
  if (!input.id) {
    return { ok: false, kind: "validation", message: "キャンバスが見つかりません。" };
  }
  const removed = await deleteOwnFreeCanvas(ctx.supabase, {
    userId: ctx.profile.id,
    organizationId: ctx.profile.organizationId,
    academicYear: ctx.profile.academicYear,
    id: input.id,
  });
  if (removed.error) {
    const kind = classifyDbError(removed.error);
    if (kind === "unauthorized") {
      return { ok: false, kind: "unauthorized", message: "削除できませんでした。" };
    }
    return { ok: false, kind: "db_error", message: "キャンバスを削除できませんでした。" };
  }
  if (!removed.deleted) {
    return { ok: false, kind: "not_found", message: "キャンバスが見つかりません。" };
  }
  return { ok: true };
}
