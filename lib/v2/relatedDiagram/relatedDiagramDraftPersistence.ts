/**
 * Persistence P3 — Student Editor draft load/save.
 * Workspace/controller only. Does not live in gesture or routing hooks.
 */

import { emptyDiagramHistory, type DiagramHistory } from "./diagramHistory";
import {
  seedInitialAutoRouteState,
  type StableRouteState,
} from "./incrementalRoutes";
import {
  restoreRouteScene,
  serializeRouteScene,
  type RouteSceneDiagnostics,
} from "./routeScene";
import type { RelatedDiagramRouteTopology } from "./routeTopology";
import type {
  RelatedDiagramInsertValues,
  RelatedDiagramRow,
  RelatedDiagramUpdateParams,
} from "./relatedDiagramRecord";
import type { RelatedDiagramSemanticGraph } from "./types";

export const DEV_SLICE1_PERSIST_IDENTITY = {
  userId: "dev-related-diagram",
  organizationId: "dev-org",
  academicYear: 2026,
  caseId: "dev-related-diagram-slice1",
} as const;

export type RelatedDiagramDraftStoreError = {
  code?: string;
  message?: string;
};

export type RelatedDiagramDraftStoreResult = {
  row: RelatedDiagramRow | null;
  error: RelatedDiagramDraftStoreError | null;
};

export type RelatedDiagramDraftStore = {
  get(
    userId: string,
    caseId: string,
  ): Promise<RelatedDiagramDraftStoreResult>;
  insert(
    values: RelatedDiagramInsertValues,
  ): Promise<RelatedDiagramDraftStoreResult>;
  update(
    params: RelatedDiagramUpdateParams,
  ): Promise<RelatedDiagramDraftStoreResult>;
};

export type PersistIdentity = {
  userId: string;
  organizationId: string;
  academicYear: number;
  caseId: string;
};

export type EditorPersistSnapshot = {
  graph: RelatedDiagramSemanticGraph;
  routeState: StableRouteState;
  topology?: RelatedDiagramRouteTopology;
};

export type PersistStatus =
  | "unsaved"
  | "saving"
  | "saved"
  | "conflict"
  | "error"
  | "unsupported";

export type LoadRelatedDiagramDraftResult =
  | {
      ok: true;
      kind: "empty";
      source: "seed";
      graph: RelatedDiagramSemanticGraph;
      routeState: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
      version: null;
      recordId: null;
      persistStatus: "unsaved";
      history: DiagramHistory;
    }
  | {
      ok: true;
      kind: "geometry_missing";
      source: "record";
      graph: RelatedDiagramSemanticGraph;
      routeState: StableRouteState;
      topology?: RelatedDiagramRouteTopology;
      version: number;
      recordId: string;
      persistStatus: "unsaved";
      history: DiagramHistory;
    }
  | {
      ok: true;
      kind: "restored";
      source: "record";
      graph: RelatedDiagramSemanticGraph;
      routeState: StableRouteState;
      topology: RelatedDiagramRouteTopology;
      version: number;
      recordId: string;
      persistStatus: "saved";
      history: DiagramHistory;
      diagnostics: RouteSceneDiagnostics;
    }
  | {
      ok: false;
      kind: "load_error";
      message: string;
      code?: string;
    }
  | {
      ok: false;
      kind: "unsupported_schema";
      message: string;
      graph: RelatedDiagramSemanticGraph;
      version: number;
      recordId: string;
      routeScene: unknown;
    };

export type SaveRelatedDiagramDraftResult =
  | {
      ok: true;
      version: number;
      recordId: string;
      persistStatus: "saved";
    }
  | {
      ok: false;
      kind: "conflict" | "error" | "unsupported_schema";
      persistStatus: "conflict" | "error" | "unsupported";
      message: string;
    };

export function emptyPersistHistory(): DiagramHistory {
  return emptyDiagramHistory();
}

