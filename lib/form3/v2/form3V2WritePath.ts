// Form3 Phase B2-2B — Write Path 純関数（Repository 非接続）
//
// 保存一本道（Action 手前まで）:
//   Save Gate → sanitize → validation → serialize
// Migration だけでは dirty / hasUserEdited / Draft を立てない。

import type { Form3SaveStatus } from "@/lib/v2/notebook/form3HookLogic";
import { sanitizeForm3V2Payload } from "./form3V2Sanitize";
import { serializeForm3DataV2, serializeForm3DataV2ToJson } from "./form3V2Serialize";
import {
  detectForm3PayloadSchema,
  type Form3PayloadSchemaVersion,
} from "./form3V2SchemaDetect";
import type { Form3DataV2, Form3MigrationWarning } from "./form3V2Types";
import {
  validateForm3V2Persistence,
  type Form3V2PersistenceIssue,
} from "./form3V2Validation";
import {
  canPersistForm3V2,
  type CanPersistForm3V2Input,
  type Form3V2PersistGateResult,
} from "./form3V2SaveGate";

export type Form3V2WriteFlags = {
  hasUserEdited: boolean;
  dirty: boolean;
  hasPersistedV2: boolean;
  saveStatus: Form3SaveStatus;
};

/** 読込直後の Write フラグ（Migration では編集扱いにしない） */
export function createInitialForm3V2WriteFlags(args: {
  hasPersistedV2: boolean;
}): Form3V2WriteFlags {
  return {
    hasUserEdited: false,
    dirty: false,
    hasPersistedV2: args.hasPersistedV2,
    saveStatus: "idle",
  };
}

/**
 * DB に schemaVersion 2 が永続化されているか。
 * メモリ migrate 済みだけでは false。
 */
export function resolveHasPersistedV2(args: {
  persistedSchemaVersion: Form3PayloadSchemaVersion | null | undefined;
  rawPayload?: unknown;
}): boolean {
  if (args.persistedSchemaVersion === 2) return true;
  if (args.persistedSchemaVersion === 1) return false;
  if (args.rawPayload !== undefined) {
    return detectForm3PayloadSchema(args.rawPayload).schemaVersion === 2;
  }
  return false;
}

/**
 * ユーザー編集を記録。Migration 経路からは呼ばない。
 * data を渡した場合は置換用の次データも返す（Hook が setState）。
 */
export function markForm3V2UserEdited(
  flags: Form3V2WriteFlags,
  nextData?: Form3DataV2,
): {
  flags: Form3V2WriteFlags;
  dataV2?: Form3DataV2;
} {
  return {
    flags: {
      ...flags,
      hasUserEdited: true,
      dirty: true,
      saveStatus:
        flags.saveStatus === "conflict" || flags.saveStatus === "saving"
          ? flags.saveStatus
          : "dirty",
    },
    dataV2: nextData,
  };
}

export type PrepareForm3V2PersistPipelineResult =
  | {
      ok: true;
      payload: Record<string, unknown>;
      data: Form3DataV2;
      json: string;
      warnings: Form3MigrationWarning[];
    }
  | {
      ok: false;
      issues: Form3V2PersistenceIssue[];
      warnings: Form3MigrationWarning[];
    };

/**
 * 保存直前の一本道（sanitize → validation → serialize）。
 * Repository / Server Action は呼ばない。
 */
export function prepareForm3V2PersistPipeline(
  data: Form3DataV2,
  patientId: string,
): PrepareForm3V2PersistPipelineResult {
  const { data: sanitized, warnings } = sanitizeForm3V2Payload(data, patientId);
  const validation = validateForm3V2Persistence(sanitized);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues, warnings };
  }
  return {
    ok: true,
    payload: serializeForm3DataV2(sanitized),
    data: sanitized,
    json: serializeForm3DataV2ToJson(sanitized),
    warnings,
  };
}

export type Form3V2ExplicitSaveRequest = CanPersistForm3V2Input & {
  requireUserEdit?: boolean;
};

/**
 * 明示保存要求の事前チェック（Gate）。
 * requireUserEdit 既定 true（B2-2B）。
 */
export function evaluateForm3V2ExplicitSave(
  input: Form3V2ExplicitSaveRequest,
): Form3V2PersistGateResult {
  const requireUserEdit = input.requireUserEdit !== false;
  return canPersistForm3V2({
    ...input,
    hasUserEdited: requireUserEdit ? input.hasUserEdited : true,
  });
}

/** 保存成功後のフラグ更新（ローカル編集はサーバ正規化結果で置換する前提） */
export function applyForm3V2SaveSuccess(
  flags: Form3V2WriteFlags,
): Form3V2WriteFlags {
  return {
    ...flags,
    dirty: false,
    hasPersistedV2: true,
    saveStatus: "saved",
  };
}

/** conflict: dirty は消さない・編集フラグ維持 */
export function applyForm3V2SaveConflict(
  flags: Form3V2WriteFlags,
): Form3V2WriteFlags {
  return {
    ...flags,
    saveStatus: "conflict",
  };
}

/** error: 入力保持・dirty 維持 */
export function applyForm3V2SaveError(
  flags: Form3V2WriteFlags,
): Form3V2WriteFlags {
  return {
    ...flags,
    saveStatus: "error",
  };
}

export function shouldWriteForm3V2DraftOnSaveFailure(flags: {
  hasUserEdited: boolean;
}): boolean {
  return flags.hasUserEdited === true;
}

export function shouldClearForm3V2DraftOnSaveSuccess(): boolean {
  return true;
}
