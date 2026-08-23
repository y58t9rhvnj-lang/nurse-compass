/**
 * Compass Version2.1 Day 2 — 様式3 sanitize / Snapshot 純関数の検証スクリプト。
 *
 * DB・Supabase には接続しない（Mapper の正規化のみ）。
 *
 * 実行:
 *   npx tsx scripts/validate-form3-day2.ts
 */

import {
  rowToForm3Snapshot,
  sanitizeForm3Payload,
  type Form3Row,
} from "../lib/v2/notebook/form3Mapper";
import {
  FORM3_PATTERN_KEYS,
  FORM3_SCHEMA_VERSION,
  createEmptyForm3,
} from "../lib/form3/form3Types";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

// ── 1. 11キー補完 ─────────────────────────────
{
  const { payload } = sanitizeForm3Payload({ patterns: {} }, "A");
  check(
    "空 patterns でも 11 キーを補完",
    FORM3_PATTERN_KEYS.every((k) => payload.patterns[k] != null),
    `keys=${Object.keys(payload.patterns).length}`,
  );
  check(
    "補完キーはちょうど 11",
    Object.keys(payload.patterns).length === 11,
  );
}

// ── 2. patientId 上書き ───────────────────────
{
  const { payload } = sanitizeForm3Payload(
    { patientId: "HACKED", patterns: {} },
    "A",
  );
  check("patientId はサーバ値へ上書き", payload.patientId === "A", payload.patientId);
}

// ── 3. judgment 正規化 ────────────────────────
{
  const { payload } = sanitizeForm3Payload(
    {
      patterns: {
        elimination: {
          judgment: "not_a_real_judgment",
          judgmentRationale: "x",
          relatedInformation: "keep",
        },
        sleep_rest: {
          judgment: "strength",
          judgmentRationale: "根拠",
        },
      },
    },
    "A",
  );
  check(
    "不正 judgment は null",
    payload.patterns.elimination.judgment === null,
    String(payload.patterns.elimination.judgment),
  );
  check(
    "本文 string は保持",
    payload.patterns.elimination.relatedInformation === "keep",
  );
  check(
    "正当 judgment は保持",
    payload.patterns.sleep_rest.judgment === "strength",
  );
}

// ── 4. unknown key 削除 ───────────────────────
{
  const { payload } = sanitizeForm3Payload(
    {
      schemaVersion: 1,
      patientId: "A",
      form2Body: "SHOULD_NOT_COPY",
      overviewText: "患者理解全文は転記しない",
      patterns: {
        elimination: {
          relatedInformation: "ok",
          form2Snippet: "drop-me",
          extraField: 123,
        },
        unknown_pattern: {
          relatedInformation: "ghost",
        },
      },
      extraTop: true,
    },
    "A",
  );
  const top = payload as unknown as Record<string, unknown>;
  check("様式2本文キーをコピーしない", top.form2Body === undefined);
  check("患者理解全文キーをコピーしない", top.overviewText === undefined);
  check("未知トップレベルを残さない", top.extraTop === undefined);
  check(
    "未知パターンキーを残さない",
    (payload.patterns as Record<string, unknown>).unknown_pattern === undefined,
  );
  const elim = payload.patterns.elimination as unknown as Record<string, unknown>;
  check("パターン内の未知フィールドを残さない", elim.form2Snippet === undefined);
  check("パターン内の非stringフィールドを残さない", elim.extraField === undefined);
}

// ── 5. string 以外は空文字 / isReviewed boolean のみ ──
{
  const { payload } = sanitizeForm3Payload(
    {
      patterns: {
        value_belief: {
          relatedInformation: 99,
          interpretation: null,
          crossPatternRelations: { a: 1 },
          judgmentRationale: ["x"],
          additionalInformationNeeded: true,
          isReviewed: "yes",
        },
      },
    },
    "A",
  );
  const p = payload.patterns.value_belief;
  check("非string relatedInformation → 空", p.relatedInformation === "");
  check("非string interpretation → 空", p.interpretation === "");
  check("非string crossPatternRelations → 空", p.crossPatternRelations === "");
  check("非string judgmentRationale → 空", p.judgmentRationale === "");
  check(
    "非string additionalInformationNeeded → 空",
    p.additionalInformationNeeded === "",
  );
  check("非boolean isReviewed → false", p.isReviewed === false);
}

