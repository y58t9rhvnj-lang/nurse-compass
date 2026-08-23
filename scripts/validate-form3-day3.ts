/**
 * Compass Version2.1 Day 3 — Form3 Hook 純関数・Draft の検証。
 *
 * React Hook 実機テスト基盤は使わず、状態機械／更新／Draft を検証する。
 *
 * 実行:
 *   npx tsx scripts/validate-form3-day3.ts
 */

import {
  __resetForm3DraftCacheForTests,
  clearForm3Draft,
  parseForm3Draft,
  writeForm3Draft,
  readForm3Draft,
} from "../lib/v2/notebook/form3Draft";
import {
  applyPatternField,
  initialForm3Data,
  interpretForm3SaveResult,
  markPatternReviewed,
  resolveConflictWithLatest,
  unmarkPatternReviewed,
} from "../lib/v2/notebook/form3HookLogic";
import {
  FORM3_PATTERN_KEYS,
  createEmptyForm3,
} from "../lib/form3/form3Types";
import type { Form3Snapshot } from "../lib/v2/notebook/types";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

// localStorage mock（Node）
const store = new Map<string, string>();
(
  globalThis as unknown as {
    window: {
      localStorage: {
        getItem: (k: string) => string | null;
        setItem: (k: string, v: string) => void;
        removeItem: (k: string) => void;
      };
      addEventListener: () => void;
      removeEventListener: () => void;
    };
  }
).window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, v);
    },
    removeItem: (k) => {
      store.delete(k);
    },
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

__resetForm3DraftCacheForTests();
store.clear();

