/**
 * Sprint 5D — AI evaluation batch manifest（Export / Import 必須）
 */

export const AI_EVAL_BATCH_MANIFEST_SCHEMA_VERSION = 1 as const;

export type AiEvalBatchManifestKind =
  | "ai_evaluation_export_batch"
  | "ai_evaluation_import_batch";

export type AiEvalBatchManifestMember = {
  evaluation_request_id: string;
  path: string;
};

export type AiEvalBatchManifest = {
  manifest_schema_version: typeof AI_EVAL_BATCH_MANIFEST_SCHEMA_VERSION;
  kind: AiEvalBatchManifestKind;
  batch_id: string;
  generated_at: string;
  generated_by_role: "teacher" | "admin";
  locale: "ja-JP";
  counts: { members: number };
  members: AiEvalBatchManifestMember[];
};

export type ManifestIntegrityIssue = {
  code:
    | "missing_manifest"
    | "invalid_manifest"
    | "kind_mismatch"
    | "missing_file"
    | "extra_file"
    | "path_mismatch"
    | "duplicate_request_id"
    | "empty_members";
  message: string;
  evaluationRequestId?: string;
  path?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function parseAiEvalBatchManifest(
  raw: unknown,
):
  | { ok: true; manifest: AiEvalBatchManifest }
  | { ok: false; issues: ManifestIntegrityIssue[] } {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      issues: [
        {
          code: "invalid_manifest",
          message: "manifest.json がオブジェクトではありません。",
        },
      ],
    };
  }
  const issues: ManifestIntegrityIssue[] = [];
  if (raw.manifest_schema_version !== AI_EVAL_BATCH_MANIFEST_SCHEMA_VERSION) {
    issues.push({
      code: "invalid_manifest",
      message: `manifest_schema_version は ${AI_EVAL_BATCH_MANIFEST_SCHEMA_VERSION} である必要があります。`,
    });
  }
  if (
    raw.kind !== "ai_evaluation_export_batch" &&
    raw.kind !== "ai_evaluation_import_batch"
  ) {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.kind が不正です。",
    });
  }
  if (typeof raw.batch_id !== "string" || !raw.batch_id.trim()) {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.batch_id が必要です。",
    });
  }
  if (typeof raw.generated_at !== "string") {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.generated_at が必要です。",
    });
  }
  if (raw.generated_by_role !== "teacher" && raw.generated_by_role !== "admin") {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.generated_by_role が不正です。",
    });
  }
  if (raw.locale !== "ja-JP") {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.locale は ja-JP である必要があります。",
    });
  }
  if (!Array.isArray(raw.members)) {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.members が配列ではありません。",
    });
    return { ok: false, issues };
  }
  if (raw.members.length === 0) {
    issues.push({
      code: "empty_members",
      message: "manifest.members が空です。",
    });
  }

  const members: AiEvalBatchManifestMember[] = [];
  const seenIds = new Set<string>();
  for (const m of raw.members) {
    if (!isPlainObject(m)) {
      issues.push({
        code: "invalid_manifest",
        message: "manifest.members の要素が不正です。",
      });
      continue;
    }
    const id = m.evaluation_request_id;
    const path = m.path;
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      issues.push({
        code: "invalid_manifest",
        message: "evaluation_request_id が UUID ではありません。",
        evaluationRequestId: typeof id === "string" ? id : undefined,
      });
      continue;
    }
    if (seenIds.has(id)) {
      issues.push({
        code: "duplicate_request_id",
        message: "evaluation_request_id が重複しています。",
        evaluationRequestId: id,
      });
      continue;
    }
    seenIds.add(id);
    if (typeof path !== "string" || !path.trim()) {
      issues.push({
        code: "invalid_manifest",
        message: "member.path が必要です。",
        evaluationRequestId: id,
      });
      continue;
    }
    members.push({ evaluation_request_id: id, path });
  }

  const countsMembers =
    isPlainObject(raw.counts) && typeof raw.counts.members === "number"
      ? raw.counts.members
      : members.length;
  if (countsMembers !== members.length) {
    issues.push({
      code: "invalid_manifest",
      message: "manifest.counts.members と members.length が一致しません。",
    });
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    manifest: {
      manifest_schema_version: AI_EVAL_BATCH_MANIFEST_SCHEMA_VERSION,
      kind: raw.kind as AiEvalBatchManifestKind,
      batch_id: String(raw.batch_id),
      generated_at: String(raw.generated_at),
      generated_by_role: raw.generated_by_role as "teacher" | "admin",
      locale: "ja-JP",
      counts: { members: members.length },
      members,
    },
  };
}