// ── 6. invalid reviewed 修正（本文は保存） ────
{
  const { payload, warnings } = sanitizeForm3Payload(
    {
      patterns: {
        activity_exercise: {
          relatedInformation: "活動メモ",
          interpretation: "解釈",
          judgment: "problem",
          judgmentRationale: "",
          isReviewed: true,
        },
        coping_stress_tolerance: {
          judgment: "insufficient_information",
          judgmentRationale: "根拠あり",
          additionalInformationNeeded: "",
          isReviewed: true,
          relatedInformation: "ストレス",
        },
        role_relationship: {
          judgment: "strength",
          judgmentRationale: "根拠OK",
          isReviewed: true,
          relatedInformation: "役割",
        },
      },
    },
    "A",
  );

  check(
    "根拠なし reviewed → false",
    payload.patterns.activity_exercise.isReviewed === false,
  );
  check(
    "根拠なしでも本文保持",
    payload.patterns.activity_exercise.relatedInformation === "活動メモ" &&
      payload.patterns.activity_exercise.interpretation === "解釈",
  );
  check(
    "情報不足で追加情報なし reviewed → false",
    payload.patterns.coping_stress_tolerance.isReviewed === false,
  );
  check(
    "正当 reviewed は true のまま",
    payload.patterns.role_relationship.isReviewed === true,
  );
  check(
    "invalid reviewed の warning がある",
    warnings.some(
      (w) =>
        w.code === "invalid_reviewed_reset" &&
        w.patternKey === "activity_exercise",
    ),
    JSON.stringify(warnings),
  );
  check(
    "情報不足不正の warning がある",
    warnings.some(
      (w) =>
        w.code === "invalid_reviewed_reset" &&
        w.patternKey === "coping_stress_tolerance",
    ),
  );
  check(
    "正当 reviewed に warning なし",
    !warnings.some((w) => w.patternKey === "role_relationship"),
  );
}

// ── 7. schemaVersion 正規化 ───────────────────
{
  const a = sanitizeForm3Payload({ schemaVersion: 99 }, "A").payload;
  const b = sanitizeForm3Payload({ schemaVersion: "1" }, "A").payload;
  const c = sanitizeForm3Payload({}, "A").payload;
  check("schemaVersion 99 → 現行定数", a.schemaVersion === FORM3_SCHEMA_VERSION);
  check("schemaVersion 文字列 → 現行定数", b.schemaVersion === FORM3_SCHEMA_VERSION);
  check("schemaVersion 欠落 → 現行定数", c.schemaVersion === FORM3_SCHEMA_VERSION);
}

// ── 8. Snapshot は DB version と schemaVersion を分離 ──
{
  const empty = createEmptyForm3("A");
  empty.patterns.elimination.relatedInformation = "from-db";
  const row: Form3Row = {
    id: "00000000-0000-0000-0000-000000000001",
    user_id: "u",
    organization_id: "o",
    academic_year: 2026,
    case_id: "SP-001",
    payload: empty,
    version: 7,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-08-14T00:00:00.000Z",
  };
  const snap = rowToForm3Snapshot(row, "A");
  check("Snapshot.version は DB version", snap.version === 7);
  check(
    "Snapshot.payload.schemaVersion はスキーマ版",
    snap.payload.schemaVersion === FORM3_SCHEMA_VERSION,
  );
  check(
    "Snapshot.updatedAt は DB updated_at",
    snap.updatedAt === "2026-08-14T00:00:00.000Z",
  );
  check(
    "Snapshot patientId 上書き",
    snap.payload.patientId === "A",
  );
  check(
    "Snapshot 本文復元",
    snap.payload.patterns.elimination.relatedInformation === "from-db",
  );
}

// ── 結果 ──────────────────────────────────────
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  const mark = c.ok ? "OK" : "FAIL";
  console.log(`[${mark}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log(
  `\n===== form3 Day2: ${checks.length - failed.length} OK / ${failed.length} FAIL =====`,
);
if (failed.length > 0) process.exit(1);