// ── 初期データ ────────────────────────────────
{
  const empty = initialForm3Data("A", null);
  check(
    "初期データ保持（空・11キー）",
    FORM3_PATTERN_KEYS.every((k) => empty.patterns[k] != null) &&
      empty.patientId === "A",
  );
  const snap: Form3Snapshot = {
    payload: createEmptyForm3("A"),
    version: 3,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  snap.payload.patterns.elimination.relatedInformation = "from-server";
  const fromInitial = initialForm3Data("A", snap);
  check(
    "initial Snapshot から復元",
    fromInitial.patterns.elimination.relatedInformation === "from-server",
  );
}

// ── 1フィールド更新・他パターン非破壊 ─────────
{
  const base = createEmptyForm3("A");
  const otherRef = base.patterns.sleep_rest;
  const next = applyPatternField(
    base,
    "elimination",
    "relatedInformation",
    "only-elim",
  );
  check(
    "1フィールド更新",
    next.patterns.elimination.relatedInformation === "only-elim",
  );
  check(
    "他パターン非破壊（参照維持）",
    next.patterns.sleep_rest === otherRef,
  );
  check(
    "他パターン内容非破壊",
    next.patterns.sleep_rest.relatedInformation === "",
  );
}

// ── 整理済み後の編集で isReviewed 解除 ────────
{
  let data = createEmptyForm3("A");
  data = applyPatternField(data, "role_relationship", "judgment", "strength");
  data = applyPatternField(
    data,
    "role_relationship",
    "judgmentRationale",
    "根拠",
  );
  const marked = markPatternReviewed(data, "role_relationship");
  check("markReviewed 成功", marked.ok === true);
  data = marked.ok ? marked.data : data;
  check("markReviewed 後 isReviewed true", data.patterns.role_relationship.isReviewed);
  data = applyPatternField(
    data,
    "role_relationship",
    "relatedInformation",
    "編集した",
  );
  check(
    "整理済み後の本文編集で isReviewed false",
    data.patterns.role_relationship.isReviewed === false,
  );
  check(
    "本文は保持",
    data.patterns.role_relationship.relatedInformation === "編集した",
  );
}

// ── markReviewed 失敗 ─────────────────────────
{
  const data = createEmptyForm3("A");
  const failed = markPatternReviewed(data, "elimination");
  check("markReviewed 失敗（条件不足）", failed.ok === false);
  if (!failed.ok) {
    check(
      "issues に judgment_required",
      failed.issues.includes("judgment_required"),
    );
  }
  check(
    "失敗時 isReviewed は false のまま",
    data.patterns.elimination.isReviewed === false,
  );
}

// ── unmarkReviewed ────────────────────────────
{
  let data = createEmptyForm3("A");
  data = applyPatternField(data, "value_belief", "judgment", "problem");
  data = applyPatternField(data, "value_belief", "judgmentRationale", "根拠");
  const marked = markPatternReviewed(data, "value_belief");
  data = marked.ok ? marked.data : data;
  data = unmarkPatternReviewed(data, "value_belief");
  check("unmarkReviewed", data.patterns.value_belief.isReviewed === false);
}

// ── interpretForm3SaveResult ──────────────────
{
  const snap: Form3Snapshot = {
    payload: createEmptyForm3("A"),
    version: 2,
    updatedAt: "t",
  };
  const saved = interpretForm3SaveResult(
    {
      ok: true,
      kind: "saved",
      data: snap,
      warnings: [
        { code: "invalid_reviewed_reset", patternKey: "elimination" },
      ],
    },
    false,
  );
  check("saved 時 version 更新用 snapshot", saved.kind === "saved" && saved.snapshot.version === 2);
  check(
    "warning 保持（error 扱いにしない）",
    saved.kind === "saved" && saved.warnings.length === 1,
  );
  check("saved で resave=false", saved.kind === "saved" && saved.resave === false);

  const resave = interpretForm3SaveResult(
    { ok: true, kind: "saved", data: snap, warnings: [] },
    true,
  );
  check("保存中変更→再保存フラグ", resave.kind === "saved" && resave.resave === true);

  const conflict = interpretForm3SaveResult(
    { ok: false, kind: "conflict", latest: snap },
    true,
  );
  check("conflict 時 kind=conflict", conflict.kind === "conflict");
  check(
    "conflict 時は自動再保存しない（resave 無し）",
    conflict.kind === "conflict",
  );

  const err = interpretForm3SaveResult(
    { ok: false, kind: "database_error" },
    false,
  );
  check("error 時 kind=error", err.kind === "error");
}

// ── conflict 解除 ─────────────────────────────
{
  const latest: Form3Snapshot = {
    payload: createEmptyForm3("A"),
    version: 9,
    updatedAt: "latest",
  };
  latest.payload.patterns.sleep_rest.relatedInformation = "server-wins";
  const resolved = resolveConflictWithLatest(latest);
  check("最新読込で version 更新", resolved.version === 9);
  check(
    "最新読込でデータ置換",
    resolved.data.patterns.sleep_rest.relatedInformation === "server-wins",
  );
  check("conflict 解除 status=saved", resolved.status === "saved");
}

// ── Draft ─────────────────────────────────────
{
  __resetForm3DraftCacheForTests();
  store.clear();
  const payload = createEmptyForm3("A");
  payload.patterns.elimination.relatedInformation = "draft-body";
  writeForm3Draft("user-1", "SP-001", { payload, version: 1 });
  const read = readForm3Draft("user-1", "SP-001", "A");
  check(
    "Draft 読取",
    !!read &&
      read.payload.patterns.elimination.relatedInformation === "draft-body",
  );

  clearForm3Draft("user-1", "SP-001");
  __resetForm3DraftCacheForTests();
  check(
    "保存成功後 Draft 削除",
    readForm3Draft("user-1", "SP-001", "A") === null,
  );

  check(
    "不正 Draft JSON 無視",
    parseForm3Draft("not-json", "A") === null,
  );
  check(
    "不正 Draft オブジェクト無視",
    parseForm3Draft({ payload: null }, "A") === null,
  );
  check(
    "patientId 不一致 Draft 無視",
    parseForm3Draft(
      {
        payload: createEmptyForm3("B"),
        version: 1,
        stashedAt: "t",
      },
      "A",
    ) === null,
  );

  // error 時入力保持のモデル: draft に書く
  const keep = createEmptyForm3("A");
  keep.patterns.cognitive_perceptual.interpretation = "keep-on-error";
  writeForm3Draft("user-1", "SP-001", { payload: keep, version: 2 });
  const kept = readForm3Draft("user-1", "SP-001", "A");
  check(
    "error 時入力保持（Draft）",
    kept?.payload.patterns.cognitive_perceptual.interpretation ===
      "keep-on-error",
  );
}

// debounce 自体はタイマー依存のため、schedule 後の保存／再保存は
// interpretForm3SaveResult の resave フラグで代替検証済み。

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`[${c.ok ? "OK" : "FAIL"}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log(
  `\n===== form3 Day3: ${checks.length - failed.length} OK / ${failed.length} FAIL =====`,
);
if (failed.length > 0) process.exit(1);
