/**
 * Aさん Gold Standard データ層の検証スクリプト。
 *
 * 実行: npx tsx scripts/validate-gold-standard-a.ts
 *
 * - 学生 Form2/Form3 データを更新しない
 * - ネガティブテスト用フィクスチャは本スクリプト内のみ
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS,
  PATIENT_A_CANONICAL_INFORMATION_CATALOG,
} from "../lib/gold/patientA/canonicalInformationCatalog";
import {
  getPatientAGoldStandardV1,
  isPatientAGoldStandardV1Ready,
} from "../lib/gold/patientA/goldStandardV1";
import { PATIENT_A_CTP_EVIDENCE_MAP } from "../lib/gold/patientA/ctpEvidenceMap";
import { normalizePatientAGoldSourceV1 } from "../lib/gold/patientA/normalizeSourceV1";
import { parseGoldStandardDocument } from "../lib/gold/load";
import {
  catalogIdSet,
  validateCanonicalInformationCatalog,
  validateGoldStandardDocument,
} from "../lib/gold/validation";
import { GOLD_STANDARD_SCHEMA_VERSION } from "../lib/gold/types";
import type { GoldStandardDocument } from "../lib/gold/types";
import { caseIdForPatient } from "../lib/v2/notebook/caseId";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
}

const ids = catalogIdSet(PATIENT_A_CANONICAL_INFORMATION_CATALOG);

/** 検証スクリプト専用の有効フィクスチャ（本番データではない） */
function buildValidFixture(): GoldStandardDocument {
  return {
    schemaVersion: GOLD_STANDARD_SCHEMA_VERSION,
    patientId: "A",
    caseId: "SP-001",
    initialUnderstanding:
      "[fixture] 初期理解のプレースホルダ（本番 Gold ではない）",
    criticalThinkingPoints: [
      {
        id: "ctp-fixture-health-1",
        studentAssumption: "[fixture] 服薬理解が十分だと決めつける",
        facts: ["[fixture] 服薬自己管理への関心と定期服用の事実"],
        gordonLenses: ["health_perception_management"],
        meaning: ["[fixture] 関心と不安が併存しうる"],
        missing: ["[fixture] 病識の深さの評価"],
        update: "[fixture] 自己管理の段階を分けて見る",
        nextQuestion: "[fixture] 就寝前薬から始めることへの気持ちは？",
        evidenceInformationIds: ["a-info-health-s-1", "a-info-health-o-1"],
      },
    ],
    integratedUnderstanding: "[fixture] 統合理解プレースホルダ",
    remainingUnknowns: ["[fixture] 残る未知プレースホルダ"],
    assessmentCriteria: ["[fixture] 評価観点プレースホルダ"],
  };
}

// ── カタログ ─────────────────────────────────
const catalogIssues = validateCanonicalInformationCatalog(
  PATIENT_A_CANONICAL_INFORMATION_CATALOG,
);
check(
  "カタログに重大 issue なし",
  catalogIssues.length === 0,
  catalogIssues.map((i) => i.code).join(","),
);
check(
  "カタログ件数は active 22",
  PATIENT_A_CANONICAL_INFORMATION_CATALOG.length === 22,
  `n=${PATIENT_A_CANONICAL_INFORMATION_CATALOG.length}`,
);
check(
  "patientId/caseId は A / SP-001",
  PATIENT_A_CANONICAL_INFORMATION_CATALOG.every(
    (c) => c.patientId === "A" && c.caseId === "SP-001",
  ),
);
check("caseIdForPatient(A) === SP-001", caseIdForPatient("A") === "SP-001");

// ── 読み込み（有効フィクスチャ） ───────────────
const valid = parseGoldStandardDocument(
  buildValidFixture(),
  PATIENT_A_CANONICAL_INFORMATION_CATALOG,
);
check("有効フィクスチャを読み込める", valid.ok === true);

// ── 不正パターン ID ───────────────────────────
const badPattern = buildValidFixture();
(
  badPattern.criticalThinkingPoints[0] as unknown as {
    gordonLenses: string[];
  }
).gordonLenses = ["not_a_gordon_pattern"];
const badPatternResult = validateGoldStandardDocument(badPattern, ids);
check(
  "不正なパターンIDを拒否する",
  badPatternResult.ok === false &&
    badPatternResult.issues.some((i) => i.code === "invalid_pattern"),
  badPatternResult.ok
    ? "ok unexpectedly"
    : badPatternResult.issues.map((i) => i.code).join(","),
);

// ── 存在しないカード参照 ───────────────────────
const badCard = buildValidFixture();
(
  badCard.criticalThinkingPoints[0] as unknown as {
    evidenceInformationIds: string[];
  }
).evidenceInformationIds = ["a-info-does-not-exist"];
const badCardResult = validateGoldStandardDocument(badCard, ids);
check(
  "存在しないカード参照を検出する",
  badCardResult.ok === false &&
    badCardResult.issues.some((i) => i.code === "evidence_id_unknown"),
);