export function buildAiEvalBatchManifest(input: {
  kind: AiEvalBatchManifestKind;
  batchId: string;
  generatedAt: string;
  generatedByRole: "teacher" | "admin";
  members: AiEvalBatchManifestMember[];
}): AiEvalBatchManifest {
  return {
    manifest_schema_version: AI_EVAL_BATCH_MANIFEST_SCHEMA_VERSION,
    kind: input.kind,
    batch_id: input.batchId,
    generated_at: input.generatedAt,
    generated_by_role: input.generatedByRole,
    locale: "ja-JP",
    counts: { members: input.members.length },
    members: input.members,
  };
}

/**
 * manifest と ZIP 内の実ファイルパスを照合する。
 * 不一致があれば canExecute=false（Preview で実行不可）。
 */
export function checkManifestAgainstFiles(input: {
  manifest: AiEvalBatchManifest;
  /** ZIP 内の全パス（正規化済み、スラッシュ区切り） */
  zipPaths: string[];
  /** packages/ or results/ 配下のメンバーファイルのみ */
  memberDirPrefix: "packages/" | "results/";
  expectedKind: AiEvalBatchManifestKind;
}): {
  canExecute: boolean;
  manifestCount: number;
  fileCount: number;
  evaluationRequestIds: string[];
  missing: string[];
  extra: string[];
  pathMismatches: Array<{
    evaluationRequestId: string;
    expectedPath: string;
    reason: string;
  }>;
  issues: ManifestIntegrityIssue[];
} {
  const issues: ManifestIntegrityIssue[] = [];
  if (input.manifest.kind !== input.expectedKind) {
    issues.push({
      code: "kind_mismatch",
      message: `manifest.kind が ${input.expectedKind} ではありません。`,
    });
  }

  const pathSet = new Set(input.zipPaths.map(normalizeZipPath));
  const memberFiles = [...pathSet].filter(
    (p) =>
      p.startsWith(input.memberDirPrefix) &&
      p.endsWith(".json") &&
      p !== `${input.memberDirPrefix}`,
  );

  const missing: string[] = [];
  const pathMismatches: Array<{
    evaluationRequestId: string;
    expectedPath: string;
    reason: string;
  }> = [];

  for (const m of input.manifest.members) {
    const expected = normalizeZipPath(m.path);
    if (!expected.startsWith(input.memberDirPrefix)) {
      pathMismatches.push({
        evaluationRequestId: m.evaluation_request_id,
        expectedPath: expected,
        reason: `path は ${input.memberDirPrefix} 配下である必要があります。`,
      });
      issues.push({
        code: "path_mismatch",
        message: `path が ${input.memberDirPrefix} 配下ではありません。`,
        evaluationRequestId: m.evaluation_request_id,
        path: expected,
      });
      continue;
    }
    const expectedName = `${input.memberDirPrefix}${m.evaluation_request_id}.json`;
    if (expected !== expectedName) {
      pathMismatches.push({
        evaluationRequestId: m.evaluation_request_id,
        expectedPath: expected,
        reason: `ファイル名は ${m.evaluation_request_id}.json である必要があります。`,
      });
      issues.push({
        code: "path_mismatch",
        message: "path と evaluation_request_id が一致しません。",
        evaluationRequestId: m.evaluation_request_id,
        path: expected,
      });
    }
    if (!pathSet.has(expected)) {
      missing.push(expected);
      issues.push({
        code: "missing_file",
        message: "manifest 記載のファイルが ZIP にありません。",
        evaluationRequestId: m.evaluation_request_id,
        path: expected,
      });
    }
  }

  const manifestPaths = new Set(
    input.manifest.members.map((m) => normalizeZipPath(m.path)),
  );
  const extra = memberFiles.filter((p) => !manifestPaths.has(p));
  for (const p of extra) {
    issues.push({
      code: "extra_file",
      message: "manifest に無いメンバーファイルがあります。",
      path: p,
    });
  }

  const canExecute = issues.length === 0;

  return {
    canExecute,
    manifestCount: input.manifest.members.length,
    fileCount: memberFiles.length,
    evaluationRequestIds: input.manifest.members.map(
      (m) => m.evaluation_request_id,
    ),
    missing,
    extra,
    pathMismatches,
    issues,
  };
}

export function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}
