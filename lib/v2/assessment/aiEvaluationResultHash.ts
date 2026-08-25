// Compass Version 2.2 Sprint 5B-2 — result_hash（normalized canonical SHA-256）

import { createHash } from "crypto";

/** キー順固定の canonical JSON（輸送メタは呼び出し側で除外済みの normalized を渡す） */
export function canonicalJsonString(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort((a, b) => a.localeCompare(b))) {
      out[k] = sortKeysDeep(o[k]);
    }
    return out;
  }
  return value;
}

export function sha256HexOfCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJsonString(value), "utf8").digest("hex");
}

export function sha256HexOfString(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