// ── CTP ID 重複 ───────────────────────────────
const dup = buildValidFixture();
const ctp = dup.criticalThinkingPoints[0];
(
  dup as { criticalThinkingPoints: typeof dup.criticalThinkingPoints }
).criticalThinkingPoints = [ctp, { ...ctp }];
const dupResult = validateGoldStandardDocument(dup, ids);
check(
  "同一 CTP ID の重複を検出する",
  dupResult.ok === false &&
    dupResult.issues.some((i) => i.code === "ctp_id_duplicate"),
);

// ── case / patient 不一致 ─────────────────────
const badCase = buildValidFixture();
(badCase as { caseId: string }).caseId = "SP-999";
const badCaseResult = validateGoldStandardDocument(badCase, ids);
check(
  "caseId 不一致を検出する",
  badCaseResult.ok === false &&
    badCaseResult.issues.some((i) => i.code === "case_id_mismatch"),
);

// ── 空フィールド ─────────────────────────────
const emptyFacts = buildValidFixture();
(emptyFacts.criticalThinkingPoints[0] as unknown as { facts: string[] }).facts =
  [];
const emptyFactsResult = validateGoldStandardDocument(emptyFacts, ids);
check(
  "空の facts を拒否する",
  emptyFactsResult.ok === false &&
    emptyFactsResult.issues.some((i) => i.path.includes("facts")),
);

// ── active 22 指紋不変 ─────────────────────────
check(
  "Aさん active 情報22件の content 指紋がカタログと一致（件数）",
  PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS.length === 22,
);

const backupPath = join(
  process.cwd(),
  "tmp/acceptance-99999991-A/layout-fix/form3-backup-before-longtext.json",
);
if (existsSync(backupPath)) {
  const backup = JSON.parse(readFileSync(backupPath, "utf8")) as {
    informationCards?: Array<{ status?: string; content?: string }>;
  };
  const active = (backup.informationCards ?? []).filter(
    (c) => c.status === "active",
  );
  check(
    "バックアップ上の active 情報は 22",
    active.length === 22,
    `n=${active.length}`,
  );
  const backupContents = new Set(active.map((c) => (c.content ?? "").trim()));
  const missing = PATIENT_A_ACTIVE_INFO_CONTENT_FINGERPRINTS.filter(
    (c) => !backupContents.has(c),
  );
  check(
    "カタログ content がバックアップ active 22件に全て含まれる（正規データ未改変）",
    missing.length === 0,
    missing.slice(0, 3).join(" | "),
  );
} else {
  check("バックアップ照合はスキップ（ファイルなし）", true, "tmp backup not present");
}

// ── 本番ソース移植 ─────────────────────────────
const sourcePath = join(
  process.cwd(),
  "lib/gold/patientA/A_gold_standard_v1.source.json",
);
check("ソース JSON が lib/gold に配置されている", existsSync(sourcePath), sourcePath);

const sourceRaw = JSON.parse(readFileSync(sourcePath, "utf8"));
const normalized = normalizePatientAGoldSourceV1(sourceRaw);
check(
  "ソース JSON を正規化できる",
  normalized.ok,
  normalized.ok
    ? undefined
    : normalized.issues.map((i) => `${i.path}:${i.code}`).join("; "),
);

check("本番 Gold v1 が読み込み可能", isPatientAGoldStandardV1Ready() === true);

let production: GoldStandardDocument | null = null;
try {
  production = getPatientAGoldStandardV1();
  check(
    "本番 Gold の patientId/caseId",
    production.patientId === "A" && production.caseId === "SP-001",
  );
  check("本番 CTP は 5件", production.criticalThinkingPoints.length === 5);
  check(
    "本番 CTP ID がユニーク",
    new Set(production.criticalThinkingPoints.map((c) => c.id)).size ===
      production.criticalThinkingPoints.length,
  );
  const allEvidenceKnown = production.criticalThinkingPoints.every((c) =>
    c.evidenceInformationIds.every((id) => ids.has(id)),
  );
  check("本番 evidence がすべてカタログに存在", allEvidenceKnown);
  check(
    "CTP evidence map が 5 CTP 分ある",
    Object.keys(PATIENT_A_CTP_EVIDENCE_MAP).length === 5,
  );
} catch (e) {
  check("本番 Gold 読み込み", false, e instanceof Error ? e.message : String(e));
}

// ── 結果 ─────────────────────────────────────
const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(
    `${c.ok ? "[OK]  " : "[FAIL]"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`,
  );
}
console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
if (failed.length > 0) {
  process.exitCode = 1;
}