export async function loadRelatedDiagramDraft(input: {
  store: RelatedDiagramDraftStore;
  identity: PersistIdentity;
  seed: EditorPersistSnapshot;
}): Promise<LoadRelatedDiagramDraftResult> {
  const got = await input.store.get(input.identity.userId, input.identity.caseId);
  if (got.error) {
    return {
      ok: false,
      kind: "load_error",
      message: got.error.message ?? "load failed",
      code: got.error.code,
    };
  }
  if (!got.row) {
    return {
      ok: true,
      kind: "empty",
      source: "seed",
      graph: input.seed.graph,
      routeState: input.seed.routeState,
      topology: input.seed.topology,
      version: null,
      recordId: null,
      persistStatus: "unsaved",
      history: emptyPersistHistory(),
    };
  }

  const graph = got.row.semantic_graph;
  if (got.row.route_scene == null) {
    return {
      ok: true,
      kind: "geometry_missing",
      source: "record",
      graph,
      routeState: seedInitialAutoRouteState(graph.cards, graph.connections),
      topology: undefined,
      version: got.row.version,
      recordId: got.row.id,
      persistStatus: "unsaved",
      history: emptyPersistHistory(),
    };
  }

  const restored = restoreRouteScene({
    graph,
    routeScene: got.row.route_scene,
  });
  if (!restored.supported) {
    return {
      ok: false,
      kind: "unsupported_schema",
      message: "unsupported route_scene schema",
      graph,
      version: got.row.version,
      recordId: got.row.id,
      routeScene: got.row.route_scene,
    };
  }

  return {
    ok: true,
    kind: "restored",
    source: "record",
    graph,
    routeState: restored.routeState,
    topology: restored.topology,
    version: got.row.version,
    recordId: got.row.id,
    persistStatus: "saved",
    history: emptyPersistHistory(),
    diagnostics: restored.diagnostics,
  };
}

export async function saveRelatedDiagramDraft(input: {
  store: RelatedDiagramDraftStore;
  identity: PersistIdentity;
  expectedVersion: number | null;
  snapshot: EditorPersistSnapshot;
  allowRouteSceneWrite?: boolean;
}): Promise<SaveRelatedDiagramDraftResult> {
  if (input.allowRouteSceneWrite === false) {
    return {
      ok: false,
      kind: "unsupported_schema",
      persistStatus: "unsupported",
      message: "route_scene write blocked",
    };
  }

  const routeScene = serializeRouteScene({
    graph: input.snapshot.graph,
    routeState: input.snapshot.routeState,
    topology: input.snapshot.topology,
  });

  if (input.expectedVersion == null) {
    const inserted = await input.store.insert({
      user_id: input.identity.userId,
      organization_id: input.identity.organizationId,
      academic_year: input.identity.academicYear,
      case_id: input.identity.caseId,
      semantic_graph: input.snapshot.graph,
      route_scene: routeScene,
    });
    if (inserted.error || !inserted.row) {
      return {
        ok: false,
        kind: "error",
        persistStatus: "error",
        message: inserted.error?.message ?? "insert failed",
      };
    }
    return {
      ok: true,
      version: inserted.row.version,
      recordId: inserted.row.id,
      persistStatus: "saved",
    };
  }

  const updated = await input.store.update({
    userId: input.identity.userId,
    caseId: input.identity.caseId,
    expectedVersion: input.expectedVersion,
    semanticGraph: input.snapshot.graph,
    routeScene,
  });
  if (updated.error) {
    return {
      ok: false,
      kind: "error",
      persistStatus: "error",
      message: updated.error.message ?? "update failed",
    };
  }
  if (!updated.row) {
    return {
      ok: false,
      kind: "conflict",
      persistStatus: "conflict",
      message: "他の場所で更新されています",
    };
  }
  return {
    ok: true,
    version: updated.row.version,
    recordId: updated.row.id,
    persistStatus: "saved",
  };
}

export function persistStatusLabel(status: PersistStatus): string {
  if (status === "saving") return "保存中…";
  if (status === "saved") return "保存済み";
  if (status === "conflict") return "他の場所で更新されています";
  if (status === "error") return "保存できませんでした";
  if (status === "unsupported") return "保存形式を更新できません";
  return "未保存";
}
