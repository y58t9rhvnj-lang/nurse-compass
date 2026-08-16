/**
 * Form3 Phase B2-2A — Read Path Integration 検証。
 *
 * 実行: npx tsx scripts/validate-form3-phase-b2-2a.ts
 *
 * 確認:
 *   v1読込 → v2表示(メモリ) → DB更新なし → 再読込 → DBは v1のまま
 */

import { createEmptyForm3 } from "../lib/form3/form3Types";
import {
  hydrateForm3ReadFromSnapshotPayload,
  hydrateForm3ReadPath,
} from "../lib/form3/v2/form3V2ReadPath";
import { serializeForm3DataV2ToJson } from "../lib/form3/v2/form3V2Serialize";
import {
  initialForm3Data,
  initialForm3SaveStatusAfterRead,
} from "../lib/v2/notebook/form3HookLogic";
import type { Form3Snapshot } from "../lib/v2/notebook/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const FIXED_NOW = "2026-08-16T16:00:00.000Z";
const PATIENT = "A";

// ── 擬似 DB（hydrate では更新しない） ──
{
  const dbPayload = createEmptyForm3(PATIENT);
  dbPayload.patterns.nutritional_metabolic = {
    relatedInformation: "食欲低下",
    interpretation: "低栄養疑い",
    crossPatternRelations: "",
    judgment: "problem",
    judgmentRationale: "摂取減少",
    additionalInformationNeeded: "",
    isReviewed: true,
  };
  const dbRow = {
    payload: structuredClone(dbPayload),
    version: 4,
    updated_at: FIXED_NOW,
  };
  const dbFingerprintBefore = JSON.stringify(dbRow.payload);

  const snap: Form3Snapshot = {
    payload: structuredClone(dbRow.payload),
    version: dbRow.version,
    updatedAt: dbRow.updated_at,
  };

  const hydration = hydrateForm3ReadFromSnapshotPayload(
    snap.payload,
    PATIENT,
    { now: FIXED_NOW },
  );

  check("v1読込 → schemaVersion 2", hydration.dataV2.schemaVersion === 2);
  check("sourceSchemaVersion は 1", hydration.sourceSchemaVersion === 1);
  check("v2 Info カードあり", hydration.dataV2.informationCards.length === 1);
  check(
    "v2 表示内容（Info）",
    hydration.dataV2.informationCards[0]?.content === "食欲低下",
  );
  check("dirty === false", hydration.dirty === false);
  check("shouldPersist === false", hydration.shouldPersist === false);
  check(
    "saveStatus は idle（dirty にしない）",
    initialForm3SaveStatusAfterRead(hydration.dirty) === "idle",
  );

  // Repository save を呼ばないことを擬似確認: dbRow を触れない
  const dbFingerprintAfter = JSON.stringify(dbRow.payload);
  check("DB更新なし（fingerprint 同一）", dbFingerprintBefore === dbFingerprintAfter);
  check(
    "DB は依然 schemaVersion 1",
    (dbRow.payload as { schemaVersion: number }).schemaVersion === 1,
  );

  // 再読込（DB から再度 hydrate）
  const reload = hydrateForm3ReadFromSnapshotPayload(dbRow.payload, PATIENT, {
    now: FIXED_NOW,
  });
  check("再読込でも source は v1", reload.sourceSchemaVersion === 1);
  check(
    "再読込後も DB は v1",
    (dbRow.payload as { schemaVersion: number }).schemaVersion === 1 &&
      dbFingerprintBefore === JSON.stringify(dbRow.payload),
  );
  check(
    "再読込メモリは v2",
    reload.dataV2.schemaVersion === 2 &&
      reload.dataV2.informationCards.length === 1,
  );
}

// ── Flag OFF 相当: initialForm3Data は v1 のまま ──
{
  const v1 = createEmptyForm3(PATIENT);
  v1.patterns.sleep_rest.relatedInformation = "中途覚醒";
  const snap: Form3Snapshot = {
    payload: v1,
    version: 1,
    updatedAt: FIXED_NOW,
  };
  const data = initialForm3Data(PATIENT, snap);
  check("Flag OFF 相当: data は schema 1", data.schemaVersion === 1);
  check(
    "Flag OFF 相当: patterns 維持",
    data.patterns.sleep_rest.relatedInformation === "中途覚醒",
  );
}

// ── 空読込 ──
{
  const empty = hydrateForm3ReadPath(null, PATIENT);
  check("null 読込 → 空 v2", empty.dataV2.schemaVersion === 2);
  check("null 読込 dirty false", empty.dirty === false);
  check("null 読込 shouldPersist false", empty.shouldPersist === false);
}

// ── Hook / Action / Repository が save を読込から呼ばない（静的） ──
{
  const root = join(process.cwd());
  const hookSrc = readFileSync(
    join(root, "hooks/v2/useForm3Supabase.ts"),
    "utf8",
  );
  const actionSrc = readFileSync(
    join(root, "app/v2/actions/form3.ts"),
    "utf8",
  );
  const repoSrc = readFileSync(
    join(root, "lib/v2/notebook/form3Repository.ts"),
    "utf8",
  );
  const readPathSrc = readFileSync(
    join(root, "lib/form3/v2/form3V2ReadPath.ts"),
    "utf8",
  );

  check(
    "ReadPath が saveForm3 / insertForm3 を呼ばない",
    !readPathSrc.includes("saveForm3") &&
      !readPathSrc.includes("insertForm3") &&
      !readPathSrc.includes("updateForm3"),
  );
  check(
    "Hook が Phase B で scheduleAutosave を抑止",
    hookSrc.includes("if (phaseB) return") &&
      hookSrc.includes("hydrateForm3ReadFromSnapshotPayload"),
  );
  check(
    "Hook が dataV2 を返す（UI へ渡せる）",
    hookSrc.includes("dataV2"),
  );
  check(
    "Server Action ファイルは B2-2A で変更不要（load は v1 Snapshot のまま）",
    actionSrc.includes("rowToForm3Snapshot") &&
      !actionSrc.includes("hydrateForm3ReadPath"),
  );
  check(
    "Repository に v2 save 配線なし",
    !repoSrc.includes("Form3DataV2") && !repoSrc.includes("saveForm3Payload"),
  );
}

// ── serialize しても ReadPath は DB に書かない（呼び出し側責務） ──
{
  const v1 = createEmptyForm3(PATIENT);
  v1.patterns.elimination.relatedInformation = "便秘";
  const h = hydrateForm3ReadPath(v1, PATIENT, { now: FIXED_NOW });
  const json = serializeForm3DataV2ToJson(h.dataV2);
  check(
    "メモリ v2 は JSON 化できる（永続化はしない）",
    json.includes('"schemaVersion":2') && h.shouldPersist === false,
  );
}

// ── 結果 ──
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  const mark = c.ok ? "OK  " : "FAIL";
  const detail = c.detail ? ` (${c.detail})` : "";
  console.log(`${mark} ${c.name}${detail}`);
}
console.log(
  `\n===== form3 Phase B2-2A: ${checks.length - failed.length} OK / ${failed.length} FAIL / ${checks.length} total =====`,
);
process.exit(failed.length === 0 ? 0 : 1);
