import "server-only";

/**
 * Related Diagram Knowledge Library read path (Slice 1).
 * binding → published group (version match) → cards / connections.
 * Never inserts/seeds production Knowledge.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KnowledgeCardRow,
  KnowledgeConnectionRow,
} from "./knowledgeLibraryMapping";

export type KnowledgeBindingRow = {
  id: string;
  organization_id: string;
  case_id: string;
  assessment_cycle_id: string | null;
  knowledge_group_id: string;
  knowledge_version: string;
};

export type KnowledgeGroupRow = {
  id: string;
  organization_id: string;
  title: string;
  topic_key: string;
  version: string;
  status: string;
};

export type { KnowledgeCardRow, KnowledgeConnectionRow };

export async function getCaseKnowledgeBinding(
  supabase: SupabaseClient,
  organizationId: string,
  caseId: string,
  assessmentCycleId?: string | null,
): Promise<{ row: KnowledgeBindingRow | null; error: { message?: string } | null }> {
  let q = supabase
    .from("related_diagram_knowledge_bindings")
    .select(
      "id, organization_id, case_id, assessment_cycle_id, knowledge_group_id, knowledge_version",
    )
    .eq("organization_id", organizationId)
    .eq("case_id", caseId);

  if (assessmentCycleId) {
    q = q.eq("assessment_cycle_id", assessmentCycleId);
  } else {
    q = q.is("assessment_cycle_id", null);
  }

  const { data, error } = await q.maybeSingle();
  return {
    row: (data as KnowledgeBindingRow | null) ?? null,
    error: error as { message?: string } | null,
  };
}

export async function getPublishedKnowledgeGroup(
  supabase: SupabaseClient,
  groupId: string,
  expectedVersion: string,
): Promise<{ row: KnowledgeGroupRow | null; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("related_diagram_knowledge_groups")
    .select("id, organization_id, title, topic_key, version, status")
    .eq("id", groupId)
    .eq("status", "published")
    .eq("version", expectedVersion)
    .maybeSingle();
  return {
    row: (data as KnowledgeGroupRow | null) ?? null,
    error: error as { message?: string } | null,
  };
}

export async function listKnowledgeCards(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{ rows: KnowledgeCardRow[]; error: { message?: string } | null }> {
  const { data, error } = await supabase
    .from("related_diagram_knowledge_cards")
    .select("id, knowledge_group_id, text, x, y, width, height, z_index")
    .eq("knowledge_group_id", groupId);
  return {
    rows: (data as KnowledgeCardRow[] | null) ?? [],
    error: error as { message?: string } | null,
  };
}

export async function listKnowledgeConnections(
  supabase: SupabaseClient,
  groupId: string,
): Promise<{
  rows: KnowledgeConnectionRow[];
  error: { message?: string } | null;
}> {
  const { data, error } = await supabase
    .from("related_diagram_knowledge_connections")
    .select(
      "id, knowledge_group_id, source_knowledge_card_id, target_knowledge_card_id, relation_type",
    )
    .eq("knowledge_group_id", groupId);
  return {
    rows: (data as KnowledgeConnectionRow[] | null) ?? [],
    error: error as { message?: string } | null,
  };
}
