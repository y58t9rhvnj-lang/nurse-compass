"use server";

/**
 * Slice 1: load readonly Related Diagram scene for the current student.
 * No development fixture fallback. No style-demo merge.
 */

import { requireRole } from "@/lib/v2/auth/currentUser";
import { createServerSupabaseClient } from "@/lib/v2/supabase/serverClient";
import { caseIdForPatient } from "@/lib/v2/notebook/caseId";
import {
  getCaseKnowledgeBinding,
  getPublishedKnowledgeGroup,
  listKnowledgeCards,
  listKnowledgeConnections,
} from "@/lib/v2/relatedDiagram/knowledgeLibraryRepository";
import { knowledgeRowsToSemanticGraph } from "@/lib/v2/relatedDiagram/knowledgeLibraryMapping";
import {
  resolveReadonlySceneFromKnowledgeBinding,
  type RelatedDiagramReadonlyScene,
} from "@/lib/v2/relatedDiagram/resolveReadonlyScene";

export type LoadRelatedDiagramReadonlySceneResult =
  | { ok: true; status: "ready"; scene: RelatedDiagramReadonlyScene }
  | {
      ok: true;
      status: "empty";
      message: string;
    }
  | {
      ok: false;
      kind: "unauthorized" | "validation" | "load_error";
      message: string;
    };

const EMPTY_MESSAGE = "この事例には病態関連図が設定されていません。";

export async function loadRelatedDiagramReadonlySceneAction(
  patientId: string,
): Promise<LoadRelatedDiagramReadonlySceneResult> {
  let profile;
  try {
    profile = await requireRole("student");
  } catch {
    return { ok: false, kind: "unauthorized", message: "student required" };
  }

  const caseId = caseIdForPatient(patientId);
  if (!caseId) {
    return { ok: false, kind: "validation", message: "unknown patient" };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { row: binding, error: bindErr } = await getCaseKnowledgeBinding(
      supabase,
      profile.organizationId,
      caseId,
      null,
    );
    if (bindErr) {
      return {
        ok: false,
        kind: "load_error",
        message: bindErr.message ?? "failed to load knowledge binding",
      };
    }
    if (!binding) {
      return { ok: true, status: "empty", message: EMPTY_MESSAGE };
    }

    const { row: group, error: groupErr } = await getPublishedKnowledgeGroup(
      supabase,
      binding.knowledge_group_id,
      binding.knowledge_version,
    );
    if (groupErr) {
      return {
        ok: false,
        kind: "load_error",
        message: groupErr.message ?? "failed to load knowledge group",
      };
    }
    if (!group) {
      // Binding points to missing / unpublished / version-mismatched group.
      return { ok: true, status: "empty", message: EMPTY_MESSAGE };
    }

    const { rows: cards, error: cardErr } = await listKnowledgeCards(
      supabase,
      group.id,
    );
    if (cardErr) {
      return {
        ok: false,
        kind: "load_error",
        message: cardErr.message ?? "failed to load knowledge cards",
      };
    }
    const { rows: conns, error: connErr } = await listKnowledgeConnections(
      supabase,
      group.id,
    );
    if (connErr) {
      return {
        ok: false,
        kind: "load_error",
        message: connErr.message ?? "failed to load knowledge connections",
      };
    }

    const foundation = knowledgeRowsToSemanticGraph({
      cards,
      connections: conns,
      knowledgeVersion: group.version,
    });

    return {
      ok: true,
      status: "ready",
      scene: resolveReadonlySceneFromKnowledgeBinding({
        foundation,
        knowledgeTitle: group.title,
        knowledgeVersion: group.version,
      }),
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "failed to load related diagram";
    return { ok: false, kind: "load_error", message };
  }
}
