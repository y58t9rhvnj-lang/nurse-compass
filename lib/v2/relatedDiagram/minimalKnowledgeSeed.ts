/**
 * Minimal Knowledge Group seed constants for Related Diagram V1 Slice 0.
 * Migration does not insert rows (requires real auth.users). Apply-time runbook
 * or admin tooling should insert using these IDs after migration apply.
 */

export const MINIMAL_RD_KNOWLEDGE_SEED = {
  topicKey: "constipation_pathophysiology_v1",
  version: "2026.1",
  title: "便秘の病態（講義用最小セット）",
  cards: [
    {
      id: "rdkg_card_anticholinergic",
      text: "抗コリン作用",
      x: 80,
      y: 120,
      width: 160,
      height: 72,
      zIndex: 0,
    },
    {
      id: "rdkg_card_motility_down",
      text: "腸管運動抑制",
      x: 320,
      y: 120,
      width: 160,
      height: 72,
      zIndex: 0,
    },
    {
      id: "rdkg_card_hard_stool",
      text: "硬便傾向",
      x: 560,
      y: 120,
      width: 160,
      height: 72,
      zIndex: 0,
    },
  ],
  connections: [
    {
      id: "rdkg_conn_1",
      sourceCardId: "rdkg_card_anticholinergic",
      targetCardId: "rdkg_card_motility_down",
      relationType: "current" as const,
    },
    {
      id: "rdkg_conn_2",
      sourceCardId: "rdkg_card_motility_down",
      targetCardId: "rdkg_card_hard_stool",
      relationType: "current" as const,
    },
  ],
} as const;
